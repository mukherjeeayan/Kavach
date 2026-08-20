package com.safeguard.parentalcontrol.viewmodel.deviceui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.data.local.entity.LocationEntryEntity
import com.safeguard.parentalcontrol.repository.phase1.Phase1Repository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Last-known location view for the child device. Offline-first: the
 * local Room buffer is shown immediately; a refresh() call pulls the
 * server's latest ping (which may include uploads from other devices
 * or the most recent successful sync).
 */
sealed class LocationUiState {
    data object Loading : LocationUiState()
    data class Success(
        val localPings: List<LocationEntryEntity>,
        val serverPings: List<LocationEntryEntity>
    ) : LocationUiState()
    data class Error(val message: String) : LocationUiState()
}

@HiltViewModel
class LocationViewModel @Inject constructor(
    private val locationDao: LocationDao,
    private val phase1Repository: Phase1Repository,
    onboardingStore: OnboardingStore
) : ViewModel() {

    private val childId: String = onboardingStore.childId ?: ""

    private val _uiState = MutableStateFlow<LocationUiState>(LocationUiState.Loading)
    val uiState: StateFlow<LocationUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            locationDao.flowRecent()
                .catch { e ->
                    _uiState.value = LocationUiState.Error(e.message ?: "Failed to load location")
                }
                .collect { local ->
                    _uiState.value = LocationUiState.Success(
                        localPings = local,
                        serverPings = emptyList()
                    )
                }
        }
    }

    fun refreshFromServer() {
        viewModelScope.launch {
            val server = phase1Repository.getCurrentLocations(childId).mapNotNull { dto ->
                LocationEntryEntity(
                    latitude = dto.latitude,
                    longitude = dto.longitude,
                    accuracyM = dto.accuracy_m,
                    speedKmh = dto.speed_kmh,
                    recordedAt = parseIsoMillis(dto.recorded_at) ?: System.currentTimeMillis()
                )
            }
            val local = locationDao.flowRecent().first()
            _uiState.value = LocationUiState.Success(localPings = local, serverPings = server)
        }
    }

    private fun parseIsoMillis(iso: String): Long? = try {
        java.time.Instant.parse(iso).toEpochMilli()
    } catch (e: Exception) {
        null
    }
}
