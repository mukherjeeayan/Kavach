package com.safeguard.parentalcontrol.ui.screens.settings

import android.app.TimePickerDialog
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safeguard.parentalcontrol.security.SecureScreen
import com.safeguard.parentalcontrol.viewmodel.settings.BedtimeViewModel
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BedtimeConfigScreen(
    viewModel: BedtimeViewModel = hiltViewModel()
) {
    SecureScreen {
        BedtimeConfigScreenContent(viewModel = viewModel)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BedtimeConfigScreenContent(
    viewModel: BedtimeViewModel
) {
    val context = LocalContext.current
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.isSaved) {
        if (state.isSaved) {
            Toast.makeText(context, "Bedtime settings saved", Toast.LENGTH_SHORT).show()
            viewModel.acknowledgeSaved()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Bedtime") },
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
                start = state.bedtimeStart,
                end = state.bedtimeEnd,
                dndEnabled = state.dndEnabled
            )

            SettingRow(
                title = "Enable bedtime",
                subtitle = "Send a reminder and lock apps during this window",
                checked = state.enabled,
                onCheckedChange = viewModel::setEnabled
            )

            HorizontalDivider()

            Text("Window", style = MaterialTheme.typography.titleMedium)

            TimeRow(
                label = "Start",
                time = state.bedtimeStart,
                enabled = state.enabled,
                onTimeSelected = viewModel::setStart
            )

            TimeRow(
                label = "End",
                time = state.bedtimeEnd,
                enabled = state.enabled,
                onTimeSelected = viewModel::setEnd
            )

            HorizontalDivider()

            SettingRow(
                title = "Do Not Disturb",
                subtitle = "Best-effort DND during bedtime (requires permission)",
                checked = state.dndEnabled,
                onCheckedChange = viewModel::setDndEnabled
            )

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
    start: LocalTime,
    end: LocalTime,
    dndEnabled: Boolean
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
                text = "Window: ${formatTime(start)} – ${formatTime(end)}",
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = "DND: ${if (dndEnabled) "On" else "Off"}",
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun SettingRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = MaterialTheme.typography.titleMedium)
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun TimeRow(
    label: String,
    time: LocalTime,
    enabled: Boolean,
    onTimeSelected: (LocalTime) -> Unit
) {
    val context = LocalContext.current
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f)
        )
        OutlinedButton(
            onClick = {
                val dialog = TimePickerDialog(
                    context,
                    { _, hour, minute ->
                        onTimeSelected(LocalTime.of(hour, minute))
                    },
                    time.hour,
                    time.minute,
                    true
                )
                dialog.show()
            },
            enabled = enabled
        ) {
            Text(formatTime(time))
            Spacer(modifier = Modifier.height(0.dp))
            Icon(
                imageVector = Icons.Filled.ArrowDropDown,
                contentDescription = null
            )
        }
    }
}

private fun formatTime(time: LocalTime): String =
    time.format(DateTimeFormatter.ofPattern("HH:mm", Locale.US))
