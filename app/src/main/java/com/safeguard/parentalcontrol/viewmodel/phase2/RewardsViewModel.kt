package com.safeguard.parentalcontrol.viewmodel.phase2

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safeguard.parentalcontrol.data.remote.dto.RewardCatalogDto
import com.safeguard.parentalcontrol.data.remote.dto.RewardPointsDto
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
    val isLoading: Boolean = true,
    val error: String? = null
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
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val catalogResponse = parentApi.getRewardCatalog()
                val pointsResponse = parentApi.getChildPoints(childId)

                val catalog = if (catalogResponse.isSuccessful && catalogResponse.body()?.success == true) {
                    catalogResponse.body()?.data ?: emptyList()
                } else emptyList()

                val points = if (pointsResponse.isSuccessful && pointsResponse.body()?.success == true) {
                    pointsResponse.body()?.data
                } else null

                _uiState.value = RewardsState(
                    catalog = catalog,
                    points = points,
                    isLoading = false
                )
            } catch (e: Exception) {
                _uiState.value = RewardsState(
                    isLoading = false,
                    error = e.message ?: "Failed to load rewards"
                )
            }
        }
    }
}
