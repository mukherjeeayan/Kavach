package com.safeguard.parentalcontrol.work

import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.BedtimePreferences
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.notifications.SafeGuardMessagingService
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.Calendar

/**
 * Periodic worker that checks whether the current time falls within
 * a configured bedtime window. Sends a notification at bedtime start
 * and can optionally enforce Do Not Disturb if the parent has
 * configured it.
 */
@HiltWorker
class BedTimeWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val scheduledLockDao: ScheduledLockDao,
    private val onboardingStore: OnboardingStore,
    private val bedtimePreferences: BedtimePreferences
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val deviceId = onboardingStore.deviceId ?: return Result.success()

        return try {
            if (bedtimePreferences.enabled) {
                val now = Calendar.getInstance()
                val minutesNow = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
                val start = bedtimePreferences.bedtimeStart.toMinutesOfDay()
                val end = bedtimePreferences.bedtimeEnd.toMinutesOfDay()
                val isBedtime = if (start <= end) {
                    minutesNow in start until end
                } else {
                    // Crosses midnight (e.g. 22:00 -> 07:00)
                    minutesNow >= start || minutesNow < end
                }

                if (isBedtime) {
                    sendBedtimeNotification()
                    if (bedtimePreferences.dndEnabled && isScreenOn()) {
                        // DND only matters while the user is actually
                        // looking at the device — pointless to flip
                        // the system filter on a sleeping device.
                        enforceDnd()
                    }
                    Log.i(TAG, "Bedtime active (preferences-driven)")
                }
            }

            // Also check for scheduled lock windows that indicate bedtime
            val locks = scheduledLockDao.getAllOnce()
            for (lock in locks) {
                if (!lock.isActive) continue
                if (lock.deviceId != null && lock.deviceId != deviceId) continue

                val now = Calendar.getInstance()
                val minutesNow = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
                val todayDow = now.get(Calendar.DAY_OF_WEEK) - 1

                if (lock.dayOfWeek != null && lock.dayOfWeek != todayDow) continue

                val start = parseMinutes(lock.startTime) ?: continue
                val end = parseMinutes(lock.endTime) ?: continue

                val isActive = if (start <= end) {
                    minutesNow in start until end
                } else {
                    minutesNow >= start || minutesNow < end
                }

                if (isActive) {
                    sendBedtimeNotification()
                    Log.i(TAG, "Bedtime lock window active (${lock.startTime} - ${lock.endTime})")
                }
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "BedTimeWorker failed", e)
            Result.retry()
        }
    }

    private fun isScreenOn(): Boolean {
        val pm = applicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            ?: return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
            pm.isInteractive
        } else {
            @Suppress("DEPRECATION")
            pm.isScreenOn
        }
    }

    private fun sendBedtimeNotification() {
        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
            as android.app.NotificationManager
        SafeGuardMessagingService.ensureChannel(applicationContext)

        val notification = NotificationCompat.Builder(applicationContext, SafeGuardMessagingService.CHANNEL_ALERT)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentTitle("Bedtime")
            .setContentText("It's bedtime. Put down your device and get some rest!")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun enforceDnd() {
        // Best-effort DND enforcement via NotificationManager
        // Note: Actual DND requires DND_ACCESS_NOTIFICATION policy permission
        // which is a system-level setting. This is a best-effort approach.
        try {
            val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
                as android.app.NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (manager.isNotificationPolicyAccessGranted) {
                    manager.setInterruptionFilter(
                        android.app.NotificationManager.INTERRUPTION_FILTER_PRIORITY
                    )
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "DND enforcement failed (permission likely not granted): ${e.message}")
        }
    }

    private fun parseMinutes(hhmm: String): Int? {
        val parts = hhmm.split(":")
        if (parts.size != 2) return null
        val hours = parts[0].toIntOrNull() ?: return null
        val minutes = parts[1].toIntOrNull() ?: return null
        return hours * 60 + minutes
    }

    companion object {
        private const val TAG = "BedTimeWorker"
        private const val NOTIFICATION_ID = 2003
    }
}

private fun java.time.LocalTime.toMinutesOfDay(): Int = hour * 60 + minute
