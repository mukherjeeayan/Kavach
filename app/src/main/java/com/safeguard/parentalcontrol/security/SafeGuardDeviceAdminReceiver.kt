package com.safeguard.parentalcontrol.security

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
import com.safeguard.parentalcontrol.repository.phase1.Phase1Repository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class SafeGuardDeviceAdminReceiver : DeviceAdminReceiver() {

    @Inject
    lateinit var onboardingStore: OnboardingStore

    @Inject
    lateinit var appBlockingRepository: AppBlockingRepository

    @Inject
    lateinit var phase1Repository: Phase1Repository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "Device Admin Enabled - App secured against basic uninstalls")

        // Hide SafeGuard from the launcher: with device admin active the
        // child can no longer see, open, or uninstall the app. The parent
        // reaches the app through the PIN gate only.
        hideSelfFromLauncher(context)
        reportAdminState(true)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.w(TAG, "Device Admin Disabled - Child might have bypassed security!")
        reportAdminState(false)
        // Fire an emergency alert to the backend: disabling the device
        // admin makes the app uninstallable, so this is the last chance
        // to tell the parent something is wrong. Best-effort — if the
        // device is offline the periodic sync has nothing to retry, but
        // the parent can still see "admin disabled" on the next check-in.
        val deviceId = onboardingStore.deviceId
        if (!deviceId.isNullOrEmpty()) {
            scope.launch {
                try {
                    appBlockingRepository.reportTamper(deviceId, "Device admin disabled")
                    Log.i(TAG, "Tamper alert sent to backend")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to send tamper alert: ${e.message}")
                }
            }
        }
    }

    /**
     * Best-effort sync of the local admin state to the server so the
     * parent dashboard shows the "protected" badge truthfully.
     */
    private fun reportAdminState(adminActive: Boolean) {
        val deviceId = onboardingStore.deviceId
        if (deviceId.isNullOrEmpty()) return
        scope.launch {
            try {
                if (phase1Repository.reportAdminStatus(deviceId, adminActive)) {
                    Log.i(TAG, "Admin status reported: admin_active=$adminActive")
                } else {
                    Log.w(TAG, "Admin status report failed")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to report admin status: ${e.message}")
            }
        }
    }

    /**
     * Uses the active DevicePolicyManager to hide our own package from
     * the launcher (not uninstallable while admin is active anyway).
     * Best-effort: some OEMs restrict hiding the app itself.
     */
    private fun hideSelfFromLauncher(context: Context) {
        try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(context, SafeGuardDeviceAdminReceiver::class.java)
            if (dpm.isAdminActive(admin) && !dpm.isApplicationHidden(admin, context.packageName)) {
                dpm.setApplicationHidden(admin, context.packageName, true)
                Log.i(TAG, "SafeGuard hidden from launcher")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not hide app from launcher: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "SafeGuardAdminReceiver"
    }
}