package com.safeguard.parentalcontrol.ui.screens.deviceui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safeguard.parentalcontrol.data.local.entity.LocationEntryEntity
import com.safeguard.parentalcontrol.viewmodel.deviceui.LocationUiState
import com.safeguard.parentalcontrol.viewmodel.deviceui.LocationViewModel
import java.util.Locale

/**
 * Last-known location for the child device: the latest local pings and
 * (after tapping refresh) the server's current ping. Tapping a ping
 * opens the location in Google Maps.
 */
@Composable
fun LocationScreen(
    modifier: Modifier = Modifier,
    viewModel: LocationViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = "Location", style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Showing your device's last known location.",
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(modifier = Modifier.height(16.dp))

        when (val state = uiState) {
            is LocationUiState.Loading -> Centered(modifier) { CircularProgressIndicator() }
            is LocationUiState.Error -> Centered(modifier) {
                Text(text = state.message, color = MaterialTheme.colorScheme.error)
            }
            is LocationUiState.Success -> {
                val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = viewModel::refreshFromServer,
                        enabled = !isRefreshing
                    ) {
                        if (isRefreshing) {
                            CircularProgressIndicator(
                                modifier = Modifier.padding(end = 8.dp),
                                strokeWidth = 2.dp
                            )
                        }
                        Text("Refresh from server")
                    }
                    if (state.serverPings.isNotEmpty()) {
                        Text(
                            text = "Last: ${state.serverPings.size} pings",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))

                val pings = state.serverPings.ifEmpty { state.localPings }
                if (pings.isEmpty()) {
                    Text(
                        text = "No location recorded yet. It appears once the device reports a fix.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        items(pings, key = { it.id }) { ping ->
                            LocationRow(ping) {
                                val uri = Uri.parse(
                                    "geo:${ping.latitude},${ping.longitude}?q=${ping.latitude},${ping.longitude}"
                                )
                                context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                            }
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LocationRow(ping: LocationEntryEntity, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = String.format(Locale.US, "%.6f, %.6f", ping.latitude, ping.longitude),
                style = MaterialTheme.typography.bodyLarge
            )
            val time = java.time.Instant.ofEpochMilli(ping.recordedAt)
                .atZone(java.time.ZoneId.systemDefault())
                .format(java.time.format.DateTimeFormatter.ofPattern("HH:mm", java.util.Locale.US))
            Text(
                text = ping.accuracyM?.let { "Recorded at $time · accuracy ±${it.toInt()} m" }
                    ?: "Recorded at $time",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
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