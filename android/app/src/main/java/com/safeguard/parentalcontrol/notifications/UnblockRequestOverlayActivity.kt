package com.safeguard.parentalcontrol.notifications

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import com.safeguard.parentalcontrol.R
import com.safeguard.parentalcontrol.data.remote.api.Phase2Api
import com.safeguard.parentalcontrol.data.remote.api.UnblockRequestResponseDto
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Full-screen lock-screen overlay shown to the PARENT when a child
 * requests an app unblock. Displays the child's name, requested app,
 * and reason, with Approve and Deny action buttons.
 *
 * This activity appears over the lock screen so the parent can
 * respond to unblock requests without unlocking their device.
 *
 * Launched from FCM high-priority push with extras:
 * - EXTRA_REQUEST_ID: The unblock request ID
 * - EXTRA_CHILD_ID: Child's ID for API calls
 * - EXTRA_CHILD_NAME: Child's display name
 * - EXTRA_APP_NAME: App being requested
 * - EXTRA_REASON: Child's reason for the request
 */
@AndroidEntryPoint
class UnblockRequestOverlayActivity : ComponentActivity() {

    @Inject
    lateinit var phase2Api: Phase2Api

    private var requestId: String = ""
    private var childId: String = ""
    private var childName: String = ""
    private var appName: String = ""
    private var reason: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }

        // Full-screen immersive
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContentView(R.layout.activity_unblock_request_overlay)

        // Parse extras
        requestId = intent.getStringExtra(EXTRA_REQUEST_ID) ?: ""
        childId = intent.getStringExtra(EXTRA_CHILD_ID) ?: ""
        childName = intent.getStringExtra(EXTRA_CHILD_NAME) ?: "Your child"
        appName = intent.getStringExtra(EXTRA_APP_NAME) ?: "an app"
        reason = intent.getStringExtra(EXTRA_REASON) ?: "No reason provided"

        // Populate UI
        findViewById<TextView>(R.id.textChildName).text = childName
        findViewById<TextView>(R.id.textAppName).text = "wants to use $appName"
        findViewById<TextView>(R.id.textReason).text = "\"$reason\""

        // Approve button
        findViewById<Button>(R.id.btnApprove).setOnClickListener {
            respondToRequest(approved = true)
        }

        // Deny button
        findViewById<Button>(R.id.btnDeny).setOnClickListener {
            respondToRequest(approved = false)
        }
    }

    private fun respondToRequest(approved: Boolean) {
        if (requestId.isEmpty() || childId.isEmpty()) {
            Toast.makeText(this, "Invalid request", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val action = if (approved) "approved" else "denied"
        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    phase2Api.respondToUnblockRequest(
                        childId = childId,
                        requestId = requestId,
                        body = UnblockRequestResponseDto(approved = approved)
                    )
                }
                Toast.makeText(
                    this@UnblockRequestOverlayActivity,
                    "Request $action",
                    Toast.LENGTH_SHORT
                ).show()
            } catch (e: Exception) {
                Toast.makeText(
                    this@UnblockRequestOverlayActivity,
                    "Failed to $action request: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            } finally {
                finish()
            }
        }
    }

    companion object {
        const val EXTRA_REQUEST_ID = "request_id"
        const val EXTRA_CHILD_ID = "child_id"
        const val EXTRA_CHILD_NAME = "child_name"
        const val EXTRA_APP_NAME = "app_name"
        const val EXTRA_REASON = "reason"

        /**
         * Creates an Intent to show the unblock request overlay.
         */
        fun createIntent(
            context: Context,
            requestId: String,
            childId: String,
            childName: String,
            appName: String,
            reason: String
        ): Intent {
            return Intent(context, UnblockRequestOverlayActivity::class.java).apply {
                putExtra(EXTRA_REQUEST_ID, requestId)
                putExtra(EXTRA_CHILD_ID, childId)
                putExtra(EXTRA_CHILD_NAME, childName)
                putExtra(EXTRA_APP_NAME, appName)
                putExtra(EXTRA_REASON, reason)
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
                )
            }
        }
    }
}
