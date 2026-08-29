package com.safeguard.parentalcontrol.viewmodel.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.local.BedtimePreferences
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalTime
import javax.inject.Inject

/**
 * State for the bedtime configuration screen. The UI binds directly
 * to these fields and persists them on Save.
 */
data class BedtimeUiState(
    val enabled: Boolean = false,
    val bedtimeStart: LocalTime = BedtimePreferences.DEFAULT_START,
    val bedtimeEnd: LocalTime = BedtimePreferences.DEFAULT_END,
    val dndEnabled: Boolean = false,
    val isLoading: Boolean = true,
    val isSaved: Boolean = false
)

/**
 * ViewModel that owns the bedtime configuration. Reads from
 * [BedtimePreferences] on init and writes back on save.
 */
@HiltViewModel
class BedtimeViewModel @Inject constructor(
    private val preferences: BedtimePreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(BedtimeUiState())
    val uiState: StateFlow<BedtimeUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        _uiState.value = BedtimeUiState(
            enabled = preferences.enabled,
            bedtimeStart = preferences.bedtimeStart,
            bedtimeEnd = preferences.bedtimeEnd,
            dndEnabled = preferences.dndEnabled,
            isLoading = false
        )
    }

    fun setEnabled(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(enabled = enabled)
    }

    fun setDndEnabled(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(dndEnabled = enabled)
    }

    fun setStart(time: LocalTime) {
        _uiState.value = _uiState.value.copy(bedtimeStart = time)
    }

    fun setEnd(time: LocalTime) {
        _uiState.value = _uiState.value.copy(bedtimeEnd = time)
    }

    fun save() {
        viewModelScope.launch {
            val s = _uiState.value
            preferences.enabled = s.enabled
            preferences.bedtimeStart = s.bedtimeStart
            preferences.bedtimeEnd = s.bedtimeEnd
            preferences.dndEnabled = s.dndEnabled
            _uiState.value = s.copy(isSaved = true)
        }
    }

    fun acknowledgeSaved() {
        _uiState.value = _uiState.value.copy(isSaved = false)
    }
}
