package com.safeguard.parentalcontrol.viewmodel.deviceui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.entity.ScheduledLockEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Read-only view of the scheduled lock windows synced from the server. */
sealed class LocksUiState {
    data object Loading : LocksUiState()
    data class Success(val locks: List<ScheduledLockEntity>) : LocksUiState()
    data class Error(val message: String) : LocksUiState()
}

@HiltViewModel
class LocksViewModel @Inject constructor(
    private val scheduledLockDao: ScheduledLockDao
) : ViewModel() {

    private val _uiState = MutableStateFlow<LocksUiState>(LocksUiState.Loading)
    val uiState: StateFlow<LocksUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            scheduledLockDao.getAll()
                .catch { e ->
                    _uiState.value = LocksUiState.Error(e.message ?: "Failed to load locks")
                }
                .collect { locks ->
                    _uiState.value = LocksUiState.Success(locks)
                }
        }
    }
}
