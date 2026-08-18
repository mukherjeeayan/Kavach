package com.safeguard.parentalcontrol.ui.screens.onboarding.steps

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.safeguard.parentalcontrol.security.SafeGuardDeviceAdminReceiver

/**
 * Step 4: grant the permissions enforcement needs. The final button
 * gates on all permissions; the child should not be able to reach
 * the dashboard with blocking crippled.
 */
@Composable
internal fun PermissionsStep(
    context: Context,
    onFinished: () -> Unit
) {
    val usageGranted = remember { hasUsageAccess(context) }
    val adminActive = remember { isAdminActive(context) }
    val notificationGranted = remember { hasNotificationPermission(context) }

    val usageAccessLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { }
    val deviceAdminLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { }
    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        PermissionRow(
            title = "Usage Statistics",
            description = "Lets SafeGuard see which apps are open so it can block them.",
            granted = usageGranted,
            onRequest = {
                usageAccessLauncher.launch(
                    Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                )
            }
        )
        PermissionRow(
            title = "Device Administrator",
            description = "Prevents SafeGuard from being uninstalled or disabled.",
            granted = adminActive,
            onRequest = {
                val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                    putExtra(
                        DevicePolicyManager.EXTRA_DEVICE_ADMIN,
                        ComponentName(context, SafeGuardDeviceAdminReceiver::class.java)
                    )
                    putExtra(
                        DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                        "Required so SafeGuard can keep protecting this device."
                    )
                }
                deviceAdminLauncher.launch(intent)
            }
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PermissionRow(
                title = "Notifications",
                description = "Shows the ongoing protection status.",
                granted = notificationGranted,
                onRequest = {
                    notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            )
        }

        Spacer(Modifier.height(8.dp))
        Button(
            onClick = onFinished,
            enabled = usageGranted && adminActive && notificationGranted,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Finish Setup")
        }
        Text(
            "Setup can always be revisited in the app.",
            style = MaterialTheme.typography.bodySmall
        )
    }
}

@Composable
private fun PermissionRow(
    title: String,
    description: String,
    granted: Boolean,
    onRequest: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(
                    if (granted) "Granted" else "Not granted",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (granted) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.error
                    }
                )
            }
            Text(description, style = MaterialTheme.typography.bodySmall)
            if (!granted) {
                OutlinedButton(onClick = onRequest, modifier = Modifier.fillMaxWidth()) {
                    Text("Grant")
                }
            }
        }
    }
}
