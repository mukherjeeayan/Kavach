package com.safeguard.parentalcontrol.security

import android.content.Context
import android.os.Build
import android.os.Debug
import java.io.File

/**
 * Multi-signal tamper / root / debugger detection, isolated from the
 * enforcement service so the checks can be unit tested and reused by
 * other components (e.g. startup checks).
 */
object TamperDetector {

    /**
     * Multi-signal root detection:
     * 1. Check for known su binary paths
     * 2. Check Build.TAGS for "test-keys"
     * 3. Check for common root management apps
     */
    fun isRooted(context: Context): Boolean {
        // Signal 1: su binary in known locations
        val suFound = SU_BINARY_PATHS.any { File(it).exists() }

        // Signal 2: Build tags indicate a test build (often rooted)
        val testKeys = Build.TAGS?.contains("test-keys") == true

        // Signal 3: Known root management packages installed
        val rootAppInstalled = ROOT_MANAGEMENT_PACKAGES.any { pkg ->
            try {
                context.packageManager.getPackageInfo(pkg, 0)
                true
            } catch (e: Exception) {
                false
            }
        }

        return suFound || testKeys || rootAppInstalled
    }

    /**
     * Detect if a debugger is attached — a sign the child may be
     * trying to step through enforcement logic.
     */
    fun isDebuggerAttached(): Boolean {
        return Debug.isDebuggerConnected() || Debug.waitingForDebugger()
    }

    private val SU_BINARY_PATHS = listOf(
        "/system/xbin/su",
        "/system/bin/su",
        "/sbin/su",
        "/system/su",
        "/system/bin/.ext/.su",
        "/system/usr/we-need-root/su-backup",
        "/system/app/Superuser.apk"
    )

    private val ROOT_MANAGEMENT_PACKAGES = listOf(
        "com.topjohnwu.magisk",
        "eu.chainfire.supersu",
        "com.koushikdutta.superuser",
        "com.noshufou.android.su"
    )
}
