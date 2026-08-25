package com.safeguard.parentalcontrol.ui.screens.deviceui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.EmojiEmotions
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
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
    Contacts("Contacts", Icons.Filled.Person),
    SOS("SOS", Icons.Filled.Warning),
    Mood("Mood", Icons.Filled.EmojiEmotions),
    Rewards("Rewards", Icons.Filled.Star),
    Security("Security", Icons.Filled.Security)
}

/**
 * Root of the on-device dashboard: bottom navigation between the app
 * blocker and the read-only views for screen time, scheduled locks,
 * location, contact rules, and Phase 2 features.
 */
@Composable
fun DeviceDashboardScreen() {
    var selectedTab by rememberSaveable { mutableStateOf(DeviceTab.Apps) }

    Scaffold(
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
            DeviceTab.Contacts -> ContactsScreen(modifier = contentModifier)
            DeviceTab.SOS -> SosScreen()
            DeviceTab.Mood -> MoodScreen()
            DeviceTab.Rewards -> RewardsScreen()
            DeviceTab.Security -> SecurityScreen()
        }
    }
}