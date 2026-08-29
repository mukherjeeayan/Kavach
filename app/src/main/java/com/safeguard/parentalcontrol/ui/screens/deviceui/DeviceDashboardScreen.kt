package com.safeguard.parentalcontrol.ui.screens.deviceui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.EmojiEmotions
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.safeguard.parentalcontrol.notifications.NotificationHandler
import com.safeguard.parentalcontrol.ui.screens.appblock.AppBlockingScreen
import com.safeguard.parentalcontrol.ui.screens.phase2.GeofenceStatusScreen
import com.safeguard.parentalcontrol.ui.screens.phase2.MoodScreen
import com.safeguard.parentalcontrol.ui.screens.phase2.RewardsScreen
import com.safeguard.parentalcontrol.ui.screens.phase2.SecurityScreen
import com.safeguard.parentalcontrol.ui.screens.phase2.SosScreen

/** Tabs of the on-device dashboard. */
private enum class DeviceTab(
    val label: String,
    val icon: ImageVector
) {
    Apps("Apps", Icons.Filled.Apps),
    ScreenTime("Screen time", Icons.Filled.Timer),
    Locks("Locks", Icons.Filled.Lock),
    Location("Location", Icons.Filled.LocationOn),
    LocationHistory("History", Icons.Filled.History),
    Contacts("Contacts", Icons.Filled.Person),
    Communication("Calls", Icons.Filled.Call),
    SOS("SOS", Icons.Filled.Warning),
    Mood("Mood", Icons.Filled.EmojiEmotions),
    Rewards("Rewards", Icons.Filled.Star),
    Security("Security", Icons.Filled.Security)
}

/**
 * Root of the on-device dashboard: bottom navigation between the app
 * blocker and the read-only views for screen time, scheduled locks,
 * location, contact rules, and Phase 2 features.
 *
 * On launch, [deepLinkType] is consulted to select a specific tab
 * (e.g. when a notification deep link brought the user here). Unknown
 * or null types fall through to the default Apps tab.
 */
@Composable
fun DeviceDashboardScreen(
    onOpenSettings: () -> Unit = {},
    deepLinkType: String? = null,
    onDeepLinkConsumed: () -> Unit = {}
) {
    var selectedTab by rememberSaveable { mutableStateOf(DeviceTab.Apps) }

    val targetTab = remember(deepLinkType) {
        NotificationHandler.targetTabFor(deepLinkType)?.let { label ->
            DeviceTab.entries.firstOrNull { it.label == label }
        }
    }
    LaunchedEffect(targetTab) {
        if (targetTab != null) {
            selectedTab = targetTab
            onDeepLinkConsumed()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("SafeGuard") },
                actions = {
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Filled.Settings, contentDescription = "Settings")
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                DeviceTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) }
                    )
                }
            }
        }
    ) { innerPadding ->
        val contentModifier = Modifier.padding(innerPadding)
        when (selectedTab) {
            DeviceTab.Apps -> AppBlockingScreen()
            DeviceTab.ScreenTime -> ScreenTimeScreen(modifier = contentModifier)
            DeviceTab.Locks -> LocksScreen(modifier = contentModifier)
            DeviceTab.Location -> LocationScreen(modifier = contentModifier)
            DeviceTab.LocationHistory -> LocationHistoryScreen(modifier = contentModifier)
            DeviceTab.Contacts -> ContactsScreen(modifier = contentModifier)
            DeviceTab.Communication -> CommunicationLogsScreen(modifier = contentModifier)
            DeviceTab.SOS -> SosScreen()
            DeviceTab.Mood -> MoodScreen()
            DeviceTab.Rewards -> RewardsScreen()
            DeviceTab.Security -> SecurityScreen()
        }
    }
}
