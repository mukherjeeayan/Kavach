package com.safeguard.parentalcontrol.viewmodel.deviceui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.data.local.entity.ScreenTimeDailyEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

/**
 * UI state for the on-device screen-time dashboard. Local-first: the
 * Room cache (written by the enforcement service every ~30s) is the
 * single source shown to the child, so the view works offline.
 */
sealed class ScreenTimeUiState {
    data object Loading : ScreenTimeUiState()
    data class Success(
        val rows: List<ScreenTimeDailyEntity>,
        val totalSeconds: Int
    ) : ScreenTimeUiState()
    data class Error(val message: String) : ScreenTimeUiState()
}

@HiltViewModel
class ScreenTimeViewModel @Inject constructor(
    private val screenTimeDao: ScreenTimeDao,
    onboardingStore: OnboardingStore
) : ViewModel() {

    private val childId: String = onboardingStore.childId ?: ""

    private val _uiState = MutableStateFlow<ScreenTimeUiState>(ScreenTimeUiState.Loading)
    val uiState: StateFlow<ScreenTimeUiState> = _uiState.asStateFlow()

    init {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        viewModelScope.launch {
            screenTimeDao.flowByDate(today)
                .catch { e ->
                    _uiState.value = ScreenTimeUiState.Error(e.message ?: "Failed to load usage")
                }
                .collect { rows ->
                    _uiState.value = ScreenTimeUiState.Success(
                        rows = rows,
                        totalSeconds = rows.sumOf { it.seconds }
                    )
                }
        }
    }
}
