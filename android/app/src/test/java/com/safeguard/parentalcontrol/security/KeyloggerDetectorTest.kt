package com.safeguard.parentalcontrol.security

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.ArgumentMatchers.eq
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations

class KeyloggerDetectorTest {

    @Mock private lateinit var context: Context
    @Mock private lateinit var packageManager: PackageManager

    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        `when`(context.packageManager).thenReturn(packageManager)
        `when`(context.packageName).thenReturn("com.safeguard.parentalcontrol")
    }

    @Test
    fun `known keylogger package is detected with high severity`() {
        val knownPkg = "com.android.keylogger"
        stubPackageInstalled(knownPkg, isSystem = false)

        val threats = KeyloggerDetector.scanForKeyloggers(context)

        val match = threats.firstOrNull { it.packageName == knownPkg }
        assertTrue("Expected $knownPkg to be flagged", match != null)
        assertEquals(DetectedThreat.ThreatType.KNOWN_KEYLOGGER_PACKAGE, match!!.type)
        assertEquals(95, match.severity)
        assertTrue(match.description.contains(knownPkg))
    }

    @Test
    fun `clean device with no surveillance apps returns no threats`() {
        // All PackageManager lookups return NameNotFoundException
        // -> none of the known keylogger packages are installed
        `when`(packageManager.getPackageInfo(org.mockito.ArgumentMatchers.anyString(), eq(0)))
            .thenThrow(PackageManager.NameNotFoundException())
        // ApplicationInfo for isSystemPackage() also throws -> treated as non-system
        `when`(packageManager.getApplicationInfo(org.mockito.ArgumentMatchers.anyString(), eq(0)))
            .thenThrow(PackageManager.NameNotFoundException())

        val threats = KeyloggerDetector.scanForKeyloggers(context)

        assertTrue("Expected no threats on a clean device, got $threats", threats.isEmpty())
    }

    @org.junit.Ignore("Requires JDK 11 or lower for reflective modifiers field access, skip on JDK 17+")
    @Test
    fun `system apps with overlay permission are not flagged`() {
        // A system app holding FLAG_SYSTEM should be ignored
        val systemPkg = "com.example.systemapp"
        val info = PackageInfo().apply {
            packageName = systemPkg
            applicationInfo = ApplicationInfo().apply {
                flags = ApplicationInfo.FLAG_SYSTEM
            }
        }
        `when`(packageManager.getPackageInfo(systemPkg, 0))
            .thenThrow(PackageManager.NameNotFoundException())
        `when`(packageManager.getApplicationInfo(systemPkg, 0))
            .thenReturn(info.applicationInfo)

        // Stub SDK to be modern so overlay checks are reachable
        val originalSdk = Build.VERSION.SDK_INT
        try {
            setSdkInt(Build.VERSION_CODES.TIRAMISU)
            `when`(
                packageManager.getInstalledPackages(
                    PackageManager.PackageInfoFlags.of(0)
                )
            ).thenReturn(listOf(info))

            val threats = KeyloggerDetector.scanForKeyloggers(context)

            val overlayThreat = threats.firstOrNull {
                it.packageName == systemPkg &&
                    it.type == DetectedThreat.ThreatType.SUSPICIOUS_OVERLAY_PERMISSION
            }
            assertTrue("System app should not be flagged", overlayThreat == null)
        } finally {
            setSdkInt(originalSdk)
        }
    }

    private fun stubPackageInstalled(pkg: String, isSystem: Boolean) {
        val info = PackageInfo().apply {
            packageName = pkg
            applicationInfo = ApplicationInfo().apply {
                flags = if (isSystem) ApplicationInfo.FLAG_SYSTEM else 0
            }
        }
        `when`(packageManager.getPackageInfo(pkg, 0)).thenReturn(info)
        `when`(packageManager.getApplicationInfo(pkg, 0)).thenReturn(info.applicationInfo)
    }

    /** Reflectively overrides Build.VERSION.SDK_INT for the duration of a test. */
    private fun setSdkInt(value: Int) {
        val field = Build.VERSION::class.java.getDeclaredField("SDK_INT")
        field.isAccessible = true
        // Build.VERSION is a companion-like object; field is static final.
        val modifiersField = java.lang.reflect.Field::class.java.getDeclaredField("modifiers")
        modifiersField.isAccessible = true
        modifiersField.setInt(field, field.modifiers and java.lang.reflect.Modifier.FINAL.inv())
        field.setInt(null, value)
    }
}
