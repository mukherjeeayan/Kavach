package com.safeguard.parentalcontrol.viewmodel.phase2

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.remote.dto.SosEventDto
import com.safeguard.parentalcontrol.repository.phase2.Phase2Repository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class SosState {
    data object Idle : SosState()
    data object Sending : SosState()
    data class Success(val event: SosEventDto) : SosState()
    data class Error(val message: String) : SosState()
}

@HiltViewModel
class SosViewModel @Inject constructor(
    private val repository: Phase2Repository
) : ViewModel() {

    private val _uiState = MutableStateFlow<SosState>(SosState.Idle)
    val uiState: StateFlow<SosState> = _uiState.asStateFlow()

    fun triggerSos(latitude: Double?, longitude: Double?) {
        viewModelScope.launch {
            _uiState.value = SosState.Sending
            val result = repository.triggerSos(latitude, longitude)
            result.onSuccess { event ->
                _uiState.value = SosState.Success(event)
            }
            result.onFailure { e ->
                _uiState.value = SosState.Error(e.message ?: "SOS trigger failed")
            }
        }
    }

    fun reset() {
        _uiState.value = SosState.Idle
    }
}
