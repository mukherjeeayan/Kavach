package com.safeguard.parentalcontrol

import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.ParentPinStore
import com.safeguard.parentalcontrol.data.remote.RealtimeRulesClient
import com.safeguard.parentalcontrol.notifications.NotificationHandler
import com.safeguard.parentalcontrol.ui.screens.appblock.AppBlockingScreen
import com.safeguard.parentalcontrol.ui.screens.deviceui.DeviceDashboardScreen
import com.safeguard.parentalcontrol.ui.screens.onboarding.OnboardingScreen
import com.safeguard.parentalcontrol.ui.screens.parentlock.ParentLockScreen
import com.safeguard.parentalcontrol.ui.screens.settings.BedtimeConfigScreen
import com.safeguard.parentalcontrol.ui.screens.settings.ChangePinScreen
import com.safeguard.parentalcontrol.ui.screens.settings.ScreenTimeLimitScreen
import com.safeguard.parentalcontrol.ui.screens.settings.SettingsScreen
import com.safeguard.parentalcontrol.work.SyncScheduler
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var onboardingStore: OnboardingStore

    @Inject
    lateinit var parentPinStore: ParentPinStore

    @Inject
    lateinit var realtimeRulesClient: RealtimeRulesClient

    /**
     * Notification deep link payload extracted from the launching
     * intent. Held on the activity so it survives configuration
     * changes and is re-applied to the dashboard each time the
     * activity is resumed (which is how FCM-launched intents reach
     * an already-running activity thanks to SINGLE_TOP).
     */
    private var pendingDeepLinkType by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingDeepLinkType = intent?.extractDeepLinkType()

        setContent {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background
            ) {
                SafeGuardNavigation(
                    parentPinStore = parentPinStore,
                    onOnboardingComplete = {
                        // Enforcement must start immediately after the
                        // parent finishes setup — waiting for the next
                        // app launch would leave the child unguarded.
                        SyncScheduler.startEnforcementService(this)
                        SyncScheduler.startLocationService(this)
                        SyncScheduler.schedule(this)
                        realtimeRulesClient.start()
                    },
                    startDestination = when {
                        !onboardingStore.isOnboarded() -> "onboarding"
                        parentPinStore.hasPin() -> "gate"
                        else -> "dashboard"
                    },
                    deepLinkType = pendingDeepLinkType,
                    onDeepLinkConsumed = { pendingDeepLinkType = null }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.extractDeepLinkType()?.let { pendingDeepLinkType = it }
    }

    private fun Intent.extractDeepLinkType(): String? =
        getStringExtra(NotificationHandler.EXTRA_NOTIFICATION_TYPE)
}

@Composable
fun SafeGuardNavigation(
    parentPinStore: ParentPinStore,
    onOnboardingComplete: () -> Unit,
    startDestination: String,
    deepLinkType: String? = null,
    onDeepLinkConsumed: () -> Unit = {}
) {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = startDestination) {
        composable("onboarding") {
            OnboardingScreen(
                onComplete = {
                    onOnboardingComplete()
                    navController.navigate("dashboard") {
                        popUpTo("onboarding") { inclusive = true }
                    }
                }
            )
        }
        composable("gate") {
            ParentLockScreen(
                pinStore = parentPinStore,
                onUnlocked = {
                    navController.navigate("dashboard") {
                        popUpTo("gate") { inclusive = true }
                    }
                }
            )
        }
        composable("dashboard") {
            DeviceDashboardScreen(
                onOpenSettings = {
                    navController.navigate("settings")
                },
                deepLinkType = deepLinkType,
                onDeepLinkConsumed = onDeepLinkConsumed
            )
        }
        composable("settings") {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onChangePin = { navController.navigate("change_pin") },
                onOpenBedtime = { navController.navigate("bedtime") },
                onOpenScreenTimeLimit = { navController.navigate("screen_time_limit") },
                onLoggedOut = {
                    navController.navigate("onboarding") {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onUnenrolled = {
                    navController.navigate("onboarding") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
        composable("change_pin") {
            ChangePinScreen(
                onBack = { navController.popBackStack() }
            )
        }
        composable("bedtime") {
            BedtimeConfigScreen()
        }
        composable("screen_time_limit") {
            ScreenTimeLimitScreen()
        }
    }
}