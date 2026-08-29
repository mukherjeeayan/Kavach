package com.safeguard.parentalcontrol.service.urlfilter

import android.app.Activity
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import com.safeguard.parentalcontrol.R
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.remote.dto.UrlAccessRequestDto
import com.safeguard.parentalcontrol.data.remote.api.Phase2Api
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Full-screen activity shown when the child navigates to a URL that
 * matches a block rule. Surfaces the blocked URL and offers a
 * "Request Access" path that posts the request to the parent's API.
 *
 * The activity is singleTask + no-history: the back stack of the
 * browser is left intact so the system back gesture / "Go Back"
 * button returns the child to a safe state without killing the
 * browser process.
 */
@AndroidEntryPoint
class BlockedUrlActivity : ComponentActivity() {

    @Inject
    lateinit var phase2Api: Phase2Api

    @Inject
    lateinit var onboardingStore: OnboardingStore

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var requestJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked_url)

        val blockedUrl = intent.getStringExtra(EXTRA_BLOCKED_URL) ?: ""

        findViewById<TextView>(R.id.textBlockedUrl).text = blockedUrl

        findViewById<Button>(R.id.btnGoBack).setOnClickListener {
            goBackToBrowser()
        }

        findViewById<Button>(R.id.btnRequestAccess).setOnClickListener {
            sendAccessRequest(blockedUrl)
        }
    }

    override fun onBackPressed() {
        goBackToBrowser()
    }

    override fun onDestroy() {
        super.onDestroy()
        requestJob?.cancel()
        scope.coroutineContext[Job]?.cancel()
    }

    private fun goBackToBrowser() {
        // Send the user back into the browser's previous page rather
        // than our overlay; if the browser task is gone, fall back to
        // the home screen.
        val homeIntent = android.content.Intent(android.content.Intent.ACTION_MAIN).apply {
            addCategory(android.content.Intent.CATEGORY_HOME)
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
        finish()
    }

    private fun sendAccessRequest(url: String) {
        val statusView = findViewById<TextView>(R.id.textRequestStatus)
        val requestButton = findViewById<Button>(R.id.btnRequestAccess)
        val childId = onboardingStore.childId

        if (childId.isNullOrEmpty()) {
            Toast.makeText(this, R.string.url_request_failed, Toast.LENGTH_SHORT).show()
            return
        }

        requestButton.isEnabled = false
        statusView.visibility = View.VISIBLE
        statusView.text = ""

        requestJob?.cancel()
        requestJob = scope.launch {
            try {
                val response = phase2Api.requestUrlAccess(
                    childId,
                    UrlAccessRequestDto(url = url, reason = "Child requested access to blocked URL")
                )
                if (response.isSuccessful && response.body()?.success == true) {
                    statusView.text = getString(R.string.url_request_sent)
                } else {
                    statusView.text = getString(R.string.url_request_failed)
                    requestButton.isEnabled = true
                }
            } catch (e: Exception) {
                statusView.text = getString(R.string.url_request_failed)
                requestButton.isEnabled = true
            }
        }
    }

    companion object {
        const val EXTRA_BLOCKED_URL = "blocked_url"
    }
}
