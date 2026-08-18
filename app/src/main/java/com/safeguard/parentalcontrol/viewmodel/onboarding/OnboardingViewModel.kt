package com.safeguard.parentalcontrol.viewmodel.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.remote.dto.ChildDto
import com.safeguard.parentalcontrol.repository.onboarding.OnboardingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Step sequence of the parent onboarding flow.
 */
sealed class OnboardingStep {
    data object Login : OnboardingStep()
    data object Child : OnboardingStep()
    data object Device : OnboardingStep()
    data object Pin : OnboardingStep()
    data object Permissions : OnboardingStep()
    data object Done : OnboardingStep()
}

/**
 * ViewModel for the parent-onboarding flow.
 *
 * - Uses @HiltViewModel + constructor injection (mandatory).
 * - Exposes UI state via StateFlow (never LiveData).
 * - Never holds references to Context, Activity, or View.
 */
@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val repository: OnboardingRepository
) : ViewModel() {

    private val _step = MutableStateFlow<OnboardingStep>(OnboardingStep.Login)
    val step: StateFlow<OnboardingStep> = _step.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _children = MutableStateFlow<List<ChildDto>>(emptyList())
    val children: StateFlow<List<ChildDto>> = _children.asStateFlow()

    fun clearError() {
        _error.value = null
    }

    /** Step 1 — authenticate the parent, then load their child profiles. */
    fun login(email: String, password: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.login(email, password)
                .onSuccess {
                    _step.value = OnboardingStep.Child
                    loadChildren()
                }
                .onFailure { e ->
                    _error.value = e.message ?: "Login failed"
                }
            _isLoading.value = false
        }
    }

    private fun loadChildren() {
        viewModelScope.launch {
            repository.listChildren()
                .onSuccess { _children.value = it }
                .onFailure { e ->
                    _error.value = e.message ?: "Failed to load children"
                }
        }
    }

    /** Step 2a — pick an existing child profile. */
    fun selectChild(child: ChildDto) {
        _step.value = OnboardingStep.Device
    }

    /** Step 2b — create a new child profile, then continue to device setup. */
    fun createChild(name: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.createChild(name)
                .onSuccess { child ->
                    _children.value = _children.value + child
                    _step.value = OnboardingStep.Device
                }
                .onFailure { e ->
                    _error.value = e.message ?: "Failed to create child profile"
                }
            _isLoading.value = false
        }
    }

    /** Step 3 — register this device for the given child. */
    fun registerDevice(child: ChildDto, deviceName: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.registerDevice(child, deviceName)
                .onSuccess {
                    _step.value = OnboardingStep.Pin
                }
                .onFailure { e ->
                    _error.value = e.message ?: "Failed to register device"
                }
            _isLoading.value = false
        }
    }

    /** Step 4 — set the parental unlock PIN (local digest + server hash). */
    fun savePin(pin: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.setParentPin(pin)
                .onSuccess {
                    _step.value = OnboardingStep.Permissions
                }
                .onFailure { e ->
                    _error.value = e.message ?: "Failed to set PIN"
                }
            _isLoading.value = false
        }
    }

    /** Step 5 — every permission granted; onboarding complete. */
    fun finishOnboarding() {
        _step.value = OnboardingStep.Done
    }

    /** Sign out — returns to the login step and clears stored state. */
    fun logout() {
        repository.logout()
        _children.value = emptyList()
        _step.value = OnboardingStep.Login
    }
}