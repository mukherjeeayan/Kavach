package com.safeguard.parentalcontrol.viewmodel.deviceui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.ContactRuleDao
import com.safeguard.parentalcontrol.data.local.entity.ContactRuleEntity
import com.safeguard.parentalcontrol.repository.phase1.Phase1Repository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class CommunicationLogsUiState {
    data object Loading : CommunicationLogsUiState()
    data class Success(
        val contactRules: List<ContactRuleEntity>
    ) : CommunicationLogsUiState()
    data class Error(val message: String) : CommunicationLogsUiState()
}

@HiltViewModel
class CommunicationLogsViewModel @Inject constructor(
    private val contactRuleDao: ContactRuleDao,
    private val phase1Repository: Phase1Repository,
    onboardingStore: OnboardingStore
) : ViewModel() {

    private val childId: String = onboardingStore.childId ?: ""

    private val _uiState = MutableStateFlow<CommunicationLogsUiState>(CommunicationLogsUiState.Loading)
    val uiState: StateFlow<CommunicationLogsUiState> = _uiState.asStateFlow()

    init {
        loadLogs()
    }

    fun loadLogs() {
        viewModelScope.launch {
            _uiState.value = CommunicationLogsUiState.Loading
            try {
                contactRuleDao.getAll()
                    .catch { e ->
                        _uiState.value = CommunicationLogsUiState.Error(
                            e.message ?: "Failed to load communication logs"
                        )
                    }
                    .collect { contacts ->
                        _uiState.value = CommunicationLogsUiState.Success(
                            contactRules = contacts
                        )
                    }
            } catch (e: Exception) {
                _uiState.value = CommunicationLogsUiState.Error(
                    e.message ?: "Failed to load communication logs"
                )
            }
        }
    }

    fun syncFromServer() {
        viewModelScope.launch {
            phase1Repository.syncContacts(childId)
        }
    }
}
