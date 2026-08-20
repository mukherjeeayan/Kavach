package com.safeguard.parentalcontrol.viewmodel.deviceui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.local.dao.ContactRuleDao
import com.safeguard.parentalcontrol.data.local.entity.ContactRuleEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Read-only view of the allow/block contact rules synced from the server. */
sealed class ContactsUiState {
    data object Loading : ContactsUiState()
    data class Success(val contacts: List<ContactRuleEntity>) : ContactsUiState()
    data class Error(val message: String) : ContactsUiState()
}

@HiltViewModel
class ContactsViewModel @Inject constructor(
    private val contactRuleDao: ContactRuleDao
) : ViewModel() {

    private val _uiState = MutableStateFlow<ContactsUiState>(ContactsUiState.Loading)
    val uiState: StateFlow<ContactsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            contactRuleDao.getAll()
                .catch { e ->
                    _uiState.value = ContactsUiState.Error(e.message ?: "Failed to load contacts")
                }
                .collect { contacts ->
                    _uiState.value = ContactsUiState.Success(contacts)
                }
        }
    }
}
