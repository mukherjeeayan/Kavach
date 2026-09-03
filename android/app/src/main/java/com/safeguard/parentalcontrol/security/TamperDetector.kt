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
     * 4. Check for Magisk-specific indicators (Zygisk, MagiskHide)
     * 5. Check /proc/self/mounts for suspicious mount points
     * 6. Check for busybox binary (common on rooted devices)
     * 7. Check system properties for root indicators
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

        // Signal 4: Magisk-specific detection
        val magiskDetected = try {
            // Check for Magisk app package
            context.packageManager.getPackageInfo("com.topjohnwu.magisk", 0)
            true
        } catch (e: Exception) {
            false
        } || File("/sbin/.magisk").exists() || File("/data/adb/magisk").exists()

        // Signal 5: Suspicious mount points
        val suspiciousMounts = try {
            val mounts = File("/proc/self/mounts").readText()
            MOUNT_POINTS.any { mounts.contains(it) }
        } catch (e: Exception) {
            false
        }

        // Signal 6: Busybox binary
        val busyboxFound = BUSYBOX_PATHS.any { File(it).exists() }

        // Signal 7: Dangerous props
        val dangerousProps = try {
            val process = Runtime.getRuntime().exec(arrayOf("getprop", "ro.debuggable"))
            val result = process.inputStream.bufferedReader().readText().trim()
            process.destroy()
            result == "1"
        } catch (e: Exception) {
            false
        }

        return suFound || testKeys || rootAppInstalled || magiskDetected ||
               suspiciousMounts || busyboxFound || dangerousProps
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

    // Suspicious mount points commonly found on rooted devices
    private val MOUNT_POINTS = listOf(
        "system/xbin/su",
        "system/bin/su",
        "sbin/su",
        "data/adb/magisk",
        "magisk"
    )

    // Busybox paths (common on rooted devices)
    private val BUSYBOX_PATHS = listOf(
        "/system/xbin/busybox",
        "/system/bin/busybox",
        "/sbin/busybox"
    )
}
