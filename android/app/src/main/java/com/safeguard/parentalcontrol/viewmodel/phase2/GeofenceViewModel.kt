package com.safeguard.parentalcontrol.viewmodel.phase2

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.local.entity.GeofenceEntity
import com.safeguard.parentalcontrol.data.remote.dto.GeofenceEventDto
import com.safeguard.parentalcontrol.repository.phase2.Phase2Repository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class GeofenceState(
    val geofences: List<GeofenceEntity> = emptyList(),
    val events: List<GeofenceEventDto> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
)

@HiltViewModel
class GeofenceViewModel @Inject constructor(
    private val repository: Phase2Repository
) : ViewModel() {

    private val _events = MutableStateFlow<List<GeofenceEventDto>>(emptyList())
    private val _isLoading = MutableStateFlow(true)
    private val _error = MutableStateFlow<String?>(null)

    val uiState: StateFlow<GeofenceState> = kotlinx.coroutines.flow.combine(
        repository.getActiveGeofences(),
        _events,
        _isLoading,
        _error
    ) { geofences, events, loading, error ->
        GeofenceState(
            geofences = geofences,
            events = events,
            isLoading = loading,
            error = error
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), GeofenceState())

    init {
        syncGeofences()
    }

    fun syncGeofences() {
        viewModelScope.launch {
            _isLoading.value = true
            repository.syncGeofences()
            _isLoading.value = false
        }
    }

    fun checkLocation(latitude: Double, longitude: Double) {
        viewModelScope.launch {
            val result = repository.checkGeofences(latitude, longitude)
            result.onSuccess { events ->
                _events.value = events
            }
            result.onFailure { e ->
                _error.value = e.message ?: "Failed to check geofences"
            }
        }
    }
}
