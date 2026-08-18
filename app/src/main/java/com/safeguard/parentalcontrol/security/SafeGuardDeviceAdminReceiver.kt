package com.safeguard.parentalcontrol.security

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class SafeGuardDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "Device Admin Enabled - App secured against basic uninstalls")
        // TODO: Sync state with server indicating Admin is Active
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.w(TAG, "Device Admin Disabled - Child might have bypassed security!")
        // TODO: Trigger emergency alert to backend regarding security downgrade
        // Note: The parent should be authenticated before this can be naturally disabled
    }
    
    companion object {
        private const val TAG = "SafeGuardAdminReceiver"
    }
}
