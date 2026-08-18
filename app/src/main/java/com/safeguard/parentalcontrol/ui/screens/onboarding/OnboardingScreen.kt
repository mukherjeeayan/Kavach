package com.safeguard.parentalcontrol.ui.screens.onboarding

import android.Manifest
import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safeguard.parentalcontrol.data.remote.dto.ChildDto
import com.safeguard.parentalcontrol.security.SafeGuardDeviceAdminReceiver
import com.safeguard.parentalcontrol.viewmodel.onboarding.OnboardingStep
import com.safeguard.parentalcontrol.viewmodel.onboarding.OnboardingViewModel

/**
 * Four-step parent onboarding:
 *  1. Login (parent credentials)
 *  2. Select or create the child profile
 *  3. Register this device
 *  4. Grant the permissions enforcement needs
 *
 * The final step gates on all permissions; the child should not be
 * able to reach the dashboard with blocking crippled.
 */
@Composable
fun OnboardingScreen(
    onComplete: () -> Unit,
    viewModel: OnboardingViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val step by viewModel.step.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()

    var selectedChild by remember { mutableStateOf<ChildDto?>(null) }

    LaunchedEffect(step) {
        if (step == OnboardingStep.Done) onComplete()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(32.dp))
        Text("SafeGuard Setup", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            text = when (step) {
                OnboardingStep.Login -> "Sign in with your parent account"
                OnboardingStep.Child -> "Who will use this device?"
                OnboardingStep.Device -> "Name this device"
                OnboardingStep.Permissions -> "Grant protection permissions"
                OnboardingStep.Done -> ""
            },
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(Modifier.height(24.dp))

        error?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall
            )
            Spacer(Modifier.height(8.dp))
        }

        when (step) {
            OnboardingStep.Login -> LoginStep(viewModel)
            OnboardingStep.Child -> ChildStep(
                children = viewModel.children.collectAsStateWithLifecycle().value,
                isLoading = isLoading,
                onSelect = { child ->
                    selectedChild = child
                    viewModel.selectChild(child)
                },
                onCreate = viewModel::createChild
            )
            OnboardingStep.Device -> DeviceStep(
                childName = selectedChild?.name ?: "",
                isLoading = isLoading,
                onRegister = { name ->
                    selectedChild?.let { viewModel.registerDevice(it, name) }
                }
            )
            OnboardingStep.Permissions -> PermissionsStep(
                context = context,
                onFinished = viewModel::finishOnboarding
            )
            OnboardingStep.Done -> {}
        }
    }
}

// ── Step 1: Login ─────────────────────────────────────────────────

@Composable
private fun LoginStep(viewModel: OnboardingViewModel) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            onClick = {
                viewModel.clearError()
                viewModel.login(email, password)
            },
            enabled = !isLoading && email.isNotBlank() && password.isNotBlank(),
            modifier = Modifier.fillMaxWidth()
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.height(20.dp),
                    strokeWidth = 2.dp
                )
            } else {
                Text("Sign In")
            }
        }
    }
}

// ── Step 2: Select / create child ─────────────────────────────────

@Composable
private fun ChildStep(
    children: List<ChildDto>,
    isLoading: Boolean,
    onSelect: (ChildDto) -> Unit,
    onCreate: (String) -> Unit
) {
    var newChildName by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (children.isEmpty()) {
            Text(
                "No child profiles yet — create one to continue.",
                style = MaterialTheme.typography.bodyMedium
            )
        } else {
            children.forEach { child ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(child.name, style = MaterialTheme.typography.titleMedium)
                        OutlinedButton(onClick = { onSelect(child) }) {
                            Text("Use")
                        }
                    }
                }
            }
        }

        OutlinedTextField(
            value = newChildName,
            onValueChange = { newChildName = it },
            label = { Text("Or add a child profile") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            onClick = { onCreate(newChildName) },
            enabled = !isLoading && newChildName.isNotBlank(),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Create Profile")
        }
    }
}

// ── Step 3: Device name ───────────────────────────────────────────

@Composable
private fun DeviceStep(
    childName: String,
    isLoading: Boolean,
    onRegister: (String) -> Unit
) {
    var deviceName by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            "Registering this device for $childName",
            style = MaterialTheme.typography.bodyMedium
        )
        OutlinedTextField(
            value = deviceName,
            onValueChange = { deviceName = it },
            label = { Text("Device name (e.g. Kid's Phone)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            onClick = { onRegister(deviceName) },
            enabled = !isLoading,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Register Device")
        }
    }
}

// ── Step 4: Permissions ───────────────────────────────────────────

@Composable
private fun PermissionsStep(
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

// ── Permission helpers ────────────────────────────────────────────

private fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
    } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
    }
    return mode == AppOpsManager.MODE_ALLOWED
}

private fun isAdminActive(context: Context): Boolean {
    val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    return dpm.isAdminActive(
        ComponentName(context, SafeGuardDeviceAdminReceiver::class.java)
    )
}

private fun hasNotificationPermission(context: Context): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
}