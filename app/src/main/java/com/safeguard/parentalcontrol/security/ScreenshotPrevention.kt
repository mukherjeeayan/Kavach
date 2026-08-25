package com.safeguard.parentalcontrol.security

import android.app.Activity
import android.view.WindowManager

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
}