package com.safeguard.parentalcontrol.work

import android.app.NotificationManager
import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.hilt.work.HiltWorker
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.ScreenTimeLimitPreferences
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.notifications.SafeGuardMessagingService
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import androidx.core.content.edit
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Periodic worker that enforces the overall screen time limit.
 * Reads the current day's total usage from Room, sends a notification
 * when the limit is exceeded, and persists an "overall limit exceeded"
 * flag that the foreground service reads to start blocking
 * non-essential apps (the same way it would during a bedtime lock
 * window).
 */
@HiltWorker
class OnlyWorkWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val screenTimeDao: ScreenTimeDao,
    private val onboardingStore: OnboardingStore,
    private val limitPreferences: ScreenTimeLimitPreferences
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        if (onboardingStore.deviceId == null) return Result.success()
        if (!limitPreferences.enabled) {
            // Limit is off — make sure any stale "exceeded" flag from
            // a previous day is cleared so the service stops blocking.
            clearExceededFlag()
            return Result.success()
        }

        return try {
            val today = dayKey()
            val entries = screenTimeDao.getByDate(today)
            val totalSeconds = entries.sumOf { it.seconds }
            val totalMinutes = totalSeconds / 60
            val dailyLimitMinutes = limitPreferences.dailyLimitMinutes

            if (totalMinutes >= dailyLimitMinutes) {
                if (!isExceededFlagSet()) {
                    sendLimitNotification(totalMinutes, dailyLimitMinutes)
                }
                setExceededFlag(true)
                Log.i(TAG, "Screen time limit exceeded: ${totalMinutes}min / ${dailyLimitMinutes}min")
            } else {
                // Back under the limit (e.g. after midnight rollover or
                // a new cap). Clear the flag so the service unblocks.
                clearExceededFlag()
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "OnlyWorkWorker failed", e)
            Result.retry()
        }
    }

    private fun setExceededFlag(value: Boolean) {
        exceededPrefs().edit { putBoolean(KEY_EXCEEDED, value) }
    }

    private fun clearExceededFlag() {
        setExceededFlag(false)
    }

    private fun isExceededFlagSet(): Boolean =
        exceededPrefs().getBoolean(KEY_EXCEEDED, false)

    private fun exceededPrefs(): SharedPreferences {
        val masterKey = MasterKey.Builder(applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            applicationContext,
            PREFS_EXCEEDED,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private fun sendLimitNotification(usedMinutes: Int, limitMinutes: Int) {
        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
            as NotificationManager
        SafeGuardMessagingService.ensureChannel(applicationContext)

        val notification = NotificationCompat.Builder(applicationContext, SafeGuardMessagingService.CHANNEL_ALERT)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("Screen time limit reached")
            .setContentText("You've used ${usedMinutes} minutes today (limit: ${limitMinutes} min). Non-essential apps are now locked.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun dayKey(): String =
        LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US))

    companion object {
        private const val TAG = "OnlyWorkWorker"
        private const val NOTIFICATION_ID = 2001

        // SharedPreferences key the AppBlockingService reads to decide
        // whether to apply the overall-limit lockdown. Lives in a
        // separate prefs file so it can be cleared independently of
        // the user-configured cap.
        const val PREFS_EXCEEDED = "safeguard_overall_limit"
        const val KEY_EXCEEDED = "limit_exceeded"
    }
}
