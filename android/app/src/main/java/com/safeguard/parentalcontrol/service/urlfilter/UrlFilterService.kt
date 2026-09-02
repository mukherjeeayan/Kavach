package com.safeguard.parentalcontrol.service.urlfilter

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import com.safeguard.parentalcontrol.R

/**
 * Foreground service whose sole purpose is to give the URL-filter
 * accessibility service a stable anchor: the system keeps this
 * service alive (and therefore keeps the accessibility service
 * bound) even under memory pressure. The actual URL detection
 * happens in [UrlAccessibilityService] — this service does not run
 * any detection logic itself.
 *
 * The service is started by [SyncScheduler] after onboarding and
 * restarts itself via START_STICKY. It checks the accessibility
 * service enablement state but does not auto-prompt the user —
 * the enablement screen is presented by the parent-facing settings
 * UI to avoid surprising the child.
 */
class UrlFilterService : Service() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, buildNotification())
        }
        Log.i(TAG, "UrlFilterService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Keep ourselves alive. If the process is killed, the system
        // will recreate us and we'll re-foreground.
        Log.i(
            TAG,
            "UrlFilterService startCommand — accessibility running=${UrlAccessibilityService.isRunning()}"
        )
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "UrlFilterService destroyed")
    }

    /**
     * Returns true when the user has enabled SafeGuard's
     * accessibility service in system settings. Used by the parent
     * settings UI to show an "Enable" prompt.
     */
    fun isAccessibilityServiceEnabled(context: Context): Boolean {
        val expected = context.packageName + "/" + UrlAccessibilityService::class.java.name
        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabled.split(':').any { it.equals(expected, ignoreCase = true) }
    }

    private fun createNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.url_block_notification_channel),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "SafeGuard web filtering status"
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.url_service_notification_title))
            .setContentText(getString(R.string.url_service_notification_text))
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "UrlFilterService"
        private const val CHANNEL_ID = "safeguard_url_filter"
        private const val NOTIFICATION_ID = 1003

        fun start(context: Context) {
            val intent = Intent(context, UrlFilterService::class.java)
            // Foreground services must be started via startForegroundService.
            context.startForegroundService(intent)
        }
    }
}
