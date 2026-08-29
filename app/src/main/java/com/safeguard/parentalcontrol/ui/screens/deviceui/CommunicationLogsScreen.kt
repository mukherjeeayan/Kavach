package com.safeguard.parentalcontrol.ui.screens.deviceui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safeguard.parentalcontrol.data.local.entity.ContactRuleEntity
import com.safeguard.parentalcontrol.viewmodel.deviceui.CommunicationLogsUiState
import com.safeguard.parentalcontrol.viewmodel.deviceui.CommunicationLogsViewModel

@Composable
fun CommunicationLogsScreen(
    modifier: Modifier = Modifier,
    viewModel: CommunicationLogsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = "Communication Rules", style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Call and SMS filtering rules applied to this device.",
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Button(onClick = { viewModel.syncFromServer() }) {
            Text("Sync from server")
        }
        Spacer(modifier = Modifier.height(16.dp))

        when (val state = uiState) {
            is CommunicationLogsUiState.Loading -> Centered(modifier) {
                CircularProgressIndicator()
            }
            is CommunicationLogsUiState.Error -> Centered(modifier) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = state.message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { viewModel.loadLogs() }) {
                        Text("Retry")
                    }
                }
            }
            is CommunicationLogsUiState.Success -> {
                if (state.contactRules.isEmpty()) {
                    Text(
                        text = "No communication rules configured. Your parent can set up call and SMS filtering from the dashboard.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        items(state.contactRules, key = { it.id }) { rule ->
                            CommunicationRuleRow(rule)
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CommunicationRuleRow(rule: ContactRuleEntity) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = rule.contactName ?: rule.phoneNumber,
                style = MaterialTheme.typography.bodyLarge
            )
            if (rule.contactName != null) {
                Text(
                    text = rule.phoneNumber,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        Surface(
            shape = MaterialTheme.shapes.small,
            color = if (rule.ruleType == "BLOCK") {
                MaterialTheme.colorScheme.errorContainer
            } else {
                MaterialTheme.colorScheme.secondaryContainer
            }
        ) {
            Text(
                text = if (rule.ruleType == "BLOCK") "Blocked" else "Allowed",
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}

@Composable
private fun Centered(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        content()
    }
}
