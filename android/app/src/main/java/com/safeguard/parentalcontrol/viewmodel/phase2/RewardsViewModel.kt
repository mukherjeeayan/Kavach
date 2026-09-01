package com.safeguard.parentalcontrol.viewmodel.phase2

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.remote.dto.RewardCatalogDto
import com.safeguard.parentalcontrol.data.remote.dto.RewardPointsDto
import com.safeguard.parentalcontrol.data.remote.dto.RewardRedemptionDto
import com.safeguard.parentalcontrol.data.remote.dto.RewardRedemptionRequestDto
import com.safeguard.parentalcontrol.data.remote.api.ParentPhase2Api
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RewardsState(
    val catalog: List<RewardCatalogDto> = emptyList(),
    val points: RewardPointsDto? = null,
    val redemptions: List<RewardRedemptionDto> = emptyList(),
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val isSubmitting: Boolean = false,
    val error: String? = null,
    val lastSubmittedRewardId: String? = null,
    val toast: String? = null
)

@HiltViewModel
class RewardsViewModel @Inject constructor(
    private val parentApi: ParentPhase2Api,
    private val onboardingStore: OnboardingStore
) : ViewModel() {

    private val _uiState = MutableStateFlow(RewardsState())
    val uiState: StateFlow<RewardsState> = _uiState.asStateFlow()

    private val childId: String get() = onboardingStore.childId ?: ""

    init {
        loadRewards()
    }

    fun loadRewards() {
        _uiState.value = _uiState.value.copy(isLoading = true, error = null)
        refresh(showRefreshing = false)
    }

    /**
     * Re-fetches catalog, points and redemption history. Used both on
     * initial load and on pull-to-refresh so the child sees the latest
     * server-side state (e.g. parent approving a request).
     */
    fun refresh(showRefreshing: Boolean = true) {
        if (childId.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                isRefreshing = false,
                error = "Child not linked"
            )
            return
        }
        viewModelScope.launch {
            if (showRefreshing) {
                _uiState.value = _uiState.value.copy(isRefreshing = true, error = null)
            }
            try {
                val catalogResponse = parentApi.getRewardCatalog()
                val pointsResponse = parentApi.getChildPoints(childId)
                val redemptionsResponse = parentApi.getRedemptions(childId)

                val catalog = if (catalogResponse.isSuccessful &&
                    catalogResponse.body()?.success == true
                ) {
                    catalogResponse.body()?.data ?: emptyList()
                } else emptyList()

                val points = if (pointsResponse.isSuccessful &&
                    pointsResponse.body()?.success == true
                ) {
                    pointsResponse.body()?.data
                } else null

                val redemptions = if (redemptionsResponse.isSuccessful &&
                    redemptionsResponse.body()?.success == true
                ) {
                    redemptionsResponse.body()?.data ?: emptyList()
                } else emptyList()

                _uiState.value = _uiState.value.copy(
                    catalog = catalog,
                    points = points,
                    redemptions = redemptions,
                    isLoading = false,
                    isRefreshing = false,
                    error = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    error = e.message ?: "Failed to load rewards"
                )
            }
        }
    }

    /**
     * Submits a redemption request for [reward] and refreshes the
     * history on success. Errors are surfaced via [RewardsState.toast]
     * so the UI can show a snackbar/toast without losing the form.
     */
    fun submitRedemption(reward: RewardCatalogDto) {
        if (childId.isEmpty()) {
            _uiState.value = _uiState.value.copy(toast = "Child not linked")
            return
        }
        if (_uiState.value.isSubmitting) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSubmitting = true, error = null)
            try {
                val response = parentApi.requestRedemption(
                    RewardRedemptionRequestDto(
                        childId = childId,
                        rewardId = reward.id
                    )
                )
                if (response.isSuccessful && response.body()?.success == true) {
                    _uiState.value = _uiState.value.copy(
                        isSubmitting = false,
                        lastSubmittedRewardId = reward.id,
                        toast = "Request submitted for ${reward.name}"
                    )
                    refresh(showRefreshing = false)
                } else {
                    val msg = response.body()?.error ?: "Redemption failed (${response.code()})"
                    _uiState.value = _uiState.value.copy(
                        isSubmitting = false,
                        toast = msg
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isSubmitting = false,
                    toast = e.message ?: "Redemption failed"
                )
            }
        }
    }

    /** Clears the one-shot toast string once the UI has shown it. */
    fun consumeToast() {
        if (_uiState.value.toast == null) return
        _uiState.value = _uiState.value.copy(toast = null)
    }
}
