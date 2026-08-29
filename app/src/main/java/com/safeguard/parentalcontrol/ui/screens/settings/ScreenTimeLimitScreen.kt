package com.safeguard.parentalcontrol.ui.screens.settings

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safeguard.parentalcontrol.data.local.ScreenTimeLimitPreferences
import com.safeguard.parentalcontrol.security.SecureScreen
import com.safeguard.parentalcontrol.viewmodel.settings.ScreenTimeLimitViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScreenTimeLimitScreen(
    viewModel: ScreenTimeLimitViewModel = hiltViewModel()
) {
    SecureScreen {
        ScreenTimeLimitScreenContent(viewModel = viewModel)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScreenTimeLimitScreenContent(
    viewModel: ScreenTimeLimitViewModel
) {
    val context = LocalContext.current
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.isSaved) {
        if (state.isSaved) {
            Toast.makeText(context, "Screen time limit saved", Toast.LENGTH_SHORT).show()
            viewModel.acknowledgeSaved()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Daily Screen Time") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            CurrentConfigCard(
                enabled = state.enabled,
                dailyLimitMinutes = state.dailyLimitMinutes
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Enable daily limit",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "When enabled, the child is notified and apps are blocked once the daily limit is reached",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(checked = state.enabled, onCheckedChange = viewModel::setEnabled)
            }

            HorizontalDivider()

            OutlinedTextField(
                value = state.dailyLimitMinutes.toString(),
                onValueChange = { raw ->
                    val parsed = raw.toIntOrNull() ?: 0
                    viewModel.setDailyLimitMinutes(parsed)
                },
                label = { Text("Daily limit (minutes)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Text(
                text = "Valid range: ${ScreenTimeLimitPreferences.MIN_LIMIT_MINUTES} – ${ScreenTimeLimitPreferences.MAX_LIMIT_MINUTES} minutes",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            state.error?.let {
                Text(
                    text = it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = { viewModel.save() },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Save")
            }
        }
    }
}

@Composable
private fun CurrentConfigCard(
    enabled: Boolean,
    dailyLimitMinutes: Int
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Current configuration",
                style = MaterialTheme.typography.titleSmall
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Status: ${if (enabled) "Enabled" else "Disabled"}",
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = "Limit: $dailyLimitMinutes minutes/day (${dailyLimitMinutes / 60}h ${dailyLimitMinutes % 60}m)",
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}
