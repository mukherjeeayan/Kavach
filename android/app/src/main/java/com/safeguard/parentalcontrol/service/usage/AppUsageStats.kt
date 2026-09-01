package com.safeguard.parentalcontrol.service.usage

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Collects app usage data via [UsageStatsManager] and persists
 * aggregated foreground seconds to the local Room database.
 * Also exposes an event stream for restricted-app usage alerts.
 */
@Singleton
class AppUsageStats @Inject constructor(
    private val screenTimeDao: ScreenTimeDao
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _restrictedAppUsed = MutableSharedFlow<RestrictedAppEvent>(extraBufferCapacity = 16)
    val restrictedAppUsed = _restrictedAppUsed.asSharedFlow()

    data class RestrictedAppEvent(
        val packageName: String,
        val appName: String?,
        val timestamp: Long
    )

    /**
     * Queries [UsageStatsManager] for usage events since the last
     * collection timestamp and writes accumulated foreground seconds
     * into [ScreenTimeDao].
     *
     * @param context Application context (not Activity).
     * @param restrictedPackages Set of package names that are restricted.
     * @param sinceTimestamp Epoch millis of the last collection. Pass 0
     *   to collect all available data (up to the system's retention limit).
     * @return The timestamp of the latest event processed (pass as
     *   [sinceTimestamp] on the next call).
     */
    suspend fun collectUsageData(
        context: Context,
        restrictedPackages: Set<String>,
        sinceTimestamp: Long = 0L
    ): Long {
        val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE)
            as? UsageStatsManager ?: return sinceTimestamp

        val endTime = System.currentTimeMillis()
        val startTime = if (sinceTimestamp > 0) sinceTimestamp else endTime - ONE_DAY_MS

        val events = usageStatsManager.queryEvents(startTime, endTime)
        val foregroundEventType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            UsageEvents.Event.ACTIVITY_RESUMED
        } else {
            UsageEvents.Event.MOVE_TO_FOREGROUND
        }

        val usageAccumulator = mutableMapOf<String, Int>()
        var lastEventTime = sinceTimestamp
        val event = UsageEvents.Event()

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == foregroundEventType) {
                lastEventTime = maxOf(lastEventTime, event.timeStamp)
                val pkg = event.packageName
                // Approximate: each resume adds ~1 second until next event
                usageAccumulator[pkg] = (usageAccumulator[pkg] ?: 0) + 1

                if (pkg in restrictedPackages) {
                    _restrictedAppUsed.tryEmit(
                        RestrictedAppEvent(
                            packageName = pkg,
                            appName = resolveAppName(context, pkg),
                            timestamp = event.timeStamp
                        )
                    )
                }
            }
        }

        // Persist to Room
        val today = todayKey()
        for ((pkg, seconds) in usageAccumulator) {
            if (seconds <= 0) continue
            try {
                screenTimeDao.addSeconds(pkg, null, seconds, today)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to record usage for $pkg", e)
            }
        }

        return lastEventTime
    }

    /**
     * Returns today's accumulated usage seconds for a specific package.
     */
    suspend fun getTodayUsageSeconds(context: Context, packageName: String): Int {
        val today = todayKey()
        val entries = screenTimeDao.getByDate(today)
        return entries.filter { it.appPackage == packageName }.sumOf { it.seconds }
    }

    /**
     * Returns all today's usage entries.
     */
    suspend fun getTodayUsage(): List<com.safeguard.parentalcontrol.data.local.entity.ScreenTimeDailyEntity> {
        return screenTimeDao.getByDate(todayKey())
    }

    private fun resolveAppName(context: Context, packageName: String): String? {
        return try {
            val pm = context.packageManager
            val appInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getApplicationInfo(packageName, 0)
            }
            pm.getApplicationLabel(appInfo).toString()
        } catch (_: Exception) {
            null
        }
    }

    private fun todayKey(): String =
        LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US))

    companion object {
        private const val TAG = "AppUsageStats"
        private const val ONE_DAY_MS = 24L * 60 * 60 * 1000
    }
}
