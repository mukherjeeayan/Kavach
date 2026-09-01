package com.safeguard.parentalcontrol.viewmodel.phase2

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.repository.phase2.Phase2Repository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class MoodState {
    data object Idle : MoodState()
    data object Logging : MoodState()
    data object Success : MoodState()
    data class Error(val message: String) : MoodState()
}

@HiltViewModel
class MoodViewModel @Inject constructor(
    private val repository: Phase2Repository
) : ViewModel() {

    private val _uiState = MutableStateFlow<MoodState>(MoodState.Idle)
    val uiState: StateFlow<MoodState> = _uiState.asStateFlow()

    fun logMood(score: Int, label: String?, note: String?) {
        viewModelScope.launch {
            _uiState.value = MoodState.Logging
            val result = repository.logMood(score, label, note)
            result.onSuccess {
                _uiState.value = MoodState.Success
            }
            result.onFailure { e ->
                _uiState.value = MoodState.Error(e.message ?: "Failed to log mood")
            }
        }
    }

    fun reset() {
        _uiState.value = MoodState.Idle
    }
}
