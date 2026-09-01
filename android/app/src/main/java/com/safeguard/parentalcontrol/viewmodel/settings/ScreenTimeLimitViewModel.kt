package com.safeguard.parentalcontrol.viewmodel.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.local.ScreenTimeLimitPreferences
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * State for the daily screen-time limit screen.
 */
data class ScreenTimeLimitUiState(
    val enabled: Boolean = false,
    val dailyLimitMinutes: Int = ScreenTimeLimitPreferences.DEFAULT_DAILY_LIMIT_MINUTES,
    val isLoading: Boolean = true,
    val isSaved: Boolean = false,
    val error: String? = null
)

/**
 * ViewModel for the daily screen-time limit configuration. Reads from
 * [ScreenTimeLimitPreferences] on init and writes back on save. The
 * [com.safeguard.parentalcontrol.work.OnlyWorkWorker] reads the same
 * preferences at runtime to enforce the cap.
 */
@HiltViewModel
class ScreenTimeLimitViewModel @Inject constructor(
    private val preferences: ScreenTimeLimitPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(ScreenTimeLimitUiState())
    val uiState: StateFlow<ScreenTimeLimitUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        _uiState.value = ScreenTimeLimitUiState(
            enabled = preferences.enabled,
            dailyLimitMinutes = preferences.dailyLimitMinutes,
            isLoading = false
        )
    }

    fun setEnabled(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(enabled = enabled)
    }

    /**
     * Validate the input then store the new value in UI state. The
     * actual persistence happens in [save] so the user can cancel.
     */
    fun setDailyLimitMinutes(value: Int) {
        val clamped = value.coerceIn(
            ScreenTimeLimitPreferences.MIN_LIMIT_MINUTES,
            ScreenTimeLimitPreferences.MAX_LIMIT_MINUTES
        )
        _uiState.value = _uiState.value.copy(
            dailyLimitMinutes = clamped,
            error = if (clamped != value) "Value was clamped to a valid range" else null
        )
    }

    fun save() {
        viewModelScope.launch {
            val s = _uiState.value
            preferences.enabled = s.enabled
            preferences.dailyLimitMinutes = s.dailyLimitMinutes
            _uiState.value = s.copy(isSaved = true, error = null)
        }
    }

    fun acknowledgeSaved() {
        _uiState.value = _uiState.value.copy(isSaved = false)
    }
}
