package com.safeguard.parentalcontrol.viewmodel.phase2

import android.app.Application
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.remote.dto.DeviceHealthReportDto
import com.safeguard.parentalcontrol.repository.phase2.Phase2Repository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class DeviceHealthState {
    data object Loading : DeviceHealthState()
    data class Success(
        val batteryLevel: Int,
        val batteryStatus: String,
        val storageTotal: String,
        val storageUsed: String,
        val isRooted: Boolean,
        val osVersion: String
    ) : DeviceHealthState()
    data class Error(val message: String) : DeviceHealthState()
}

@HiltViewModel
class DeviceHealthViewModel @Inject constructor(
    private val application: Application,
    private val repository: Phase2Repository
) : ViewModel() {

    private val _uiState = MutableStateFlow<DeviceHealthState>(DeviceHealthState.Loading)
    val uiState: StateFlow<DeviceHealthState> = _uiState.asStateFlow()

    init {
        reportHealth()
    }

    fun reportHealth() {
        viewModelScope.launch {
            _uiState.value = DeviceHealthState.Loading
            try {
                val batteryIntent = application.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
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

                val isRooted = checkRooted()
                val osVersion = Build.VERSION.RELEASE

                val report = DeviceHealthReportDto(
                    batteryLevel = batteryPct,
                    batteryStatus = status,
                    storageTotalBytes = totalBytes,
                    storageUsedBytes = usedBytes,
                    storageAvailableBytes = availableBytes,
                    isRooted = isRooted,
                    osVersion = osVersion
                )

                repository.reportDeviceHealth(report)

                _uiState.value = DeviceHealthState.Success(
                    batteryLevel = batteryPct,
                    batteryStatus = status,
                    storageTotal = formatBytes(totalBytes),
                    storageUsed = formatBytes(usedBytes),
                    isRooted = isRooted,
                    osVersion = osVersion
                )
            } catch (e: Exception) {
                _uiState.value = DeviceHealthState.Error(e.message ?: "Failed to collect health data")
            }
        }
    }

    private fun checkRooted(): Boolean {
        val paths = arrayOf(
            "/system/app/Superuser.apk",
            "/system/xbin/su",
            "/system/bin/su",
            "/sbin/su"
        )
        return paths.any { java.io.File(it).exists() }
    }

    private fun formatBytes(bytes: Long): String {
        val kb = bytes / 1024.0
        val mb = kb / 1024.0
        val gb = mb / 1024.0
        return when {
            gb >= 1 -> String.format("%.1f GB", gb)
            mb >= 1 -> String.format("%.1f MB", mb)
            else -> String.format("%.1f KB", kb)
        }
    }
}
