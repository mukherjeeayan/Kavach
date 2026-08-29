package com.safeguard.parentalcontrol.work

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.entity.ScheduledLockEntity
import com.safeguard.parentalcontrol.notifications.SafeGuardMessagingService
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.Calendar
import java.util.Locale

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
    private val onboardingStore: OnboardingStore
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val deviceId = onboardingStore.deviceId ?: return Result.success()

        return try {
            val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val bedtimeStart = prefs.getString(KEY_BEDTIME_START, null)
            val bedtimeEnd = prefs.getString(KEY_BEDTIME_END, null)
            val dndEnabled = prefs.getBoolean(KEY_DND_ENABLED, false)

            if (bedtimeStart != null && bedtimeEnd != null) {
                val now = Calendar.getInstance()
                val minutesNow = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
                val start = parseMinutes(bedtimeStart)
                val end = parseMinutes(bedtimeEnd)

                if (start != null && end != null) {
                    val isBedtime = if (start <= end) {
                        minutesNow in start until end
                    } else {
                        // Crosses midnight
                        minutesNow >= start || minutesNow < end
                    }

                    if (isBedtime) {
                        sendBedtimeNotification()
                        if (dndEnabled) {
                            enforceDnd()
                        }
                        Log.i(TAG, "Bedtime active ($bedtimeStart - $bedtimeEnd)")
                    }
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

    private fun sendBedtimeNotification() {
        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
            as NotificationManager
        SafeGuardMessagingService.ensureChannel(applicationContext)

        val notification = NotificationCompat.Builder(applicationContext, SafeGuardMessagingService.CHANNEL_ID)
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
                as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (manager.isNotificationPolicyAccessGranted) {
                    manager.setInterruptionFilter(
                        NotificationManager.INTERRUPTION_FILTER_PRIORITY
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
        private const val PREFS_NAME = "safeguard_bedtime"
        private const val KEY_BEDTIME_START = "bedtime_start"
        private const val KEY_BEDTIME_END = "bedtime_end"
        private const val KEY_DND_ENABLED = "dnd_enabled"
        private const val NOTIFICATION_ID = 2003
    }
}
