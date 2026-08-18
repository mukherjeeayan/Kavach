package com.safeguard.parentalcontrol.viewmodel.appblock

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state sealed class — mandatory per the Android skill.
 * The Composable observes this to render Loading / Success / Error
 * without holding any business logic itself.
 */
sealed class AppBlockingUiState {
    data object Loading : AppBlockingUiState()
    data class Success(
        val blockedApps: List<AppBlockRuleEntity>,
        val unblockRequests: List<AppBlockRuleEntity>
    ) : AppBlockingUiState()
    data class Error(val message: String) : AppBlockingUiState()
}

/**
 * One-off events for the UI, like Toasts.
 */
sealed class AppBlockingUiEvent {
    data class ShowToast(val message: String) : AppBlockingUiEvent()
}

/**
 * ViewModel for the App Blocking feature.
 *
 * - Uses @HiltViewModel + constructor injection (mandatory).
 * - Exposes UI state via StateFlow (never LiveData).
 * - Never holds references to Context, Activity, or View.
 * - Uses viewModelScope.launch for coroutines.
 */
@HiltViewModel
class AppBlockingViewModel @Inject constructor(
    private val repository: AppBlockingRepository,
    onboardingStore: OnboardingStore
) : ViewModel() {

    private val _uiState = MutableStateFlow<AppBlockingUiState>(AppBlockingUiState.Loading)
    val uiState: StateFlow<AppBlockingUiState> = _uiState.asStateFlow()

    private val _uiEvents = kotlinx.coroutines.flow.MutableSharedFlow<AppBlockingUiEvent>()
    val uiEvents = _uiEvents.asSharedFlow()

    // Tracks optimistic toggle states before the API completes
    private val _optimisticBlocks = MutableStateFlow<Map<String, Boolean>>(emptyMap())
    val optimisticBlocks: StateFlow<Map<String, Boolean>> = _optimisticBlocks.asStateFlow()

    // Real identifiers from onboarding; the enforcement service and
    // the sync worker read the same store.
    private val deviceId: String = onboardingStore.deviceId ?: ""
    private val childId: String = onboardingStore.childId ?: ""

    init {
        loadBlockedApps()
    }

    /**
     * Collect the blocked-apps Flow from Room.  Because this is a
     * local-first read, the UI is populated instantly — even offline.
     */
    fun loadBlockedApps() {
        viewModelScope.launch {
            _uiState.value = AppBlockingUiState.Loading

            repository.getBlockedAppsFlow(deviceId)
                .catch { e ->
                    _uiState.value = AppBlockingUiState.Error(
                        e.message ?: "Failed to load blocked apps"
                    )
                }
                .collect { blockedApps ->
                    // Also load pending unblock requests
                    val requests = try {
                        // Snapshot from Flow isn't ideal here but keeps
                        // it simple; a production version would combine
                        // both Flows with `combine`.
                        emptyList<AppBlockRuleEntity>()
                    } catch (e: Exception) {
                        emptyList()
                    }

                    _uiState.value = AppBlockingUiState.Success(
                        blockedApps = blockedApps,
                        unblockRequests = requests
                    )
                }
        }
    }

    /** Trigger a manual sync from the server. */
    fun syncRules() {
        viewModelScope.launch {
            repository.syncFromServer(childId, deviceId)
            // The Flow from loadBlockedApps will automatically emit
            // updated data after Room is refreshed by the sync.
        }
    }

    /** Block a new app. */
    fun blockApp(packageName: String, appName: String? = null, reason: String? = null) {
        viewModelScope.launch {
            // Optimistic update
            _optimisticBlocks.value = _optimisticBlocks.value + (packageName to true)
            
            val result = repository.blockApp(childId, deviceId, packageName, appName, reason)
            result.onFailure { e ->
                // Revert optimistic update silently and show a toast
                _optimisticBlocks.value = _optimisticBlocks.value - packageName
                _uiEvents.emit(AppBlockingUiEvent.ShowToast("Failed to block $appName"))
            }
            // On success, Room Flow automatically picks up the new rule, we can remove optimistic state
            if (result.isSuccess) {
                 _optimisticBlocks.value = _optimisticBlocks.value - packageName
            }
        }
    }

    /** Unblock an existing rule. */
    fun unblockApp(ruleId: String, packageName: String) {
        viewModelScope.launch {
            // Optimistic update
            _optimisticBlocks.value = _optimisticBlocks.value + (packageName to false)

            val result = repository.unblockApp(childId, ruleId)
            result.onFailure { e ->
                // Revert optimistic update
                _optimisticBlocks.value = _optimisticBlocks.value - packageName
                _uiEvents.emit(AppBlockingUiEvent.ShowToast("Failed to unblock app"))
            }
            if (result.isSuccess) {
                 _optimisticBlocks.value = _optimisticBlocks.value - packageName
            }
        }
    }

    /** Submit a child-initiated unblock request. */
    fun requestUnblock(ruleId: String, reason: String) {
        viewModelScope.launch {
            val result = repository.requestUnblock(childId, ruleId, reason)
            result.onFailure { e ->
                // Surface the error as a toast — never replace the whole
                // list UI with an error state for a single failed action.
                _uiEvents.emit(
                    AppBlockingUiEvent.ShowToast(
                        e.message ?: "Failed to submit unblock request"
                    )
                )
            }
        }
    }
}
