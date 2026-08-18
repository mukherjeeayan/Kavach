package com.safeguard.parentalcontrol.service.appblock

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.safeguard.parentalcontrol.BuildConfig
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
import com.safeguard.parentalcontrol.security.TamperState
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

/**
 * Foreground service that continuously monitors running apps and
 * kills any that appear on the blocked list.
 *
 * Security posture (per the bypass-resistance skill):
 * - Runs as a foreground service with START_STICKY so the system
 *   restarts it after a process death.
 * - Reads the blocked list from the local Room cache (populated by
 *   WorkManager sync), so enforcement works offline.
 * - Performs multi-signal tamper/root detection on startup and
 *   periodically.  On detection: (a) logs locally, (b) attempts
 *   server notification, (c) applies maximum-restrictive local
 *   lockdown — even if step (b) fails due to no connectivity.
 * - Never exposes detection method details in UI strings.
 */
@AndroidEntryPoint
class AppBlockingService : Service() {

    @Inject
    lateinit var repository: AppBlockingRepository

    @Inject
    lateinit var tamperState: TamperState

    @Inject
    lateinit var onboardingStore: OnboardingStore

    private val serviceScope = CoroutineScope(Dispatchers.Default + Job())
    private var monitoringJob: Job? = null
    private var tamperCheckJob: Job? = null

    // In-memory cache refreshed from Room, used for O(1) lookups
    // during the 1-second polling loop.
    @Volatile
    private var blockedPackages: Set<String> = emptySet()

    // ── Lifecycle ─────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())

        // Keep the in-memory set in sync with Room via Flow collection
        serviceScope.launch {
            repository.getBlockedAppsFlow(getDeviceIdentifier()).collect { rules ->
                blockedPackages = rules
                    .filter { it.isBlocked }
                    .map { it.packageName }
                    .toSet()

                if (BuildConfig.DEBUG) {
                    Log.d(TAG, "Blocked list updated: ${blockedPackages.size} apps")
                }
            }
        }

