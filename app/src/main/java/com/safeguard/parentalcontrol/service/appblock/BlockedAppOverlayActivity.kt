package com.safeguard.parentalcontrol.service.appblock

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import com.safeguard.parentalcontrol.R

/**
 * Overlay activity shown when the child tries to open a blocked app.
 * Instead of silently killing the app, this provides clear feedback
 * about why the app is blocked and the option to request an unblock.
 */
class BlockedAppOverlayActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked_app_overlay)

        val appName = intent.getStringExtra(EXTRA_APP_NAME) ?: "This app"
        val blockReason = intent.getStringExtra(EXTRA_BLOCK_REASON) ?: "Blocked by parent"

        findViewById<TextView>(R.id.textAppName).text = appName
        findViewById<TextView>(R.id.textBlockReason).text = blockReason

        findViewById<Button>(R.id.btnGoHome).setOnClickListener {
            val homeIntent = android.content.Intent(android.content.Intent.ACTION_MAIN).apply {
                addCategory(android.content.Intent.CATEGORY_HOME)
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(homeIntent)
            finish()
        }
    }

    override fun onBackPressed() {
        super.onBackPressed()
        val homeIntent = android.content.Intent(android.content.Intent.ACTION_MAIN).apply {
            addCategory(android.content.Intent.CATEGORY_HOME)
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
        finish()
    }

    companion object {
        const val EXTRA_APP_NAME = "app_name"
        const val EXTRA_BLOCK_REASON = "block_reason"
    }
}
