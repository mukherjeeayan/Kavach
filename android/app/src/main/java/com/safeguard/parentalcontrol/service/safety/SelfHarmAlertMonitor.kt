package com.safeguard.parentalcontrol.service.safety

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import com.safeguard.parentalcontrol.R
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.SelfHarmAlertDao
import com.safeguard.parentalcontrol.data.local.entity.SelfHarmAlertEntity
import com.safeguard.parentalcontrol.data.remote.api.Phase2Api
import com.safeguard.parentalcontrol.security.SelfHarmDetector
import com.safeguard.parentalcontrol.security.Severity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/**
 * Foreground service that receives text observed on the device
 * (chat messages, search queries, etc.) and runs each snippet
 * through [SelfHarmDetector].
 *
 * If the assessment comes back at [Severity.MEDIUM] or higher, the
 * service:
 *  1. Persists a [SelfHarmAlertEntity] locally.
 *  2. Uploads the alert to the server via the parent-facing
 *     [Phase2Api].
 *
 * Callers feed text in via [ACTION_ANALYZE] intents with the body
 * text in [EXTRA_TEXT] and an optional source label in
 * [EXTRA_SOURCE] (e.g. "sms", "whatsapp", "search").
 */
@AndroidEntryPoint
class SelfHarmAlertMonitor : Service() {

    @Inject
    lateinit var selfHarmAlertDao: SelfHarmAlertDao

    @Inject
    lateinit var phase2Api: Phase2Api

    @Inject
    lateinit var onboardingStore: OnboardingStore

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_ANALYZE -> {
                val text = intent.getStringExtra(EXTRA_TEXT).orEmpty()
                val source = intent.getStringExtra(EXTRA_SOURCE) ?: "unknown"
                if (text.isNotBlank()) {
                    handleText(text, source)
                }
            }
            ACTION_STOP -> stopSelf()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /**
     * Run the detector, and if the result is medium or higher,
     * persist + upload. Always safe to call off the main thread.
     */
    private fun handleText(text: String, source: String) {
        val assessment = SelfHarmDetector.analyzeText(text)
        if (assessment.severity == Severity.NONE ||
            assessment.severity == Severity.LOW
        ) {
            Log.d(TAG, "No alertable signal from $source (severity=${assessment.severity})")
            return
        }
        serviceScope.launch {
            try {
                val childId = onboardingStore.childId ?: return@launch
                val deviceId = onboardingStore.deviceId ?: return@launch
                val now = System.currentTimeMillis().toString()
                val entity = SelfHarmAlertEntity(
                    id = UUID.randomUUID().toString(),
                    childId = childId,
                    sourceType = source,
                    detectedKeywords = assessment.matchedPhrases,
                    contentSnippet = assessment.snippet,
                    riskLevel = assessment.severity.name,
                    isAcknowledged = false,
                    createdAt = now
                )
                selfHarmAlertDao.insert(entity)
                Log.w(TAG, "Self-harm alert stored: child=$childId level=${assessment.severity} keywords=${assessment.matchedPhrases}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to persist self-harm alert", e)
            }
            try {
                val deviceId = onboardingStore.deviceId ?: return@launch
                val payload = com.safeguard.parentalcontrol.data.remote.dto.SelfHarmAlertUploadDto(
                    id = UUID.randomUUID().toString(),
                    childId = onboardingStore.childId ?: "",
                    sourceType = source,
                    detectedKeywords = assessment.matchedPhrases,
                    contentSnippet = assessment.snippet,
                    riskLevel = assessment.severity.name,
                    createdAt = System.currentTimeMillis().toString()
                )
                phase2Api.uploadSelfHarmAlert(deviceId, payload)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to upload self-harm alert", e)
            }
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.self_harm_monitor_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.self_harm_monitor_channel_desc)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.self_harm_monitor_title))
            .setContentText(getString(R.string.self_harm_monitor_text))
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "SelfHarmAlertMonitor"
        private const val CHANNEL_ID = "safeguard_self_harm_monitor"
        private const val NOTIFICATION_ID = 1010

        const val ACTION_ANALYZE = "com.safeguard.parentalcontrol.SELF_HARM_ANALYZE"
        const val ACTION_STOP = "com.safeguard.parentalcontrol.SELF_HARM_STOP"
        const val EXTRA_TEXT = "extra_text"
        const val EXTRA_SOURCE = "extra_source"

        /**
         * Convenience helper for callers that don't have direct
         * service binding. Builds an analyze intent.
         */
        fun analyzeIntent(text: String, source: String): Intent {
            return Intent(ACTION_ANALYZE).apply {
                putExtra(EXTRA_TEXT, text)
                putExtra(EXTRA_SOURCE, source)
                setPackage("com.safeguard.parentalcontrol")
            }
        }
    }
}
