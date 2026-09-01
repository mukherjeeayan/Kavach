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
 * Receives server-initiated pushes (unblock approved/declined, SOS,
 * geofence, keyword, self-harm, general alerts) and surfaces them as
 * local notifications with deep links into the right dashboard tab.
 *
 * Each notification type is routed to its own [NotificationChannel] so
 * the user can tune importance / sound per category. Fire-and-forget:
 * data messages never block the main thread.
 *
 * The service is only reachable by the OS when FCM is configured for
 * this build (google-services.json present); [FcmTokenSyncWorker] and
 * this class are no-ops otherwise.
 */
class SafeGuardMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        // Channels may not exist yet on a cold-start (FCM can wake the
        // process directly), so make sure they are registered first.
        ensureChannel(this)

        val data = message.data
        val type = data["type"]
        val title = data["title"] ?: type ?: return
        val body = data["body"] ?: data["rule_id"] ?: ""

        val childId = data["child_id"]
        val alertId = data["alert_id"]
        val packageName = data["package_name"]
        val rewardId = data["reward_id"]

        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) return

        val (channelId, priority) = channelFor(type)
        val tapIntent = NotificationHandler.buildOpenIntent(
            context = this,
            type = type,
            childId = childId,
            alertId = alertId,
            packageName = packageName,
            rewardId = rewardId
        )

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_safeguard)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(priority)
            .setAutoCancel(true)
            .setContentIntent(tapIntent)

        attachActionFor(builder, type, childId, alertId, packageName)

        NotificationManagerCompat.from(this).notify(
            (System.currentTimeMillis() and 0xFFFF).toInt(),
            builder.build()
        )
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

    /**
     * Adds a context-appropriate action button. We reuse the same deep
     * link infrastructure as the main tap — the destination screen
     * uses the extras to decide what to render.
     */
    private fun attachActionFor(
        builder: NotificationCompat.Builder,
        type: String?,
        childId: String?,
        alertId: String?,
        packageName: String?
    ) {
        when (type) {
            NotificationHandler.TYPE_UNBLOCK_APPROVED -> {
                val openApp = NotificationHandler.buildOpenIntent(
                    context = this,
                    type = NotificationHandler.TYPE_UNBLOCK_APPROVED,
                    childId = childId,
                    alertId = alertId,
                    packageName = packageName
                )
                builder.addAction(
                    NotificationCompat.Action.Builder(
                        android.R.drawable.ic_media_play,
                        "Open App",
                        openApp
                    ).build()
                )
            }
            NotificationHandler.TYPE_SOS -> {
                val viewLocation = NotificationHandler.buildOpenIntent(
                    context = this,
                    type = NotificationHandler.TYPE_SOS,
                    childId = childId,
                    alertId = alertId,
                    packageName = packageName
                )
                builder.addAction(
                    NotificationCompat.Action.Builder(
                        android.R.drawable.ic_menu_mapmode,
                        "View Location",
                        viewLocation
                    ).build()
                )
            }
        }
    }

    /**
     * Returns the channel id and priority level appropriate for the
     * notification [type]. Importance is encoded per category so SOS
     * breaks through Do Not Disturb while routine alerts remain quiet.
     */
    private fun channelFor(type: String?): Pair<String, Int> = when (type) {
        NotificationHandler.TYPE_SOS ->
            CHANNEL_SOS to NotificationCompat.PRIORITY_MAX
        NotificationHandler.TYPE_GEOFENCE ->
            CHANNEL_GEOFENCE to NotificationCompat.PRIORITY_HIGH
        NotificationHandler.TYPE_SELFHARM ->
            CHANNEL_ALERT to NotificationCompat.PRIORITY_HIGH
        NotificationHandler.TYPE_UNBLOCK_APPROVED,
        NotificationHandler.TYPE_UNBLOCK_REJECTED ->
            CHANNEL_ALERT to NotificationCompat.PRIORITY_DEFAULT
        NotificationHandler.TYPE_KEYWORD,
        NotificationHandler.TYPE_ALERT ->
            CHANNEL_ALERT to NotificationCompat.PRIORITY_DEFAULT
        else ->
            CHANNEL_GENERAL to NotificationCompat.PRIORITY_DEFAULT
    }

    companion object {
        const val CHANNEL_GENERAL = "safeguard_parent_notifications"
        const val CHANNEL_SOS = "sos_channel"
        const val CHANNEL_GEOFENCE = "geofence_channel"
        const val CHANNEL_ALERT = "alert_channel"
        const val FCM_TOKEN_WORK = "fcm_token_sync"

        /** Idempotent channel setup; safe to call from anywhere. */
        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_GENERAL,
                    "Parent notifications",
                    NotificationManager.IMPORTANCE_DEFAULT
                )
            )
            // SOS is maximum importance — must break through DND.
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_SOS,
                    "SOS alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Emergency SOS triggers from the child device"
                    enableVibration(true)
                    setBypassDnd(true)
                }
            )
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_GEOFENCE,
                    "Geofence alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Child entered or left a monitored area"
                }
            )
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ALERT,
                    "Alerts",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Unblock outcomes, keyword and self-harm alerts"
                }
            )
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
