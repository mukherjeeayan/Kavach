package com.safeguard.parentalcontrol.viewmodel.phase2

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.remote.dto.SecurityScanReportDto
import com.safeguard.parentalcontrol.repository.phase2.Phase2Repository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SecurityState(
    val lastScan: SecurityScanReportDto? = null,
    val isScanning: Boolean = false,
    val error: String? = null,
    val scanSuccess: Boolean = false
)

@HiltViewModel
class SecurityViewModel @Inject constructor(
    private val repository: Phase2Repository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SecurityState())
    val uiState: StateFlow<SecurityState> = _uiState.asStateFlow()

    fun reportScan(
        isRooted: Boolean,
        hasKeylogger: Boolean,
        wifiSsid: String?,
        wifiBssid: String?,
        isOpenNetwork: Boolean,
        appIntegrityOk: Boolean
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isScanning = true, error = null, scanSuccess = false)
            val scan = SecurityScanReportDto(
                isRooted = isRooted,
                hasKeylogger = hasKeylogger,
                wifiSsid = wifiSsid,
                wifiBssid = wifiBssid,
                isOpenNetwork = isOpenNetwork,
                appIntegrityOk = appIntegrityOk
            )
            val result = repository.reportSecurityScan(scan)
            result.onSuccess {
                _uiState.value = _uiState.value.copy(
                    lastScan = scan,
                    isScanning = false,
                    scanSuccess = true
                )
            }
            result.onFailure { e ->
                _uiState.value = _uiState.value.copy(
                    isScanning = false,
                    error = e.message ?: "Scan failed"
                )
            }
        }
    }

    fun clearScanSuccess() {
        _uiState.value = _uiState.value.copy(scanSuccess = false)
    }
}
