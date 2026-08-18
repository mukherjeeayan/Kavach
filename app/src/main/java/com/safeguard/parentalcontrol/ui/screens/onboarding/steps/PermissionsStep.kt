package com.safeguard.parentalcontrol.ui.screens.onboarding.steps

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.app.role.RoleManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.safeguard.parentalcontrol.security.SafeGuardDeviceAdminReceiver

/**
 * Step 5: grant the permissions enforcement needs. The final button
 * gates on all permissions; the child should not be able to reach
 * the dashboard with blocking crippled.
 */
@Composable
internal fun PermissionsStep(
    context: Context,
    onFinished: () -> Unit
) {
    var usageGranted by remember { mutableStateOf(hasUsageAccess(context)) }
    var adminActive by remember { mutableStateOf(isAdminActive(context)) }
    var notificationGranted by remember { mutableStateOf(hasNotificationPermission(context)) }
    var locationGranted by remember { mutableStateOf(hasLocationPermission(context)) }
    var callScreeningHeld by remember { mutableStateOf(hasCallScreeningRole(context)) }

    val usageAccessLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        usageGranted = hasUsageAccess(context)
    }
    val deviceAdminLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        adminActive = isAdminActive(context)
    }
    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        notificationGranted = hasNotificationPermission(context)
    }
    val locationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        locationGranted = hasLocationPermission(context)
    }
    val callScreeningLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        callScreeningHeld = hasCallScreeningRole(context)
    }

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
        PermissionRow(
            title = "Location",
            description = "Shares the device location with your parent dashboard.",
            granted = locationGranted,
            onRequest = {
                locationLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            PermissionRow(
                title = "Call Screening",
                description = "Allows SafeGuard to reject calls from numbers you blocked.",
                granted = callScreeningHeld,
                onRequest = {
                    val roleManager = context.getSystemService(RoleManager::class.java)
                    callScreeningLauncher.launch(
                        roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
                    )
                }
            )
        }

        Spacer(Modifier.height(8.dp))
        Button(
            onClick = onFinished,
            enabled = usageGranted && adminActive && notificationGranted &&
                locationGranted && callScreeningHeld,
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

private fun hasLocationPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED

private fun hasCallScreeningRole(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
    return context.getSystemService(RoleManager::class.java)
        .isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
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
