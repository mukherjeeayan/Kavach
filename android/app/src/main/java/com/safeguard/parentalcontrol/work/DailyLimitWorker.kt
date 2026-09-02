package com.safeguard.parentalcontrol.work

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.notifications.SafeGuardMessagingService
import com.safeguard.parentalcontrol.service.appblock.KioskActivity
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Periodic worker that checks per-app daily usage against the limits
 * configured in the app block rules. Sends a notification for each
 * app that exceeds its daily cap.
 */
@HiltWorker
class DailyLimitWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val screenTimeDao: ScreenTimeDao,
    private val appBlockRuleDao: AppBlockRuleDao,
    private val onboardingStore: OnboardingStore
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val deviceId = onboardingStore.deviceId ?: return Result.success()

        return try {
            val today = dayKey()
            val entries = screenTimeDao.getByDate(today)
            val rules = appBlockRuleDao.getBlockedAppsSnapshot(deviceId)

            // Build map of package -> daily limit minutes
            val limits = rules
                .filter { it.dailyLimitMinutes != null && it.dailyLimitMinutes > 0 }
                .associate { it.packageName to it.dailyLimitMinutes!! }

            for ((packageName, limitMinutes) in limits) {
                val usedSeconds = entries
                    .filter { it.appPackage == packageName }
                    .sumOf { it.seconds }
                val usedMinutes = usedSeconds / 60

                if (usedMinutes >= limitMinutes) {
                    sendLimitNotification(packageName, usedMinutes, limitMinutes)
                    launchKioskActivity(packageName, usedMinutes, limitMinutes)
                    Log.i(TAG, "App limit exceeded: $packageName ($usedMinutes >= $limitMinutes min)")
                }
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "DailyLimitWorker failed", e)
            Result.retry()
        }
    }

    private fun sendLimitNotification(packageName: String, usedMinutes: Int, limitMinutes: Int) {
        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
            as NotificationManager
        SafeGuardMessagingService.ensureChannel(applicationContext)

        val notification = NotificationCompat.Builder(applicationContext, SafeGuardMessagingService.CHANNEL_ALERT)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("App time limit reached")
            .setContentText("You've used $packageName for $usedMinutes min (limit: $limitMinutes min).")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        manager.notify(packageName.hashCode(), notification)
    }

    private fun launchKioskActivity(packageName: String, usedMinutes: Int, limitMinutes: Int) {
        try {
            val lockReason = "Daily limit reached: $packageName ($usedMinutes/$limitMinutes min)"
            val intent = KioskActivity.createIntent(
                context = applicationContext,
                lockReason = lockReason,
                lockType = "quota"
            )
            applicationContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch KioskActivity", e)
        }
    }

    private fun dayKey(): String =
        LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US))

    companion object {
        private const val TAG = "DailyLimitWorker"
    }
}
