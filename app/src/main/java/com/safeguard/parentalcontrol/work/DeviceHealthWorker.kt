package com.safeguard.parentalcontrol.work

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.Settings
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.remote.api.Phase2Api
import com.safeguard.parentalcontrol.data.remote.dto.DeviceHealthReportDto
import com.safeguard.parentalcontrol.security.TamperDetector
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * Periodic worker (every 6 hours) that collects device health data —
 * battery level/status, storage stats, root status — and reports it
 * to the backend via [Phase2Api.reportDeviceHealth].
 *
 * Scheduled via [SyncScheduler.scheduleDeviceHealth].
 */
@HiltWorker
class DeviceHealthWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val phase2Api: Phase2Api,
    private val onboardingStore: OnboardingStore
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val deviceId = onboardingStore.deviceId ?: return Result.success()

        return try {
            val batteryIntent = applicationContext.registerReceiver(
                null,
                IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            )
            val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, 0) ?: 0
            val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
            val batteryPct = (level * 100 / scale)
            val status = when (batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)) {
                BatteryManager.BATTERY_STATUS_CHARGING -> "CHARGING"
                BatteryManager.BATTERY_STATUS_FULL -> "FULL"
                else -> "DISCHARGING"
            }

            val stat = StatFs(Environment.getDataDirectory().path)
            val totalBytes = stat.totalBytes
            val availableBytes = stat.availableBytes
            val usedBytes = totalBytes - availableBytes

            val isRooted = TamperDetector.isRooted(applicationContext)
            val isDebuggerAttached = TamperDetector.isDebuggerAttached()
            val osVersion = Build.VERSION.RELEASE
            val securityPatch = Build.VERSION.SECURITY_PATCH

            val diskEncrypted = try {
                val dpm = applicationContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
                dpm?.storageEncryptionStatus == DevicePolicyManager.ENCRYPTION_STATUS_ACTIVE
            } catch (_: Exception) {
                false
            }

            val unknownSources = try {
                Settings.Secure.getInt(
                    applicationContext.contentResolver,
                    Settings.Secure.INSTALL_NON_MARKET_APPS, 0
                ) == 1
            } catch (_: Exception) {
                false
            }

            val report = DeviceHealthReportDto(
                batteryLevel = batteryPct,
                batteryStatus = status,
                storageTotalBytes = totalBytes,
                storageUsedBytes = usedBytes,
                storageAvailableBytes = availableBytes,
                isRooted = isRooted,
                isDebuggerAttached = isDebuggerAttached,
                osVersion = osVersion,
                securityPatchLevel = securityPatch,
                diskEncryption = diskEncrypted,
                unknownSources = unknownSources
            )

            val response = phase2Api.reportDeviceHealth(deviceId, report)
            if (response.isSuccessful && response.body()?.success == true) {
                Log.d(TAG, "Device health reported successfully")
                Result.success()
            } else {
                Log.w(TAG, "Device health report failed: HTTP ${response.code()}")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Device health worker failed", e)
            Result.retry()
        }
    }

    companion object {
        private const val TAG = "DeviceHealthWorker"
    }
}
