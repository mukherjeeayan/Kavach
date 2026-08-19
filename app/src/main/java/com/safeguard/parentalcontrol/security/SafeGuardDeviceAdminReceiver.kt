package com.safeguard.parentalcontrol.security

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
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

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "Device Admin Enabled - App secured against basic uninstalls")
        // TODO: Sync state with server indicating Admin is Active
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.w(TAG, "Device Admin Disabled - Child might have bypassed security!")
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

    companion object {
        private const val TAG = "SafeGuardAdminReceiver"
    }
}