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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safeguard.parentalcontrol.viewmodel.settings.SettingsEvent
import com.safeguard.parentalcontrol.viewmodel.settings.SettingsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onChangePin: () -> Unit,
    onOpenBedtime: () -> Unit,
    onOpenScreenTimeLimit: () -> Unit,
    onLoggedOut: () -> Unit,
    onUnenrolled: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val event by viewModel.events.collectAsStateWithLifecycle()
    var showUnenrollDialog by remember { mutableStateOf(false) }

    LaunchedEffect(event) {
        when (val e = event) {
            is SettingsEvent.LoggedOut -> {
                viewModel.consumeEvent()
                onLoggedOut()
            }
            is SettingsEvent.Unenrolled -> {
                viewModel.consumeEvent()
                onUnenrolled()
            }
            is SettingsEvent.Error -> {
                Toast.makeText(context, e.message, Toast.LENGTH_SHORT).show()
                viewModel.consumeEvent()
            }
            else -> Unit
        }
    }

    if (showUnenrollDialog) {
        AlertDialog(
            onDismissRequest = { showUnenrollDialog = false },
            title = { Text("Unenroll this device?") },
            text = {
                Text(
                    "This will remove device admin, sign you out, and wipe all local SafeGuard data. " +
                        "You will need to set up the device again to use parental controls."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showUnenrollDialog = false
                        viewModel.unenroll()
                    }
                ) {
                    Text("Unenroll", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showUnenrollDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            InfoCard(title = "App version", value = uiState.appVersion)
            InfoCard(
                title = "Device admin",
                value = if (uiState.isDeviceAdminActive) "Active" else "Inactive"
            )
            InfoCard(
                title = "Parent PIN",
                value = "Configured (6 to 16 digits)"
            )
            InfoCard(
                title = "Child",
                value = uiState.childName.ifEmpty { "Not set" }
            )

            Spacer(Modifier.height(8.dp))

            OutlinedButton(
                onClick = onChangePin,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Filled.Lock, contentDescription = null)
                Spacer(Modifier.height(0.dp))
                Text("  Change parent PIN")
            }

            OutlinedButton(
                onClick = onOpenBedtime,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Filled.Bedtime, contentDescription = null)
                Spacer(Modifier.height(0.dp))
                Text("  Bedtime settings")
            }

            OutlinedButton(
                onClick = onOpenScreenTimeLimit,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Filled.Timer, contentDescription = null)
                Spacer(Modifier.height(0.dp))
                Text("  Daily screen time limit")
            }

            OutlinedButton(
                onClick = { viewModel.logout() },
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isLoading
            ) {
                Icon(Icons.Filled.Person, contentDescription = null)
                Text("  Logout")
            }

            Spacer(Modifier.height(8.dp))

            Button(
                onClick = { showUnenrollDialog = true },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error,
                    contentColor = MaterialTheme.colorScheme.onError
                )
            ) {
                Icon(Icons.Filled.Security, contentDescription = null)
                Text("  Unenroll device")
            }
        }
    }
}

@Composable
private fun InfoCard(title: String, value: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}
