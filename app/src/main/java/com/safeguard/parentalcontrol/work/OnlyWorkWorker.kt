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
import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.notifications.SafeGuardMessagingService
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Periodic worker that enforces the overall screen time limit.
 * Reads the current day's total usage from Room and sends a
 * notification if it exceeds the configured maximum.
 */
@HiltWorker
class OnlyWorkWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val screenTimeDao: ScreenTimeDao,
    private val onboardingStore: OnboardingStore
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val childId = onboardingStore.childId ?: return Result.success()

        return try {
            val today = dayKey()
            val entries = screenTimeDao.getByDate(today)
            val totalSeconds = entries.sumOf { it.seconds }
            val totalMinutes = totalSeconds / 60

            // Default daily limit: 120 minutes (configurable via server sync)
            val dailyLimitMinutes = getDailyLimitFromPrefs()

            if (totalMinutes >= dailyLimitMinutes) {
                sendLimitNotification(totalMinutes, dailyLimitMinutes)
                Log.i(TAG, "Screen time limit exceeded: ${totalMinutes}min / ${dailyLimitMinutes}min")
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "OnlyWorkWorker failed", e)
            Result.retry()
        }
    }

    private fun getDailyLimitFromPrefs(): Int {
        val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getInt(KEY_DAILY_LIMIT, DEFAULT_DAILY_LIMIT_MINUTES)
    }

    private fun sendLimitNotification(usedMinutes: Int, limitMinutes: Int) {
        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
            as NotificationManager
        SafeGuardMessagingService.ensureChannel(applicationContext)

        val notification = NotificationCompat.Builder(applicationContext, SafeGuardMessagingService.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("Screen time limit reached")
            .setContentText("You've used ${usedMinutes} minutes today (limit: ${limitMinutes} min).")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun dayKey(): String =
        LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US))

    companion object {
        private const val TAG = "OnlyWorkWorker"
        private const val PREFS_NAME = "safeguard_screen_time_limits"
        private const val KEY_DAILY_LIMIT = "daily_limit_minutes"
        private const val DEFAULT_DAILY_LIMIT_MINUTES = 120
        private const val NOTIFICATION_ID = 2001
    }
}
