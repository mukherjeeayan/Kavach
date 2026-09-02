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
import kotlinx.coroutines.cancel
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

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "Device Admin Enabled - App secured against basic uninstalls")

        // Enforce complete OS-level lockdown when running as Device Owner
        try {
            val dpcService = DevicePolicyService(context)
            if (dpcService.isDeviceOwner()) {
                dpcService.enforceDeviceLockdown()
                Log.i(TAG, "Device Owner lockdown enforced")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to enforce Device Owner lockdown: ${e.message}")
        }

        hideSelfFromLauncher(context)
        launchScoped { reportAdminState(it, true) }
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.w(TAG, "Device Admin Disabled - Child might have bypassed security!")
        launchScoped { reportAdminState(it, false) }

        val deviceId = onboardingStore.deviceId
        if (!deviceId.isNullOrEmpty()) {
            launchScoped { scope ->
                try {
                    appBlockingRepository.reportTamper(deviceId, "Device admin disabled")
                    Log.i(TAG, "Tamper alert sent to backend")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to send tamper alert: ${e.message}")
                } finally {
                    scope.cancel()
                }
            }
        }
    }

    /**
     * Launches a short-lived coroutine scope that is cancelled after
     * the work completes, preventing leaks from the transient receiver.
     */
    private fun launchScoped(block: suspend (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        scope.launch {
            try {
                block(scope)
            } finally {
                scope.cancel()
            }
        }
    }

    private suspend fun reportAdminState(scope: CoroutineScope, adminActive: Boolean) {
        val deviceId = onboardingStore.deviceId ?: return
        try {
            if (phase1Repository.reportAdminStatus(deviceId, adminActive)) {
                Log.i(TAG, "Admin status reported: admin_active=$adminActive")
            } else {
                Log.w(TAG, "Admin status report failed")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to report admin status: ${e.message}")
        } finally {
            scope.cancel()
        }
    }

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