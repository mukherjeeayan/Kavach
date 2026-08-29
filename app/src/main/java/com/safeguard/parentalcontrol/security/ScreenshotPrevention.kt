package com.safeguard.parentalcontrol.security

import android.app.Activity
import android.view.WindowManager

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
