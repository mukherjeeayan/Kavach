package com.safeguard.parentalcontrol.service.appblock

import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.material.textfield.TextInputEditText
import com.safeguard.parentalcontrol.R
import com.safeguard.parentalcontrol.viewmodel.appblock.AppBlockingUiEvent
import com.safeguard.parentalcontrol.viewmodel.appblock.AppBlockingViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Overlay activity shown when the child tries to open a blocked app.
 * Provides clear feedback about why the app is blocked and a form
 * to request an unblock with a reason.
 *
 * Features:
 * - Reason input field for the child to explain why they need access
 * - Countdown timer showing request expiry (5 minutes)
 * - Pending state UI while waiting for parent response
 * - Shows on lock screen (SHOW_WHEN_LOCKED) so it can be used
 *   even when the device is locked
 */
@AndroidEntryPoint
class BlockedAppOverlayActivity : ComponentActivity() {

    private val viewModel: AppBlockingViewModel by viewModels()

    private var packageName: String = ""
    private var countdownTimer: CountDownTimer? = null

    private lateinit var layoutRequestForm: LinearLayout
    private lateinit var layoutPending: LinearLayout
    private lateinit var editReason: TextInputEditText
    private lateinit var btnRequestUnblock: Button
    private lateinit var textPendingStatus: TextView
    private lateinit var textCountdown: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked_app_overlay)

        // Show on lock screen
        setShowWhenLocked(true)

        val appName = intent.getStringExtra(EXTRA_APP_NAME) ?: "This app"
        val blockReason = intent.getStringExtra(EXTRA_BLOCK_REASON) ?: "Blocked by parent"
        packageName = intent.getStringExtra(EXTRA_PACKAGE_NAME) ?: ""

        findViewById<TextView>(R.id.textAppName).text = appName
        findViewById<TextView>(R.id.textBlockReason).text = "Reason: $blockReason"

        layoutRequestForm = findViewById(R.id.layoutRequestForm)
        layoutPending = findViewById(R.id.layoutPending)
        editReason = findViewById(R.id.editReason)
        btnRequestUnblock = findViewById(R.id.btnRequestUnblock)
        textPendingStatus = findViewById(R.id.textPendingStatus)
        textCountdown = findViewById(R.id.textCountdown)

        btnRequestUnblock.setOnClickListener { submitRequest() }
        findViewById<Button>(R.id.btnGoHome).setOnClickListener { goHome() }

        observeUiEvents()
    }

    private fun submitRequest() {
        if (packageName.isEmpty()) {
            Toast.makeText(this, "Unable to identify blocked app", Toast.LENGTH_SHORT).show()
            return
        }

        val reason = editReason.text?.toString()?.trim() ?: ""
        if (reason.isEmpty()) {
            editReason.error = "Please provide a reason"
            return
        }

        viewModel.requestUnblockByPackage(packageName, reason = reason)
    }

    private fun showPendingState() {
        layoutRequestForm.visibility = View.GONE
        layoutPending.visibility = View.VISIBLE
        startCountdown()
    }

    private fun startCountdown() {
        countdownTimer?.cancel()
        countdownTimer = object : CountDownTimer(REQUEST_EXPIRY_MS, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val minutes = millisUntilFinished / 60000
                val seconds = (millisUntilFinished % 60000) / 1000
                textCountdown.text = String.format(
                    Locale.US, "Expires in %d:%02d", minutes, seconds
                )
            }

            override fun onFinish() {
                textCountdown.text = "Request expired"
                textPendingStatus.text = "Request timed out. Your parent did not respond."
            }
        }.start()
    }

    private fun observeUiEvents() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiEvents.collect { event ->
                    when (event) {
                        is AppBlockingUiEvent.ShowToast -> {
                            Toast.makeText(
                                this@BlockedAppOverlayActivity,
                                event.message,
                                Toast.LENGTH_SHORT
                            ).show()
                            if (event.message.contains(
                                    "request",
                                    ignoreCase = true
                                ) && event.message.contains(
                                    "sent",
                                    ignoreCase = true
                                )
                            ) {
                                showPendingState()
                            }
                        }
                    }
                }
            }
        }
    }

    private fun goHome() {
        countdownTimer?.cancel()
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
        finish()
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        // SECURITY: Do NOT call super.onBackPressed() — that would dismiss the overlay.
        // Instead, go home without allowing the child to escape to the blocked app.
        goHome()
    }

    override fun onDestroy() {
        super.onDestroy()
        countdownTimer?.cancel()
    }

    companion object {
        const val EXTRA_APP_NAME = "app_name"
        const val EXTRA_BLOCK_REASON = "block_reason"
        const val EXTRA_PACKAGE_NAME = "package_name"
        private const val REQUEST_EXPIRY_MS = 5 * 60 * 1000L // 5 minutes
    }
}
