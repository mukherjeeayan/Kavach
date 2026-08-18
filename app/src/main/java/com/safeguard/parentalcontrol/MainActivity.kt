package com.safeguard.parentalcontrol

import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.ParentPinStore
import com.safeguard.parentalcontrol.ui.screens.appblock.AppBlockingScreen
import com.safeguard.parentalcontrol.ui.screens.onboarding.OnboardingScreen
import com.safeguard.parentalcontrol.ui.screens.parentlock.ParentLockScreen
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background
            ) {
                SafeGuardNavigation(
                    parentPinStore = parentPinStore,
                    startDestination = when {
                        !onboardingStore.isOnboarded() -> "onboarding"
                        parentPinStore.hasPin() -> "gate"
                        else -> "dashboard"
                    }
                )
            }
        }
    }
}

@Composable
fun SafeGuardNavigation(
    parentPinStore: ParentPinStore,
    startDestination: String
) {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = startDestination) {
        composable("onboarding") {
            OnboardingScreen(
                onComplete = {
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
            AppBlockingScreen()
        }
    }
}