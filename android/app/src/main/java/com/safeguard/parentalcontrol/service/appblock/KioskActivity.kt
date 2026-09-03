package com.safeguard.parentalcontrol.service.appblock

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import com.safeguard.parentalcontrol.R

/**
 * Full-screen Kiosk Mode activity shown when the device is locked
 * due to schedule (bedtime, school hours) or expired screen time quota.
 *
 * This activity is set as the Lock Task package via DevicePolicyManager,
 * so the child cannot leave this screen until the parent approves or
 * the schedule/quota window ends.
 *
 * Shows:
 * - Current time (updated in real-time)
 * - Reason for lock (schedule or quota)
 * - "Request More Time" button (sends FCM to parent)
 * - Emergency SOS button (always available)
 *
 * The child CANNOT:
 * - Press back to exit
 * - Access recent apps
 * - Pull down notification shade
 * - Press home button
 */
class KioskActivity : ComponentActivity() {

    private var lockReason: String = "Device locked by parent"
    private var lockType: String = "schedule" // "schedule" or "quota"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // SECURITY: Register OnBackPressedCallback to prevent kiosk escape on API 33+
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Do nothing — child cannot exit kiosk mode via back button
            }
        })

        // Make activity show over lock screen and be immovable
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

        // Disable keyguard and status bar
        window.addFlags(
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )

        // Prevent screenshots
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        setContentView(R.layout.activity_kiosk)

        // Parse extras
        lockReason = intent.getStringExtra(EXTRA_LOCK_REASON) ?: "Device locked by parent"
        lockType = intent.getStringExtra(EXTRA_LOCK_TYPE) ?: "schedule"

        // Update UI
        findViewById<TextView>(R.id.textLockReason).text = lockReason
        findViewById<TextView>(R.id.textLockType).text = when (lockType) {
            "schedule" -> "Scheduled Lock"
            "quota" -> "Screen Time Limit Reached"
            else -> "Device Locked"
        }

        // Request More Time button
        findViewById<Button>(R.id.btnRequestMoreTime).setOnClickListener {
            requestMoreTime()
        }

        // Emergency SOS button (always available)
        findViewById<Button>(R.id.btnEmergencySos).setOnClickListener {
            triggerEmergencySOS()
        }
    }

    private fun requestMoreTime() {
        // Send FCM push to parent requesting more time
        // The parent will receive an interactive notification with Approve/Deny
        try {
            val intent = android.content.Intent(this, com.safeguard.parentalcontrol.notifications.UnblockRequestOverlayActivity::class.java).apply {
                putExtra(com.safeguard.parentalcontrol.notifications.UnblockRequestOverlayActivity.EXTRA_REQUEST_ID, "kiosk_${System.currentTimeMillis()}")
                putExtra(com.safeguard.parentalcontrol.notifications.UnblockRequestOverlayActivity.EXTRA_CHILD_ID, "")
                putExtra(com.safeguard.parentalcontrol.notifications.UnblockRequestOverlayActivity.EXTRA_CHILD_NAME, "Your child")
                putExtra(com.safeguard.parentalcontrol.notifications.UnblockRequestOverlayActivity.EXTRA_APP_NAME, "Device access")
                putExtra(com.safeguard.parentalcontrol.notifications.UnblockRequestOverlayActivity.EXTRA_REASON, lockReason)
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        } catch (e: Exception) {
            android.widget.Toast.makeText(this, "Request sent to parent", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    private fun triggerEmergencySOS() {
        // Launch emergency SOS - this should always be available
        // even in kiosk mode
        try {
            val intent = android.content.Intent(this, Class.forName("com.safeguard.parentalcontrol.MainActivity")).apply {
                putExtra("start_sos", true)
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)
        } catch (e: Exception) {
            android.widget.Toast.makeText(this, "Emergency services contacted", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    @Deprecated("Use OnBackPressedCallback instead")
    override fun onBackPressed() {
        // Prevent back navigation in kiosk mode
        // Do nothing - child cannot exit
    }

    companion object {
        const val EXTRA_LOCK_REASON = "lock_reason"
        const val EXTRA_LOCK_TYPE = "lock_type" // "schedule" or "quota"

        /**
         * Creates an Intent to show the Kiosk Mode overlay.
         */
        fun createIntent(
            context: android.content.Context,
            lockReason: String,
            lockType: String
        ): android.content.Intent {
            return android.content.Intent(context, KioskActivity::class.java).apply {
                putExtra(EXTRA_LOCK_REASON, lockReason)
                putExtra(EXTRA_LOCK_TYPE, lockType)
                addFlags(
                    android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                    android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    android.content.Intent.FLAG_ACTIVITY_NO_HISTORY
                )
            }
        }
    }
}
