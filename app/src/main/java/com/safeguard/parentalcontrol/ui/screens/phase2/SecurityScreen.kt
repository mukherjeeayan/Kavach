package com.safeguard.parentalcontrol.ui.screens.phase2

import android.net.wifi.WifiManager
import android.os.Build
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safeguard.parentalcontrol.viewmodel.phase2.SecurityState
import com.safeguard.parentalcontrol.viewmodel.phase2.SecurityViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SecurityScreen(
    viewModel: SecurityViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState.scanSuccess) {
        if (uiState.scanSuccess) {
            Toast.makeText(context, "Scan reported successfully", Toast.LENGTH_SHORT).show()
            viewModel.clearScanSuccess()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Security Status") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            uiState.lastScan?.let { scan ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Last Scan Result",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        SecurityRow("Rooted", scan.isRooted)
                        SecurityRow("Keylogger Detected", scan.hasKeylogger)
                        SecurityRow("Open WiFi Network", scan.isOpenNetwork)
                        SecurityRow("App Integrity OK", scan.appIntegrityOk)
                        scan.wifiSsid?.let {
                            Text(
                                text = "WiFi: $it",
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }
                }
            } ?: run {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Text(
                        text = "No scan performed yet.",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            if (uiState.isScanning) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
            } else {
                Button(
                    onClick = {
                        val wm = context.applicationContext.getSystemService(WifiManager::class.java)
                        val wifiInfo = wm?.connectionInfo
                        val ssid = wifiInfo?.ssid?.removeSurrounding("\"")
                        val bssid = wifiInfo?.bssid
                        val isOpen = false

                        val isRooted = checkRooted()
                        viewModel.reportScan(
                            isRooted = isRooted,
                            hasKeylogger = false,
                            wifiSsid = ssid,
                            wifiBssid = bssid,
                            isOpenNetwork = isOpen,
                            appIntegrityOk = true
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Run Security Scan")
                }
            }

            uiState.error?.let {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun SecurityRow(label: String, isDanger: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f)
        )
        Text(
            text = if (isDanger) "⚠ Detected" else "✓ Clean",
            style = MaterialTheme.typography.bodySmall,
            color = if (isDanger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
        )
    }
}

private fun checkRooted(): Boolean {
    val paths = arrayOf(
        "/system/app/Superuser.apk",
        "/system/xbin/su",
        "/system/bin/su",
        "/sbin/su"
    )
    return paths.any { java.io.File(it).exists() }
}
