package com.safeguard.parentalcontrol.ui.screens.phase2

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safeguard.parentalcontrol.data.remote.dto.RewardCatalogDto
import com.safeguard.parentalcontrol.data.remote.dto.RewardRedemptionDto
import com.safeguard.parentalcontrol.viewmodel.phase2.RewardsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RewardsScreen(
    viewModel: RewardsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var pendingReward by remember { mutableStateOf<RewardCatalogDto?>(null) }

    val toastMessage = uiState.toast
    LaunchedEffect(toastMessage) {
        if (!toastMessage.isNullOrEmpty()) {
            Toast.makeText(context, toastMessage, Toast.LENGTH_SHORT).show()
            viewModel.consumeToast()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Rewards") },
                actions = {
                    IconButton(
                        onClick = { viewModel.refresh(showRefreshing = true) },
                        enabled = !uiState.isRefreshing
                    ) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                uiState.isLoading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                uiState.error != null && uiState.catalog.isEmpty() -> {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = uiState.error ?: "",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadRewards() }) {
                            Text("Retry")
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp)
                    ) {
                        if (uiState.isRefreshing) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        strokeWidth = 2.dp
                                    )
                                }
                            }
                        }
                        item {
                            uiState.points?.let { points ->
                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(bottom = 16.dp),
                                    colors = CardDefaults.cardColors(
                                        containerColor = MaterialTheme.colorScheme.secondaryContainer
                                    )
                                ) {
                                    Column(
                                        modifier = Modifier.padding(16.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text(
                                            text = "${points.available}",
                                            style = MaterialTheme.typography.headlineLarge,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                        Text(
                                            text = "Available Points",
                                            style = MaterialTheme.typography.bodyMedium
                                        )
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(
                                            text = "Earned: ${points.totalEarned} | Redeemed: ${points.totalRedeemed}",
                                            style = MaterialTheme.typography.labelMedium,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }
                        }

                        item {
                            Text(
                                text = "Catalog",
                                style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.padding(vertical = 8.dp)
                            )
                        }

                        items(uiState.catalog, key = { it.id }) { reward ->
                            RewardCatalogRow(
                                reward = reward,
                                isSubmitting = uiState.isSubmitting,
                                isJustSubmitted = uiState.lastSubmittedRewardId == reward.id,
                                affordable = (uiState.points?.available ?: 0) >= reward.pointsCost,
                                onRedeem = { pendingReward = reward }
                            )
                        }

                        item {
                            Spacer(modifier = Modifier.height(24.dp))
                            Text(
                                text = "Redemption History",
                                style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.padding(vertical = 8.dp)
                            )
                        }

                        if (uiState.redemptions.isEmpty()) {
                            item {
                                Text(
                                    text = "No redemption requests yet.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }
                        } else {
                            items(uiState.redemptions, key = { it.id }) { redemption ->
                                RedemptionRow(redemption = redemption)
                            }
                        }
                    }
                }
            }
        }
    }

    pendingReward?.let { reward ->
        RedeemConfirmDialog(
            reward = reward,
            isSubmitting = uiState.isSubmitting,
            onConfirm = {
                viewModel.submitRedemption(reward)
                pendingReward = null
            },
            onDismiss = { pendingReward = null }
        )
    }
}

@Composable
private fun RewardCatalogRow(
    reward: RewardCatalogDto,
    isSubmitting: Boolean,
    isJustSubmitted: Boolean,
    affordable: Boolean,
    onRedeem: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = reward.name,
                    style = MaterialTheme.typography.titleMedium
                )
                reward.description?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "${reward.pointsCost} pts",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary
                )
                if (isJustSubmitted) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Request submitted",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.tertiary
                    )
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Button(
                onClick = onRedeem,
                enabled = !isSubmitting && reward.isActive && affordable
            ) {
                Text("Redeem")
            }
        }
    }
}

@Composable
private fun RedemptionRow(redemption: RewardRedemptionDto) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = redemption.rewardName ?: "Reward",
                    style = MaterialTheme.typography.titleSmall
                )
                Text(
                    text = "${redemption.pointsCost} pts",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                redemption.requestedAt?.let {
                    Text(
                        text = "Requested: $it",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            RedemptionStatusChip(status = redemption.status)
        }
    }
}

@Composable
private fun RedemptionStatusChip(status: String) {
    val (label, container) = when (status.lowercase()) {
        "approved", "fulfilled" -> "Approved" to MaterialTheme.colorScheme.tertiaryContainer
        "rejected", "declined" -> "Rejected" to MaterialTheme.colorScheme.errorContainer
        "pending" -> "Pending" to MaterialTheme.colorScheme.secondaryContainer
        else -> status.replaceFirstChar { it.uppercase() } to MaterialTheme.colorScheme.surface
    }
    Surface(
        color = container,
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun RedeemConfirmDialog(
    reward: RewardCatalogDto,
    isSubmitting: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = { if (!isSubmitting) onDismiss() },
        title = { Text("Redeem ${reward.name}?") },
        text = {
            Column {
                Text("This will cost ${reward.pointsCost} points.")
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Your request will be sent for approval.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                enabled = !isSubmitting
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Confirm")
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isSubmitting
            ) {
                Text("Cancel")
            }
        }
    )
}
