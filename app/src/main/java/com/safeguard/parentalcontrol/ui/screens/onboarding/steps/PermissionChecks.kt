package com.safeguard.parentalcontrol.ui.screens.onboarding.steps

import android.content.Context
import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import androidx.core.content.ContextCompat
import com.safeguard.parentalcontrol.security.SafeGuardDeviceAdminReceiver

/** True when the app has been granted Usage Access (AppOps). */
internal fun hasUsageAccess(context: Context): Boolean {
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

/** True when SafeGuard is active as a Device Administrator. */
internal fun isAdminActive(context: Context): Boolean {
    val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    return dpm.isAdminActive(
        ComponentName(context, SafeGuardDeviceAdminReceiver::class.java)
    )
}

/** True when POST_NOTIFICATIONS is granted (or not required). */
internal fun hasNotificationPermission(context: Context): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
}

/**
 * True when ACCESS_BACKGROUND_LOCATION is granted (or not required).
 * On Android 10+ (API 29+), background location must be requested
 * separately from foreground location. Without this, the location
 * service cannot record GPS pings when the app is in the background.
 */
internal fun hasBackgroundLocationPermission(context: Context): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(
                context,
                "android.permission.ACCESS_BACKGROUND_LOCATION"
            ) == PackageManager.PERMISSION_GRANTED
}
