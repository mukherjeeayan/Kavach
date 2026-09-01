package com.safeguard.parentalcontrol.viewmodel.settings

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.ParentPinStore
import com.safeguard.parentalcontrol.data.local.TokenStore
import com.safeguard.parentalcontrol.repository.onboarding.OnboardingRepository
import com.safeguard.parentalcontrol.security.SafeGuardDeviceAdminReceiver
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class SettingsEvent {
    data object LoggedOut : SettingsEvent()
    data object Unenrolled : SettingsEvent()
    data class PinChanged(val message: String) : SettingsEvent()
    data class Error(val message: String) : SettingsEvent()
}

data class SettingsUiState(
    val appVersion: String = "",
    val isDeviceAdminActive: Boolean = false,
    val childName: String = "",
    val parentEmail: String = "",
    val isLoading: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val onboardingRepository: OnboardingRepository,
    private val tokenStore: TokenStore,
    private val onboardingStore: OnboardingStore,
    private val parentPinStore: ParentPinStore
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    private val _events = MutableStateFlow<SettingsEvent?>(null)
    val events: StateFlow<SettingsEvent?> = _events.asStateFlow()

    init {
        loadState()
    }

    fun consumeEvent() {
        _events.value = null
    }

    private fun loadState() {
        val version = try {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            val versionName = info.versionName ?: "unknown"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val longVersion = info.longVersionCode
                "$versionName ($longVersion)"
            } else {
                versionName
            }
        } catch (e: Exception) {
            "unknown"
        }

        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, SafeGuardDeviceAdminReceiver::class.java)
        val adminActive = dpm.isAdminActive(admin)

        _uiState.value = _uiState.value.copy(
            appVersion = version,
            isDeviceAdminActive = adminActive,
            childName = onboardingStore.childName.orEmpty(),
            parentEmail = tokenStore.parentName.orEmpty()
        )
    }

    fun changePin(currentPin: String, newPin: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                if (!parentPinStore.hasPin()) {
                    _events.value = SettingsEvent.Error("No PIN currently set")
                    return@launch
                }
                if (!parentPinStore.verifyPin(currentPin)) {
                    _events.value = SettingsEvent.Error("Current PIN is incorrect")
                    return@launch
                }
                if (newPin.length !in 6..16) {
                    _events.value = SettingsEvent.Error("New PIN must be 6 to 16 digits")
                    return@launch
                }
                val result = onboardingRepository.setParentPin(newPin)
                if (result.isSuccess) {
                    _events.value = SettingsEvent.PinChanged("PIN changed successfully")
                } else {
                    _events.value =
                        SettingsEvent.Error(result.exceptionOrNull()?.message ?: "Failed to change PIN")
                }
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                onboardingRepository.logout()
                _events.value = SettingsEvent.LoggedOut
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun unenroll() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
                val admin = ComponentName(context, SafeGuardDeviceAdminReceiver::class.java)
                if (dpm.isAdminActive(admin)) {
                    try {
                        dpm.removeActiveAdmin(admin)
                    } catch (e: Exception) {
                        // best-effort: continue to wipe local state
                    }
                }
                onboardingRepository.logout()
                _events.value = SettingsEvent.Unenrolled
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }
}
