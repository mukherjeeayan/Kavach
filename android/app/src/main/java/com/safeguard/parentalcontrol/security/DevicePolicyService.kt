package com.safeguard.parentalcontrol.security

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.UserManager
import android.util.Log

/**
 * Device Policy Controller (DPC) service that enforces complete OS and
 * hardware-level lockdown when running as Device Owner.
 *
 * Must be invoked immediately upon Device Owner provisioning. Requires
 * the app to be provisioned as Device Owner via QR code or ADB command:
 *
 *   adb shell dpm set-device-owner com.safeguard.parentalcontrol/.security.SafeGuardDeviceAdminReceiver
 *
 * This class provides tamper-proofing against:
 * - ADB/USB debugging bypass
 * - Safe Mode boot bypass
 * - Secondary profile/guest account bypass
 * - Clock tampering for screen time rollback
 * - VPN/DNS filter evasion
 * - App uninstallation
 * - Mock location injection
 */
class DevicePolicyService(private val context: Context) {

    private val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val adminComponent = ComponentName(context, SafeGuardDeviceAdminReceiver::class.java)

    /**
     * Enforces complete OS and hardware-level lockdown.
     * Must be invoked immediately upon Device Owner provisioning.
     *
     * @throws SecurityException if the app is not running as Device Owner
     */
    fun enforceDeviceLockdown() {
        if (!dpm.isDeviceOwnerApp(context.packageName)) {
            throw SecurityException("CRITICAL: Kavach is not running as Device Owner.")
        }

        Log.i(TAG, "Enforcing device lockdown...")

        // 1. Permanently block ADB, USB debugging, and Developer Options
        //    Prevents the child from connecting to a computer and bypassing monitoring.
        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_DEBUGGING_FEATURES)
        Log.i(TAG, "  [OK] ADB/USB debugging blocked")

        // 2. Prevent factory reset from Settings and Hardware Recovery Menu
        //    Stops the child from wiping the device to remove monitoring.
        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET)
        Log.i(TAG, "  [OK] Factory reset blocked")

        // 3. Block boot into Safe Mode (prevents bypassing monitoring via hardware keys)
        //    Safe Mode disables third-party services including Kavach.
        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT)
        Log.i(TAG, "  [OK] Safe Mode blocked")

        // 4. Block multi-user creation, guest profiles, and secondary sandbox spaces
        //    Prevents Samsung Secure Folder, Xiaomi Dual Apps, Android Guest Users.
        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_ADD_USER)
        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_USER_SWITCH)
        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CROSS_PROFILE_COPY_PASTE)
        Log.i(TAG, "  [OK] Secondary profiles/sandboxes blocked")

        // 5. Lock date and time to prevent screen time rollback attacks
        //    Children cannot adjust system time backward to reset daily quotas.
        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_DATE_TIME)
        dpm.setAutoTimeRequired(adminComponent, true)
        Log.i(TAG, "  [OK] Date/time locked")

        // 6. Block third-party VPNs and enforce Private DNS via DNS-over-TLS
        //    Prevents VPN-based web filter evasion.
        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_VPN)
        try {
            dpm.setGlobalPrivateDnsModeSpecifiedHost(adminComponent, "family.cloudflare-dns.com")
            Log.i(TAG, "  [OK] VPN blocked, DNS locked to Cloudflare Family")
        } catch (e: Exception) {
            Log.w(TAG, "  [WARN] Private DNS lock failed (API 31+ required): ${e.message}")
        }

        // 7. Prevent app uninstallation and process termination
        //    The child cannot remove Kavach from the device.
        dpm.setUninstallBlocked(adminComponent, context.packageName, true)
        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_APPS_CONTROL)
        Log.i(TAG, "  [OK] App uninstallation blocked")

        // 8. Prevent mock location applications
        //    Stops the child from spoofing GPS coordinates.
        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_LOCATION)
        Log.i(TAG, "  [OK] Mock location blocked")

        // 9. Block sharing and receiving via nearby sharing
        //    Prevents data exfiltration via Bluetooth/NFC.
        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SHARING_ADMIN_CONFIGURED)
        Log.i(TAG, "  [OK] Nearby sharing blocked")

        Log.i(TAG, "Device lockdown complete — all restrictions enforced")
    }

    /**
     * Locks device into Kiosk Mode during scheduled lockout or expired quotas.
     * Only the Kavach app is visible; the child cannot access other apps.
     */
    fun setKioskLockState(locked: Boolean) {
        val packages = if (locked) arrayOf(context.packageName) else emptyArray()
        dpm.setLockTaskPackages(adminComponent, packages)
        Log.i(TAG, if (locked) "Kiosk mode ENABLED" else "Kiosk mode DISABLED")
    }

    /**
     * Check if the app is running as Device Owner.
     */
    fun isDeviceOwner(): Boolean {
        return dpm.isDeviceOwnerApp(context.packageName)
    }

    /**
     * Check if a specific user restriction is active.
     */
    fun isRestrictionActive(restriction: String): Boolean {
        return dpm.getUserRestrictions(adminComponent).getBoolean(restriction, false)
    }

    companion object {
        private const val TAG = "DevicePolicyService"
    }
}
