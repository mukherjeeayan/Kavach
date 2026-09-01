package com.safeguard.parentalcontrol.service.usage

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Log
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Helper that checks whether the app has been granted Usage Access
 * permission and provides methods to request it.
 *
 * Usage Access is required by [AppUsageStats] to query app foreground
 * time via [UsageStatsManager]. Without it, screen-time tracking and
 * daily limit enforcement cannot function.
 */
@Singleton
class UsageAccessService @Inject constructor() {

    /**
     * Returns true if the app currently has the PACKAGE_USAGE_STATS
     * permission granted via Settings → Usage access.
     */
    fun isUsagePermissionGranted(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    /**
     * Returns the current [UsageStatsManager] instance, or null if
     * the permission is not granted.
     */
    fun getUsageStatsManager(context: Context): UsageStatsManager? {
        if (!isUsagePermissionGranted(context)) {
            Log.w(TAG, "Usage permission not granted")
            return null
        }
        return context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
    }

    /**
     * Opens the system Usage Access settings screen so the user can
     * grant the permission. Should be called from an Activity context.
     */
    fun requestUsagePermission(context: Context) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open usage access settings", e)
            // Fallback: open all settings
            try {
                val intent = Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            } catch (_: Exception) {}
        }
    }

    /**
     * Checks if usage permission is granted and opens settings if not.
     * Returns true if already granted.
     */
    fun ensureUsagePermission(context: Context): Boolean {
        if (isUsagePermissionGranted(context)) return true
        requestUsagePermission(context)
        return false
    }

    companion object {
        private const val TAG = "UsageAccessService"
    }
}
