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
    val uiState by viewModel.uiState.collectAsState()
    val optimisticBlocks by viewModel.optimisticBlocks.collectAsState()

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
        packageManager
    ) {
        value = withContext(Dispatchers.IO) {
            val intent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            packageManager.queryIntentActivities(intent, 0).map { resolveInfo ->
                val appInfo = resolveInfo.activityInfo.applicationInfo
                InstalledApp(
                    packageName = appInfo.packageName,
                    appName = appInfo.loadLabel(packageManager).toString(),
                    icon = appInfo.loadIcon(packageManager)
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
                            optimisticBlocks = optimisticBlocks,
                            onBlockApp = { packageName, appName, reason ->
                                viewModel.blockApp(packageName, appName, reason)
                            },
                            onUnblockApp = { ruleId, packageName ->
                                viewModel.unblockApp(ruleId, packageName)
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
    optimisticBlocks: Map<String, Boolean>,
    onBlockApp: (String, String, String?) -> Unit,
    onUnblockApp: (String, String) -> Unit
) {
    var appToBlock by remember { mutableStateOf<InstalledApp?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp)
    ) {
        items(apps, key = { it.packageName }) { app ->
            val blockedRule = blockedApps.find { it.packageName == app.packageName && it.isBlocked }
            
            // Check optimistic state first, fallback to source of truth
            val isOptimisticallyBlocked = optimisticBlocks[app.packageName]
            val isCurrentlyBlocked = isOptimisticallyBlocked ?: (blockedRule != null)

            AppListItem(
                app = app,
                isBlocked = isCurrentlyBlocked,
                blockReason = blockedRule?.blockReason,
                onCheckedChange = { checked ->
                    if (checked) {
                        appToBlock = app // Show confirmation dialog
                    } else {
                        blockedRule?.let { rule ->
                            onUnblockApp(rule.id, app.packageName)
                        }
                    }
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
}

@Composable
fun AppListItem(
    app: InstalledApp,
    isBlocked: Boolean,
    blockReason: String?,
    onCheckedChange: (Boolean) -> Unit
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

        // App Name and Reason
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
