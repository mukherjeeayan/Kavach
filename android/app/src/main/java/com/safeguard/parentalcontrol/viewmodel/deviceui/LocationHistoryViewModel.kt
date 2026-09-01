package com.safeguard.parentalcontrol.viewmodel.deviceui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.remote.dto.LocationDto
import com.safeguard.parentalcontrol.repository.phase1.Phase1Repository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class LocationHistoryUiState {
    data object Loading : LocationHistoryUiState()
    data class Success(
        val locations: List<LocationDto>,
        val lastUpdated: String?
    ) : LocationHistoryUiState()
    data class Error(val message: String) : LocationHistoryUiState()
}

@HiltViewModel
class LocationHistoryViewModel @Inject constructor(
    private val phase1Repository: Phase1Repository,
    onboardingStore: OnboardingStore
) : ViewModel() {

    private val childId: String = onboardingStore.childId ?: ""

    private val _uiState = MutableStateFlow<LocationHistoryUiState>(LocationHistoryUiState.Loading)
    val uiState: StateFlow<LocationHistoryUiState> = _uiState.asStateFlow()

    init {
        loadHistory()
    }

    fun loadHistory() {
        viewModelScope.launch {
            _uiState.value = LocationHistoryUiState.Loading
            try {
                val locations = phase1Repository.getLocationHistory(childId)
                val lastUpdated = locations.maxByOrNull { it.recorded_at }?.recorded_at
                _uiState.value = LocationHistoryUiState.Success(
                    locations = locations,
                    lastUpdated = lastUpdated
                )
            } catch (e: Exception) {
                _uiState.value = LocationHistoryUiState.Error(
                    e.message ?: "Failed to load location history"
                )
            }
        }
    }
}
