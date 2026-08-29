package com.safeguard.parentalcontrol.security

import android.app.Activity
import android.view.WindowManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext
import androidx.fragment.app.FragmentActivity
import com.safeguard.parentalcontrol.security.ScreenshotPrevention.disableScreenshotPrevention
import com.safeguard.parentalcontrol.security.ScreenshotPrevention.enableScreenshotPrevention

/**
 * Screenshot prevention utilities. Provides extension functions for
 * Activities to enable/disable FLAG_SECURE to block screenshots.
 */
object ScreenshotPrevention {

    fun Activity.enableScreenshotPrevention() {
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
    }

    fun Activity.disableScreenshotPrevention() {
        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }

    /**
     * Checks whether FLAG_SECURE is currently set on the given Activity.
     */
    fun Activity.isScreenshotPreventionEnabled(): Boolean {
        return (window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE) != 0
    }
}

/**
 * Composable that enables FLAG_SECURE on the hosting Activity while
 * the Composable is in the composition and disables it when it leaves.
 *
 * Wrap any screen that displays sensitive information (parent settings,
 * PIN entry, security scans) with this effect so the screenshot
 * prevention is automatically tied to the screen's visibility.
 */
@Composable
fun SecureScreen(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val activity = context as? FragmentActivity
    DisposableEffect(activity) {
        if (activity != null) {
            activity.enableScreenshotPrevention()
        }
        onDispose {
            if (activity != null) {
                activity.disableScreenshotPrevention()
            }
        }
    }
    content()
}