        startMonitoring()
        startTamperDetection()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // START_STICKY: system will recreate the service after a kill
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        // Clean up coroutine scope to avoid leaks
        monitoringJob?.cancel()
        tamperCheckJob?.cancel()
        (serviceScope.coroutineContext[Job])?.cancel()
        Log.i(TAG, "AppBlockingService destroyed — scope cancelled")
    }

    // ── App Monitoring Loop ───────────────────────────────────────

    private fun startMonitoring() {
        monitoringJob = serviceScope.launch {
            val usageStatsManager =
                getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val activityManager =
                getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager

            while (isActive) {
                try {
                    val currentForegroundPackage = getCurrentForegroundApp(usageStatsManager)

                    if (currentForegroundPackage != null &&
                        blockedPackages.contains(currentForegroundPackage) &&
                        currentForegroundPackage != packageName // Never block ourselves
                    ) {
                        killBlockedApp(activityManager, currentForegroundPackage)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error in monitoring loop", e)
                    // Never crash — log and continue (mandatory per Android skill)
                }

                // Poll every 1 second
                delay(MONITORING_INTERVAL_MS)
            }
        }
    }

    /**
     * Reads UsageEvents for the last 2 seconds to determine which
     * app is currently in the foreground.
     * - API 29+: ACTIVITY_RESUMED
     * - API 26-28: MOVE_TO_FOREGROUND (ACTIVITY_RESUMED does not exist)
     */
    private fun getCurrentForegroundApp(usageStatsManager: UsageStatsManager): String? {
        val endTime = System.currentTimeMillis()
        val startTime = endTime - MONITORING_WINDOW_MS

        val usageEvents = usageStatsManager.queryEvents(startTime, endTime)
        val event = UsageEvents.Event()
        var lastForegroundPackage: String? = null

        val foregroundEventType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            UsageEvents.Event.ACTIVITY_RESUMED
        } else {
            UsageEvents.Event.MOVE_TO_FOREGROUND
        }

        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(event)
            if (event.eventType == foregroundEventType) {
                lastForegroundPackage = event.packageName
            }
        }

        return lastForegroundPackage
    }

    /**
     * Bring the user back to the home screen by removing the blocked
     * app from recents.  This is a "soft kill" that doesn't require
     * root — the app appears to close naturally.
     */
    private fun killBlockedApp(activityManager: ActivityManager, packageName: String) {
        Log.i(TAG, "Blocking app: $packageName — moving task to back")

        // Remove from recent tasks so the child can't just switch back
        val appTasks = activityManager.appTasks
        for (task in appTasks) {
            try {
                val taskInfo = task.taskInfo
                if (taskInfo.baseActivity?.packageName == packageName) {
                    task.finishAndRemoveTask()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error removing task for $packageName", e)
            }
        }

        // Navigate back to our app or the launcher
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
    }

    // ── Tamper / Root / Bypass Detection ──────────────────────────
    // Security skill: combine multiple signals — never rely on one.

    private fun startTamperDetection() {
        tamperCheckJob = serviceScope.launch {
            while (isActive) {
                try {
                    val isRooted = checkForRoot()
                    val isDebuggerAttached = checkForDebugger()

                    if (isRooted || isDebuggerAttached) {
                        handleTamperDetected(isRooted, isDebuggerAttached)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Tamper detection error", e)
                }

                delay(TAMPER_CHECK_INTERVAL_MS)
            }
        }
    }

    /**
     * Multi-signal root detection:
     * 1. Check for known su binary paths
     * 2. Check Build.TAGS for "test-keys"
     * 3. Check for common root management apps
     */
    private fun checkForRoot(): Boolean {
        // Signal 1: su binary in known locations
        val suPaths = listOf(
            "/system/xbin/su",
            "/system/bin/su",
            "/sbin/su",
            "/system/su",
            "/system/bin/.ext/.su",
            "/system/usr/we-need-root/su-backup",
            "/system/app/Superuser.apk"
        )
        val suFound = suPaths.any { File(it).exists() }

        // Signal 2: Build tags indicate a test build (often rooted)
        val testKeys = Build.TAGS?.contains("test-keys") == true

        // Signal 3: Known root management packages installed
        val rootPackages = listOf(
            "com.topjohnwu.magisk",
            "eu.chainfire.supersu",
            "com.koushikdutta.superuser",
            "com.noshufou.android.su"
        )
        val rootAppInstalled = rootPackages.any { pkg ->
            try {
                packageManager.getPackageInfo(pkg, 0)
                true
            } catch (e: Exception) {
                false
            }
        }

        return suFound || testKeys || rootAppInstalled
    }

    /**
     * Detect if a debugger is attached — a sign the child may be
     * trying to step through enforcement logic.
     */
    private fun checkForDebugger(): Boolean {
        return android.os.Debug.isDebuggerConnected() ||
                android.os.Debug.waitingForDebugger()
    }

    /**
     * On tamper detection (per the security skill, in order):
     * (a) Log locally
     * (b) Attempt immediate server notification
     * (c) Apply local fallback lockdown (most restrictive ruleset)
     *     — do this even if step (b) fails.
     *
     * Never expose the specific detection method in user-facing
     * error messages.
     */
    private suspend fun handleTamperDetected(
        isRooted: Boolean,
        isDebuggerAttached: Boolean
    ) {
        // (a) Log locally — details are logged for debugging but
        //     never shown to the child in any UI string.
        Log.w(TAG, "Tamper detected — root:$isRooted debug:$isDebuggerAttached")

        // (b) Engage the most-restrictive lockdown: from now on the
        //     repository refuses to weaken the enforced ruleset on
        //     sync (fail-closed hardening). Persisted immediately so
        //     any in-flight sync cannot lift blocks.
        tamperState.lockdown = true

        // (c) Attempt server notification — best effort. Even if this
        //     fails (offline), the local lockdown above still applies.
        val details = buildString {
            append("root=").append(isRooted)
            append(" debugger=").append(isDebuggerAttached)
        }
        val acknowledged = repository.reportTamper(getDeviceIdentifier(), details)
        if (acknowledged) {
            Log.i(TAG, "Tamper alert sent to server")
        } else {
            Log.e(TAG, "Failed to notify server of tamper — local lockdown remains active")
        }

        Log.w(TAG, "Tamper lockdown active — enforcement at maximum restriction")
    }

    // ── Notification (required for Foreground Service) ────────────

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "SafeGuard Protection",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "SafeGuard is actively protecting this device"
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("SafeGuard Active")
            .setContentText("Device protection is running")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build()
    }

    // ── Helpers ───────────────────────────────────────────────────

    /**
     * The device registration ID returned by the backend during
     * onboarding. Empty only before onboarding completes — the
     * foreground service does not run before then.
     */
    private fun getDeviceIdentifier(): String {
        return onboardingStore.deviceId ?: ""
    }

    companion object {
        private const val TAG = "AppBlockingService"
        private const val CHANNEL_ID = "safeguard_protection"
        private const val NOTIFICATION_ID = 1001
        private const val MONITORING_INTERVAL_MS = 1000L           // 1 second
        private const val MONITORING_WINDOW_MS = 2000L             // 2 seconds
        private const val TAMPER_CHECK_INTERVAL_MS = 30_000L       // 30 seconds
    }
}
