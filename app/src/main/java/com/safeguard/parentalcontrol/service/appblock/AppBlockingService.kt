package com.safeguard.parentalcontrol.service.appblock

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import com.safeguard.parentalcontrol.BuildConfig
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.data.local.entity.ScheduledLockEntity
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
import com.safeguard.parentalcontrol.repository.phase1.Phase1Repository
import com.safeguard.parentalcontrol.security.SafeGuardDeviceAdminReceiver
import com.safeguard.parentalcontrol.security.TamperDetector
import com.safeguard.parentalcontrol.security.TamperState
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
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

    @Inject
    lateinit var phase1Repository: Phase1Repository

    private val serviceScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var monitoringJob: Job? = null
    private var tamperCheckJob: Job? = null
    private var lockNotifyJob: Job? = null

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

    // elapsedRealtime at the previous loop tick, for accurate per-tick
    // usage accounting (a "1 second" tick can run long under load).
    private var lastTickElapsed: Long = SystemClock.elapsedRealtime()

    // Per-app daily caps (package -> minutes, from Room rules). Apps
    // whose today's usage reaches the cap are treated as blocked.
    @Volatile
    private var limitedPackages: Map<String, Int> = emptyMap()

    // Today's usage per package (seconds), seeded from Room at start
    // and incremented every tick. Used only for cap enforcement.
    private val todayUsageSeconds = mutableMapOf<String, Int>()
    private var usageDayKey: String? = null

    // Lock-window warnings already shown today (key = window id + date),
    // so the child isn't spammed every minute before a window.
    private val notifiedWindowKeys = mutableSetOf<String>()
    private var lastNotifiedDay: String? = null

    // Packages that had a pending unblock request on the previous rules
    // emission; used to detect approvals/rejections arriving from sync.
    private var previousPendingUnblocks: Set<String> = emptySet()

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

                limitedPackages = rules
                    .filter { it.dailyLimitMinutes != null && it.dailyLimitMinutes!! > 0 }
                    .associate { it.packageName to it.dailyLimitMinutes!! }

                if (BuildConfig.DEBUG) {
                    Log.d(TAG, "Blocked list updated: ${blockedPackages.size} apps, ${limitedPackages.size} with daily caps")
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

        // Watch for unblock requests that got approved or declined on
        // the server — the child should hear the outcome immediately.
        serviceScope.launch {
            repository.getAllRulesFlow(getDeviceIdentifier()).collect { rules ->
                val currentPending = rules
                    .filter { it.unblockRequested }
                    .map { it.packageName }
                    .toSet()
                for (packageName in previousPendingUnblocks - currentPending) {
                    val rule = rules.find { it.packageName == packageName }
                    if (rule == null) continue
                    if (rule.isBlocked) {
                        postAlertNotification(
                            "Unblock request declined",
                            "${rule.appName ?: packageName} stays blocked."
                        )
                    } else {
                        postAlertNotification(
                            "Unblock approved",
                            "${rule.appName ?: packageName} is unlocked now."
                        )
                    }
                }
                previousPendingUnblocks = currentPending
            }
        }

        startMonitoring()
        startTamperDetection()
        startLockNotificationWatch()

        // Report the current device-admin state on every (re)start so
        // the server's "protected" flag stays fresh even if the
        // enable/disable broadcast was missed (e.g. while offline).
        reportAdminStatus()
    }

    /**
     * Best-effort sync of the current device-admin state. Reads the
     * live DevicePolicyManager answer — never a cached assumption.
     */
    private fun reportAdminStatus() {
        val deviceId = getDeviceIdentifier()
        if (deviceId.isEmpty()) return
        serviceScope.launch {
            try {
                val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
                val admin = ComponentName(this@AppBlockingService, SafeGuardDeviceAdminReceiver::class.java)
                val active = dpm.isAdminActive(admin)
                phase1Repository.reportAdminStatus(deviceId, active)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to report admin status: ${e.message}")
            }
        }
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
        lockNotifyJob?.cancel()
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

            // Seed today's usage from Room so caps survive a service
            // restart (server keeps the authoritative total; the local
            // count drives enforcement between syncs).
            try {
                val today = dayKey()
                usageDayKey = today
                screenTimeDao.getByDate(today).forEach {
                    todayUsageSeconds[it.appPackage] = it.seconds
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to seed today's usage: ${e.message}")
            }

            while (isActive) {
                // Measure the real elapsed time per iteration — under
                // GC/CPU contention a "1 second" tick can take longer,
                // which would otherwise under-count screen time.
                val tickStart = SystemClock.elapsedRealtime()
                try {
                    val currentForegroundPackage = getCurrentForegroundApp(usageStatsManager)
                    val lockActive = isLockWindowActive()

                    // Midnight rollover: fresh counters for the new day.
                    // Checked unconditionally (not only when a foreground
                    // app is present) so usage right after midnight with
                    // the screen off can never be misattributed to the
                    // previous day.
                    val today = dayKey()
                    if (usageDayKey != today) {
                        usageDayKey = today
                        usageAccumulator.clear()
                        todayUsageSeconds.clear()
                    }

                    if (currentForegroundPackage != null) {

                        val elapsedSeconds =
                            ((tickStart - lastTickElapsed + 500) / 1000).coerceAtLeast(1L)

                        todayUsageSeconds[currentForegroundPackage] =
                            (todayUsageSeconds[currentForegroundPackage] ?: 0) + elapsedSeconds.toInt()

                        val overDailyLimit = limitedPackages[currentForegroundPackage]
                            ?.let { limitMinutes ->
                                (todayUsageSeconds[currentForegroundPackage] ?: 0) >=
                                    limitMinutes * 60
                            } ?: false

                        if (lockActive) {
                            // Scheduled lock window: allow only the
                            // launcher, system UI, settings and ourselves.
                            if (currentForegroundPackage !in lockAllowlist()) {
                                killBlockedApp(activityManager, currentForegroundPackage)
                            }
                        } else if (
                            blockedPackages.contains(currentForegroundPackage) ||
                            overDailyLimit
                        ) {
                            if (currentForegroundPackage != packageName) { // Never block ourselves
                                killBlockedApp(activityManager, currentForegroundPackage)
                            }
                        }

                        // Screen-time recording (per-app foreground seconds)
                        usageAccumulator[currentForegroundPackage] =
                            (usageAccumulator[currentForegroundPackage] ?: 0) + elapsedSeconds.toInt()
                    }

                    if (++usageTicks >= SCREEN_TIME_FLUSH_TICKS) {
                        usageTicks = 0
                        flushUsageAccumulator()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error in monitoring loop", e)
                    // Never crash — log and continue (mandatory per Android skill)
                } finally {
                    lastTickElapsed = tickStart
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
        val today = dayKey()
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

    private fun dayKey(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    // ── Scheduled Lock Window Warning ───────────────────────────────

    private fun startLockNotificationWatch() {
        lockNotifyJob = serviceScope.launch {
            while (isActive) {
                try {
                    checkUpcomingLockWindows()
                } catch (e: Exception) {
                    Log.e(TAG, "Error checking lock windows", e)
                }
                delay(LOCK_WATCH_INTERVAL_MS)
            }
        }
    }

    /**
     * Posts a one-time warning when an active lock window starts
     * within the next [LOCK_WARN_BEFORE_MINUTES]. One notification per
     * window per day — never a per-minute spam.
     */
    private fun checkUpcomingLockWindows() {
        val now = Calendar.getInstance()
        val minutesNow = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        val todayDow = now.get(Calendar.DAY_OF_WEEK) - 1 // 0=Sunday..6=Saturday
        val todayKey = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

        // New day: forget yesterday's notifications.
        if (lastNotifiedDay != todayKey) {
            notifiedWindowKeys.clear()
            lastNotifiedDay = todayKey
        }

        for (window in lockWindows) {
            if (!window.isActive) continue
            if (window.deviceId != null && window.deviceId != getDeviceIdentifier()) continue
            if (window.dayOfWeek != null && window.dayOfWeek != todayDow) continue

            val start = parseMinutes(window.startTime) ?: continue
            // Window already running (or started long ago) — the
            // monitoring loop handles enforcement; nothing to warn.
            if (start <= minutesNow) continue
            val minutesUntilStart = start - minutesNow
            if (minutesUntilStart > LOCK_WARN_BEFORE_MINUTES) continue

            val key = "${window.id}:$todayKey"
            if (key in notifiedWindowKeys) continue
            notifiedWindowKeys.add(key)

            postAlertNotification(
                "Lock window approaching",
                "Apps will be locked at ${window.startTime}. Finish up soon."
            )
            Log.i(TAG, "Posted lock window warning (start ${window.startTime}, in $minutesUntilStart min)")
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

        // (b2) Immediately lock the screen via the device admin — the
        //      child is kicked out of whatever they were doing while
        //      we triage. Best-effort; the device admin may not be
        //      active on every install.
        lockDeviceNow()

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

    /**
     * Locks the device screen immediately through the device admin.
     * A rooted/debugged device should not get to keep using apps while
     * the parent is being notified. No-op without an active admin.
     */
    private fun lockDeviceNow() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(this, SafeGuardDeviceAdminReceiver::class.java)
            if (dpm.isAdminActive(admin)) {
                dpm.lockNow()
            }
        } catch (e: Exception) {
            Log.w(TAG, "lockNow failed (admin likely inactive): ${e.message}")
        }
    }

    // ── Notification (required for Foreground Service) ────────────

    private fun createNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java)

        val protectionChannel = NotificationChannel(
            CHANNEL_ID,
            "SafeGuard Protection",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "SafeGuard is actively protecting this device"
        }
        manager.createNotificationChannel(protectionChannel)

        // Alerts (lock warnings, unblock outcomes) are separate and
        // higher importance so they actually reach the child.
        val alertsChannel = NotificationChannel(
            ALERT_CHANNEL_ID,
            "SafeGuard Alerts",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Warnings and request outcomes"
        }
        manager.createNotificationChannel(alertsChannel)
    }

    /** Posts a transient (auto-dismissing) alert notification. */
    private fun postAlertNotification(title: String, text: String) {
        try {
            val notification = Notification.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setAutoCancel(true)
                .build()
            getSystemService(NotificationManager::class.java)
                .notify(ALERT_NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to post alert notification", e)
        }
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
        private const val ALERT_CHANNEL_ID = "safeguard_alerts"
        private const val NOTIFICATION_ID = 1001
        private const val ALERT_NOTIFICATION_ID = 1002
        private const val MONITORING_INTERVAL_MS = 1000L           // 1 second
        private const val MONITORING_WINDOW_MS = 2000L             // 2 seconds
        private const val TAMPER_CHECK_INTERVAL_MS = 30_000L       // 30 seconds
        private const val SCREEN_TIME_FLUSH_TICKS = 10             // flush every ~10s (limits loss on process death)
        private const val LOCK_WATCH_INTERVAL_MS = 60_000L         // 1 minute
        private const val LOCK_WARN_BEFORE_MINUTES = 10            // warn 10 min ahead
    }
}
