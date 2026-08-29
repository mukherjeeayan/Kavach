package com.safeguard.parentalcontrol.work

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.notifications.SafeGuardMessagingService
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * Periodic worker that checks whether the device has been stationary
 * for an extended period. If the last known location is older than
 * the configured threshold (default: 4 hours), a reminder notification
 * is sent to the child.
 */
@HiltWorker
class PickupReminderWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val locationDao: LocationDao,
    private val onboardingStore: OnboardingStore
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val deviceId = onboardingStore.deviceId ?: return Result.success()

        return try {
            val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val thresholdMinutes = prefs.getInt(KEY_THRESHOLD_MINUTES, DEFAULT_THRESHOLD_MINUTES)
            val thresholdMs = thresholdMinutes * 60 * 1000L

            val recentLocations = locationDao.getUnsynced()
            val lastLocation = recentLocations.maxByOrNull { it.recordedAt }

            if (lastLocation != null) {
                val elapsed = System.currentTimeMillis() - lastLocation.recordedAt
                if (elapsed >= thresholdMs) {
                    val hours = (elapsed / (60 * 60 * 1000)).toInt()
                    sendPickupReminder(hours)
                    Log.i(TAG, "Pickup reminder: device stationary for $hours hours")
                }
            } else {
                // No location data at all — send a reminder
                sendPickupReminder(-1)
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "PickupReminderWorker failed", e)
            Result.retry()
        }
    }

    private fun sendPickupReminder(hoursStationary: Int) {
        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
            as NotificationManager
        SafeGuardMessagingService.ensureChannel(applicationContext)

        val text = if (hoursStationary > 0) {
            "You haven't moved for $hoursStationary hours. Time to pick up your device!"
        } else {
            "Don't forget to keep your device with you!"
        }

        val notification = NotificationCompat.Builder(applicationContext, SafeGuardMessagingService.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Pickup reminder")
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        manager.notify(NOTIFICATION_ID, notification)
    }

    companion object {
        private const val TAG = "PickupReminderWorker"
        private const val PREFS_NAME = "safeguard_pickup_reminder"
        private const val KEY_THRESHOLD_MINUTES = "threshold_minutes"
        private const val DEFAULT_THRESHOLD_MINUTES = 240 // 4 hours
        private const val NOTIFICATION_ID = 2004
    }
}
