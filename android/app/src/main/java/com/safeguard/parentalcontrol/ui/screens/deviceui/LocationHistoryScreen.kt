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
import com.safeguard.parentalcontrol.data.remote.dto.LocationDto
import com.safeguard.parentalcontrol.viewmodel.deviceui.LocationHistoryUiState
import com.safeguard.parentalcontrol.viewmodel.deviceui.LocationHistoryViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun LocationHistoryScreen(
    modifier: Modifier = Modifier,
    viewModel: LocationHistoryViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = "Location History", style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Historical location data from the server.",
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Button(onClick = { viewModel.loadHistory() }) {
            Text("Refresh")
        }
        Spacer(modifier = Modifier.height(16.dp))

        when (val state = uiState) {
            is LocationHistoryUiState.Loading -> Centered(modifier) {
                CircularProgressIndicator()
            }
            is LocationHistoryUiState.Error -> Centered(modifier) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = state.message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { viewModel.loadHistory() }) {
                        Text("Retry")
                    }
                }
            }
            is LocationHistoryUiState.Success -> {
                state.lastUpdated?.let { last ->
                    val formatted = try {
                        Instant.parse(last)
                            .atZone(ZoneId.systemDefault())
                            .format(DateTimeFormatter.ofPattern("MMM d, HH:mm", Locale.US))
                    } catch (_: Exception) { last }
                    Text(
                        text = "Last updated: $formatted",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }
                if (state.locations.isEmpty()) {
                    Text(
                        text = "No location history available. Location data appears once the device reports GPS fixes.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        items(state.locations, key = { it.id }) { location ->
                            LocationHistoryRow(location) {
                                val uri = Uri.parse(
                                    "geo:${location.latitude},${location.longitude}?q=${location.latitude},${location.longitude}"
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
private fun LocationHistoryRow(location: LocationDto, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = String.format(Locale.US, "%.6f, %.6f", location.latitude, location.longitude),
                style = MaterialTheme.typography.bodyLarge
            )
            val time = try {
                Instant.parse(location.recorded_at)
                    .atZone(ZoneId.systemDefault())
                    .format(DateTimeFormatter.ofPattern("MMM d, HH:mm:ss", Locale.US))
            } catch (_: Exception) { location.recorded_at }
            Text(
                text = location.accuracy_m?.let { "$time · ±${it.toInt()}m" } ?: time,
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
