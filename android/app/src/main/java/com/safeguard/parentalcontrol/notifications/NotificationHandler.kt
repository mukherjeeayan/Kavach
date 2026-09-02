package com.safeguard.parentalcontrol.notifications

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.safeguard.parentalcontrol.MainActivity

/**
 * Translates an incoming FCM data payload into a [PendingIntent] that
 * opens the relevant screen of the on-device dashboard.
 *
 * Notification types understood by the parent-facing app:
 *  - "sos"              -> SOS tab, with alertId for deep linking
 *  - "geofence"         -> Location tab, with childId + alertId
 *  - "keyword"          -> Communication logs tab, with alertId
 *  - "selfharm"         -> Security/Mood tab, with alertId
 *  - "unblock_approved" -> Apps tab, with packageName
 *  - "unblock_rejected" -> Apps tab, with packageName
 *  - "alert"            -> default alert tab
 *
 * Unknown types fall back to the dashboard root so the user can still
 * find context manually.
 */
object NotificationHandler {

    const val EXTRA_NOTIFICATION_TYPE = "extra_notification_type"
    const val EXTRA_CHILD_ID = "extra_child_id"
    const val EXTRA_ALERT_ID = "extra_alert_id"
    const val EXTRA_PACKAGE_NAME = "extra_package_name"
    const val EXTRA_REWARD_ID = "extra_reward_id"

    const val TYPE_SOS = "sos"
    const val TYPE_GEOFENCE = "geofence"
    const val TYPE_KEYWORD = "keyword"
    const val TYPE_SELFHARM = "selfharm"
    const val TYPE_UNBLOCK_APPROVED = "unblock_approved"
    const val TYPE_UNBLOCK_REJECTED = "unblock_rejected"
    const val TYPE_UNBLOCK_REQUEST = "unblock_request"
    const val TYPE_ALERT = "alert"

    /**
     * Builds a tap intent (wrapped in a [PendingIntent]) that lands the
     * user on the screen implied by [type], passing through any
     * related identifiers as extras. The launcher activity reads these
     * extras and re-selects the correct bottom-nav tab.
     */
    fun buildOpenIntent(
        context: Context,
        type: String?,
        childId: String?,
        alertId: String?,
        packageName: String?,
        rewardId: String? = null
    ): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_NOTIFICATION_TYPE, type)
            childId?.let { putExtra(EXTRA_CHILD_ID, it) }
            alertId?.let { putExtra(EXTRA_ALERT_ID, it) }
            packageName?.let { putExtra(EXTRA_PACKAGE_NAME, it) }
            rewardId?.let { putExtra(EXTRA_REWARD_ID, it) }
        }
        return PendingIntent.getActivity(
            context,
            stableRequestCode(type, alertId, packageName),
            intent,
            pendingIntentFlags()
        )
    }

    /**
     * Returns the [DeviceTab] name this notification type should map
     * to. Returns null when the type is unknown — caller decides
     * whether to fall back to a default tab.
     */
    fun targetTabFor(type: String?): String? = when (type) {
        TYPE_SOS, TYPE_ALERT -> "SOS"
        TYPE_GEOFENCE -> "Location"
        TYPE_KEYWORD -> "Communication"
        TYPE_SELFHARM -> "Security"
        TYPE_UNBLOCK_APPROVED, TYPE_UNBLOCK_REJECTED, TYPE_UNBLOCK_REQUEST -> "Apps"
        else -> null
    }

    private fun pendingIntentFlags(): Int {
        val base = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return base
    }

    private fun stableRequestCode(
        type: String?,
        alertId: String?,
        packageName: String?
    ): Int {
        val raw = "${type ?: "default"}:${alertId ?: ""}:${packageName ?: ""}"
        return raw.hashCode()
    }
}
