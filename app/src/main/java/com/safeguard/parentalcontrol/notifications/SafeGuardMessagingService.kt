package com.safeguard.parentalcontrol.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.safeguard.parentalcontrol.BuildConfig
import com.safeguard.parentalcontrol.R
import com.safeguard.parentalcontrol.work.FcmTokenSyncWorker

/**
 * Receives server-initiated pushes (unblock approved/declined, new
 * blocks, limit changes) and surfaces them as local notifications.
 * Fire-and-forget: data messages never block the main thread.
 *
 * The service is only reachable by the OS when FCM is configured for
 * this build (google-services.json present); [FcmTokenSyncWorker] and
 * this class are no-ops otherwise.
 */
class SafeGuardMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title = data["title"] ?: data["type"] ?: return
        val body = data["body"] ?: data["rule_id"] ?: ""

        if (NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            val notification = NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_safeguard)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .build()
            NotificationManagerCompat.from(this).notify(
                (System.currentTimeMillis() and 0xFFFF).toInt(),
                notification
            )
        }
    }

    override fun onNewToken(token: String) {
        // Register the rotated token with the backend. WorkManager
        // retries on failure, and the periodic sync picks it up too.
        WorkManager.getInstance(this).enqueueUniqueWork(
            FCM_TOKEN_WORK,
            ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<FcmTokenSyncWorker>().build()
        )
    }

    companion object {
        const val CHANNEL_ID = "safeguard_parent_notifications"
        const val FCM_TOKEN_WORK = "fcm_token_sync"

        /** Idempotent channel setup; safe to call from anywhere. */
        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Parent notifications",
                    NotificationManager.IMPORTANCE_DEFAULT
                )
                val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.createNotificationChannel(channel)
            }
        }

        /** Guarded Firebase token sync — no-op when FCM is disabled. */
        fun syncToken(context: Context) {
            if (!BuildConfig.FCM_ENABLED) return
            WorkManager.getInstance(context).enqueueUniqueWork(
                FCM_TOKEN_WORK,
                ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<FcmTokenSyncWorker>().build()
            )
        }
    }
}