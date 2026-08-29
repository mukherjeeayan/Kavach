package com.safeguard.parentalcontrol.service.appblock

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.safeguard.parentalcontrol.R
import com.safeguard.parentalcontrol.viewmodel.appblock.AppBlockingUiEvent
import com.safeguard.parentalcontrol.viewmodel.appblock.AppBlockingViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

/**
 * Overlay activity shown when the child tries to open a blocked app.
 * Instead of silently killing the app, this provides clear feedback
 * about why the app is blocked and the option to request an unblock.
 *
 * The "Request Unblock" button resolves the package name to a server
 * rule id and submits the unblock request through the shared
 * [AppBlockingViewModel], so the parent sees the request alongside any
 * existing ones in the dashboard.
 */
@AndroidEntryPoint
class BlockedAppOverlayActivity : ComponentActivity() {

    private val viewModel: AppBlockingViewModel by viewModels()

    private var packageName: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked_app_overlay)

        val appName = intent.getStringExtra(EXTRA_APP_NAME) ?: "This app"
        val blockReason = intent.getStringExtra(EXTRA_BLOCK_REASON) ?: "Blocked by parent"
        packageName = intent.getStringExtra(EXTRA_PACKAGE_NAME) ?: ""

        findViewById<TextView>(R.id.textAppName).text = appName
        findViewById<TextView>(R.id.textBlockReason).text = "Reason: $blockReason"

        findViewById<Button>(R.id.btnGoHome).setOnClickListener { goHome() }
        findViewById<Button>(R.id.btnRequestUnblock).setOnClickListener {
            if (packageName.isEmpty()) {
                Toast.makeText(this, "Unable to identify blocked app", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            viewModel.requestUnblockByPackage(packageName, reason = "")
        }

        observeUiEvents()
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
                            // If the unblock request was accepted we send
                            // the child home — they still have to wait for
                            // the parent, but the UI should not linger on
                            // a blocking overlay while a request is in
                            // flight.
                            if (event.message.contains(
                                    "request",
                                    ignoreCase = true
                                ) && event.message.contains(
                                    "sent",
                                    ignoreCase = true
                                )
                            ) {
                                goHome()
                            }
                        }
                    }
                }
            }
        }
    }

    private fun goHome() {
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
        finish()
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        super.onBackPressed()
        goHome()
    }

    companion object {
        const val EXTRA_APP_NAME = "app_name"
        const val EXTRA_BLOCK_REASON = "block_reason"
        const val EXTRA_PACKAGE_NAME = "package_name"
    }
}
