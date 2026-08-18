package com.safeguard.parentalcontrol

import com.safeguard.parentalcontrol.ui.screens.appblock.AppBlockingScreen
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

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Example: Initial Root Detection check would be invoked from here or Splash
        
        setContent {
            // Theme setup would be here, but omitting for now until theme files are created
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background
            ) {
                SafeGuardNavigation()
            }
        }
    }
}


@Composable
fun SafeGuardNavigation() {
    val navController = rememberNavController()
    
    // Basic Navigation Setup
    NavHost(navController = navController, startDestination = "dashboard") {
        composable("dashboard") {
            AppBlockingScreen()
        }
        // Additional routes setup...
    }
}
