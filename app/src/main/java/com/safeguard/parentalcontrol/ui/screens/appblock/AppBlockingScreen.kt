package com.safeguard.parentalcontrol.ui.screens.appblock

import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.Drawable
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.core.graphics.drawable.toBitmap
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.viewmodel.appblock.AppBlockingUiEvent
import com.safeguard.parentalcontrol.viewmodel.appblock.AppBlockingUiState
import com.safeguard.parentalcontrol.viewmodel.appblock.AppBlockingViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class InstalledApp(
    val packageName: String,
    val appName: String,
    val icon: Drawable
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppBlockingScreen(
    viewModel: AppBlockingViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val optimisticBlocks by viewModel.optimisticBlocks.collectAsStateWithLifecycle()

    // Handle UI events like Toasts
    LaunchedEffect(Unit) {
        viewModel.uiEvents.collect { event ->
            when (event) {
                is AppBlockingUiEvent.ShowToast -> {
                    Toast.makeText(context, event.message, Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // Fetch launchable apps using PackageManager — computed off the
    // main thread so the first composition stays smooth.
    val launchableApps by produceState<List<InstalledApp>>(
        initialValue = emptyList(),
        context.packageManager
    ) {
        value = withContext(Dispatchers.IO) {
            val intent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            context.packageManager.queryIntentActivities(intent, 0).map { resolveInfo ->
                val appInfo = resolveInfo.activityInfo.applicationInfo
                InstalledApp(
                    packageName = appInfo.packageName,
                    appName = appInfo.loadLabel(context.packageManager).toString(),
                    icon = appInfo.loadIcon(context.packageManager)
                )
            }.distinctBy { it.packageName }.sortedBy { it.appName.lowercase() }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("App Blocking") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is AppBlockingUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is AppBlockingUiState.Error -> {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = state.message,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadBlockedApps() }) {
                            Text("Retry")
                        }
                    }
                }
                is AppBlockingUiState.Success -> {
                    if (launchableApps.isEmpty()) {
                        Text(
                            text = "No launchable apps found.",
                            modifier = Modifier.align(Alignment.Center)
                        )
                    } else {
                        AppList(
                            apps = launchableApps,
                            blockedApps = state.blockedApps,
                            unblockRequests = state.unblockRequests,
                            optimisticBlocks = optimisticBlocks,
                            onBlockApp = { packageName, appName, reason ->
                                viewModel.blockApp(packageName, appName, reason)
                            },
                            onUnblockApp = { ruleId, packageName ->
                                viewModel.unblockApp(ruleId, packageName)
                            },
                            onRequestUnblock = { ruleId, reason ->
                                viewModel.requestUnblock(ruleId, reason)
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun AppList(
    apps: List<InstalledApp>,
    blockedApps: List<AppBlockRuleEntity>,
    unblockRequests: List<AppBlockRuleEntity>,
    optimisticBlocks: Map<String, Boolean>,
    onBlockApp: (String, String, String?) -> Unit,
    onUnblockApp: (String, String) -> Unit,
    onRequestUnblock: (String, String) -> Unit
) {
    var appToBlock by remember { mutableStateOf<InstalledApp?>(null) }
    var appToRequestUnblock by remember { mutableStateOf<AppBlockRuleEntity?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp)
    ) {
        items(apps, key = { it.packageName }) { app ->
            val blockedRule = blockedApps.find { it.packageName == app.packageName && it.isBlocked }
            val pendingRequest = unblockRequests.find { it.packageName == app.packageName }
            
            // Check optimistic state first, fallback to source of truth
            val isOptimisticallyBlocked = optimisticBlocks[app.packageName]
            val isCurrentlyBlocked = isOptimisticallyBlocked ?: (blockedRule != null)

            AppListItem(
                app = app,
                isBlocked = isCurrentlyBlocked,
                blockReason = blockedRule?.blockReason,
                unblockRequested = pendingRequest?.unblockRequested == true,
                onCheckedChange = { checked ->
                    if (checked) {
                        appToBlock = app // Show confirmation dialog
                    } else {
                        blockedRule?.let { rule ->
                            onUnblockApp(rule.id, app.packageName)
                        }
                    }
                },
                onRequestUnblock = {
                    pendingRequest?.let { appToRequestUnblock = it }
                }
            )
            Divider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
        }
    }

    // Confirmation Dialog
    appToBlock?.let { app ->
        AlertDialog(
            onDismissRequest = { appToBlock = null },
            title = { Text("Block ${app.appName}?") },
            text = { Text("This will prevent ${app.appName} from opening. Continue?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        onBlockApp(app.packageName, app.appName, "Blocked by parent")
                        appToBlock = null
                    }
                ) {
                    Text("Block")
                }
            },
            dismissButton = {
                TextButton(onClick = { appToBlock = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Unblock-request dialog: the child asks the parent for permission.
    appToRequestUnblock?.let { rule ->
        RequestUnblockDialog(
            rule = rule,
            onDismiss = { appToRequestUnblock = null },
            onConfirm = { reason ->
                onRequestUnblock(rule.id, reason)
                appToRequestUnblock = null
            }
        )
    }
}

@Composable
fun RequestUnblockDialog(
    rule: AppBlockRuleEntity,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var reason by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Request unblock") },
        text = {
            Column {
                Text(
                    text = "Ask your parent to unblock ${rule.appName ?: rule.packageName}. They will review your request.",
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Reason (optional)") },
                    singleLine = false,
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(reason.trim()) }) {
                Text("Send request")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun AppListItem(
    app: InstalledApp,
    isBlocked: Boolean,
    blockReason: String?,
    unblockRequested: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    onRequestUnblock: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // App Icon
        val bitmap = remember(app.icon) { app.icon.toBitmap().asImageBitmap() }
        Image(
            bitmap = bitmap,
            contentDescription = "${app.appName} icon",
            modifier = Modifier.size(48.dp)
        )

        Spacer(modifier = Modifier.width(16.dp))

        // App Name, Reason and Unblock-request state
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = app.appName,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface
            )
            if (isBlocked && !blockReason.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = MaterialTheme.colorScheme.errorContainer
                ) {
                    Text(
                        text = blockReason,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
            if (isBlocked && unblockRequested) {
                Spacer(modifier = Modifier.height(4.dp))
                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = MaterialTheme.colorScheme.secondaryContainer
                ) {
                    Text(
                        text = "Unblock requested — waiting for parent",
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }
            if (isBlocked && !unblockRequested) {
                Spacer(modifier = Modifier.height(4.dp))
                TextButton(
                    onClick = onRequestUnblock,
                    contentPadding = PaddingValues(horizontal = 0.dp, vertical = 0.dp)
                ) {
                    Text("Request unblock", style = MaterialTheme.typography.labelMedium)
                }
            }
        }

        // Toggle Switch
        Switch(
            checked = isBlocked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = MaterialTheme.colorScheme.primary,
                checkedTrackColor = MaterialTheme.colorScheme.primaryContainer
            )
        )
    }
}
