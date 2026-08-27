package com.safeguard.parentalcontrol.data.local

import android.Manifest
import android.app.Activity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import com.safeguard.parentalcontrol.R

/**
 * Permission checks and runtime request helpers.
 * Provides a clean API for requesting dangerous permissions with rationale.
 *
 * Usage in an Activity/Fragment:
 *   private val requestPermissionLauncher = registerForActivityResult(
 *       ActivityResultContracts.RequestPermission() ) { granted ->
 *           // permission result handling
 *       }
 * }
 *
 *   // Request location permission:
 *   PermissionChecks.requestLocationPermission(this, requestPermissionLauncher)
 *
 *   // Check if permission is already granted:
 *   if (PermissionChecks.isLocationGranted(this)) { ... }
 */
object PermissionChecks {

    // Runtime permission request contracts
    private const val REQUEST_LOCATION = 101
    private const val REQUEST_SMS = 102
    private const val REQUEST_CALL_LOG = 103
    private const val REQUEST_BACKGROUND_LOCATION = 104

    /** Location (FINE + BACKGROUND) rationale string resource */
    const val LOCATION_PERMISSION_RATIONALE =
        "This app needs location access to track your child's whereabouts and set geofences."

    /** SMS rationale string resource */
    const val SMS_PERMISSION_RATIONALE =
        "This app needs SMS access to monitor incoming messages for safety alerts."

    /** Call log rationale string resource */
    const val CALL_LOG_PERMISSION_RATIONALE =
        "This app needs call log access to block unwanted calls."

    /** Background location rationale string resource */
    const val BACKGROUND_LOCATION_PERMISSION_RATIONALE =
        "This app needs background location access to track your child even when the app is closed."

    /** Check if a permission is already granted at runtime */
    @JvmStatic
    fun isLocationGranted(activity: Activity): Boolean {
        return ActivityCompat.checkSelfPermission(
            activity, Manifest.permission.ACCESS_FINE_LOCATION
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            && ActivityCompat.checkSelfPermission(
                activity, Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    @JvmStatic
    fun isSmsGranted(activity: Activity): Boolean {
        return ActivityCompat.checkSelfPermission(
            activity, Manifest.permission.READ_SMS
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    @JvmStatic
    fun isCallLogGranted(activity: Activity): Boolean {
        return ActivityCompat.checkSelfPermission(
            activity, Manifest.permission.READ_CALL_LOG
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    /** Launch the permission request for the given type.
     *  The launcher should be registered in an Activity/Fragment via:
     *  private val launcher = registerForActivityResult(
     *      ActivityResultContracts.RequestPermission()) { granted -> ... }
     */
    @JvmStatic
    fun requestLocationPermission(activity: Activity, launcher: ActivityResultLauncher<String>) {
        launcher.launch(
            Manifest.permission.ACCESS_FINE_LOCATION
        )
    }

    @JvmStatic
    fun requestSmsPermission(activity: Activity, launcher: ActivityResultLauncher<String>) {
        launcher.launch(Manifest.permission.READ_SMS)
    }

    @JvmStatic
    fun requestCallLogPermission(activity: Activity, launcher: ActivityResultLauncher<String>) {
        launcher.launch(Manifest.permission.READ_CALL_LOG)
    }

    @JvmStatic
    fun requestBackgroundLocationPermission(activity: Activity, launcher: ActivityResultLauncher<String>) {
        launcher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    }
}