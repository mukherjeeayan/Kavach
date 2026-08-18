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
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.data.local.entity.ScheduledLockEntity
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
import com.safeguard.parentalcontrol.security.TamperDetector
import com.safeguard.parentalcontrol.security.TamperState
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
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

    @Inject
    lateinit var screenTimeDao: ScreenTimeDao

    @Inject
    lateinit var scheduledLockDao: ScheduledLockDao

    private val serviceScope = CoroutineScope(Dispatchers.Default + Job())
    private var monitoringJob: Job? = null
    private var tamperCheckJob: Job? = null

    // In-memory cache refreshed from Room, used for O(1) lookups
    // during the 1-second polling loop.
    @Volatile
    private var blockedPackages: Set<String> = emptySet()

    // Scheduled lock windows cached from Room (server-synced).
    @Volatile
    private var lockWindows: List<ScheduledLockEntity> = emptyList()

    // Foreground-time accumulation between DB flushes (screen time).
    private val usageAccumulator = mutableMapOf<String, Int>()
    private var usageTicks = 0

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

        // Keep scheduled lock windows in memory (server-synced by the
        // periodic worker); enforcement evaluates them every tick.
        serviceScope.launch {
            scheduledLockDao.getAll().collect { locks ->
                lockWindows = locks
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
                    val lockActive = isLockWindowActive()

                    if (currentForegroundPackage != null) {
                        if (lockActive) {
                            // Scheduled lock window: allow only the
                            // launcher, system UI, settings and ourselves.
                            if (currentForegroundPackage !in lockAllowlist()) {
                                killBlockedApp(activityManager, currentForegroundPackage)
                            }
                        } else if (
                            blockedPackages.contains(currentForegroundPackage) &&
                            currentForegroundPackage != packageName // Never block ourselves
                        ) {
                            killBlockedApp(activityManager, currentForegroundPackage)
                        }

                        // Screen-time recording (per-app foreground seconds)
                        usageAccumulator[currentForegroundPackage] =
                            (usageAccumulator[currentForegroundPackage] ?: 0) + 1
                    }

                    if (++usageTicks >= SCREEN_TIME_FLUSH_TICKS) {
                        usageTicks = 0
                        flushUsageAccumulator()
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

    /**
     * True when the current time falls inside any active lock window
     * that targets this device (or all devices). Backend encodes
     * day_of_week as 0=Sunday..6=Saturday; null = every day.
     */
    private fun isLockWindowActive(): Boolean {
        val now = Calendar.getInstance()
        val minutesNow = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        val todayDow = now.get(Calendar.DAY_OF_WEEK) - 1 // 0=Sunday..6=Saturday

        return lockWindows.any { window ->
            if (!window.isActive) return@any false
            if (window.deviceId != null && window.deviceId != getDeviceIdentifier()) {
                return@any false
            }
            if (window.dayOfWeek != null && window.dayOfWeek != todayDow) {
                return@any false
            }

            val start = parseMinutes(window.startTime)
            val end = parseMinutes(window.endTime)
            if (start == null || end == null) return@any false

            if (start <= end) {
                minutesNow in start until end
            } else {
                // Window crosses midnight (e.g. 22:00 -> 02:00)
                minutesNow >= start || minutesNow < end
            }
        }
    }

    /**
     * Packages that must stay usable even during a lock window:
     * our own app (parent access), the launcher, system UI and
     * settings (permission granting must remain possible).
     */
    private fun lockAllowlist(): Set<String> {
        val allowlist = mutableSetOf(
            packageName,
            "com.android.systemui",
            "com.android.settings"
        )
        val launcher = packageManager.resolveActivity(
            Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME),
            0
        )?.activityInfo?.packageName
        if (launcher != null) allowlist.add(launcher)
        return allowlist
    }

    private fun parseMinutes(hhmm: String): Int? {
        val parts = hhmm.split(":")
        if (parts.size != 2) return null
        val hours = parts[0].toIntOrNull() ?: return null
        val minutes = parts[1].toIntOrNull() ?: return null
        return hours * 60 + minutes
    }

    /**
     * Writes accumulated foreground seconds into Room. Rows are
     * "since last successful upload" deltas; the periodic sync worker
     * uploads and clears them.
     */
    private suspend fun flushUsageAccumulator() {
        if (usageAccumulator.isEmpty()) return
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val snapshot = usageAccumulator.toMap()
        usageAccumulator.clear()
        for ((pkg, seconds) in snapshot) {
            if (seconds <= 0) continue
            try {
                screenTimeDao.addSeconds(pkg, null, seconds, today)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to record screen time for $pkg", e)
            }
        }
    }

    // ── Tamper / Root / Bypass Detection ──────────────────────────
    // Security skill: combine multiple signals — never rely on one.

    private fun startTamperDetection() {
        tamperCheckJob = serviceScope.launch {
            while (isActive) {
                try {
                    val isRooted = TamperDetector.isRooted(this@AppBlockingService)
                    val isDebuggerAttached = TamperDetector.isDebuggerAttached()

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
        private const val SCREEN_TIME_FLUSH_TICKS = 30             // flush every ~30s
    }
}
