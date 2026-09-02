package com.safeguard.parentalcontrol.service.voice

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.content.ContextCompat
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.remote.api.Phase2Api
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

/**
 * Foreground service that listens for voice commands using
 * SpeechRecognizer. When a voice command is detected, it reports
 * the command to the backend via [Phase2Api.recordVoiceCommand].
 *
 * Shows a persistent notification while listening. Can be toggled
 * on/off via a setting. Falls back gracefully if speech recognition
 * is not available on the device.
 *
 * Uses @AndroidEntryPoint for Hilt injection.
 */
@AndroidEntryPoint
class VoiceCommandService : Service() {

    @Inject
    lateinit var phase2Api: Phase2Api

    @Inject
    lateinit var onboardingStore: OnboardingStore

    private var speechRecognizer: SpeechRecognizer? = null
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    @Volatile
    private var isListening = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIFICATION_ID, buildNotification())
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startListening()
            ACTION_STOP -> {
                stopListening()
                stopSelf()
            }
            else -> {
                if (!isListening) {
                    startListening()
                }
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        stopListening()
        serviceScope.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startListening() {
        if (isListening) return

        if (!SpeechRecognizer.isRecognitionAvailable(applicationContext)) {
            Log.w(TAG, "Speech recognition not available on this device")
            stopSelf()
            return
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "RECORD_AUDIO permission not granted — stopping")
            stopSelf()
            return
        }

        try {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(applicationContext)
            speechRecognizer?.setRecognitionListener(createRecognitionListener())

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(
                    RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                )
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }

            speechRecognizer?.startListening(intent)
            isListening = true
            Log.i(TAG, "Voice command listening started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start speech recognizer", e)
            isListening = false
        }
    }

    private fun stopListening() {
        isListening = false
        try {
            speechRecognizer?.stopListening()
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
        } catch (_: Exception) {
        }
        speechRecognizer = null
    }

    private fun createRecognitionListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                Log.d(TAG, "Ready for speech")
            }

            override fun onBeginningOfSpeech() {
                Log.d(TAG, "Speech begun")
            }

            override fun onRmsChanged(rmsdB: Float) {}

            override fun onBufferReceived(buffer: ByteArray?) {}

            override fun onEndOfSpeech() {
                Log.d(TAG, "Speech ended")
            }

            override fun onError(error: Int) {
                Log.w(TAG, "Speech recognition error: $error")
                if (isListening) {
                    restartListening()
                }
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    val command = matches[0]
                    Log.d(TAG, "Voice command detected: $command")
                    handleVoiceCommand(command)
                }
                if (isListening) {
                    restartListening()
                }
            }

            override fun onPartialResults(partialResults: Bundle?) {}

            override fun onEvent(eventType: Int, params: Bundle?) {}
        }
    }

    private fun handleVoiceCommand(command: String) {
        val lowerCommand = command.lowercase(Locale.ROOT)
        val intent = when {
            lowerCommand.contains("kavach") || lowerCommand.contains("safe guard") || lowerCommand.contains("safeguard") ->
                "HOTWORD"
            lowerCommand.contains("sos") || lowerCommand.contains("help") ->
                "SOS"
            lowerCommand.contains("where am i") || lowerCommand.contains("location") ->
                "LOCATION"
            lowerCommand.contains("block") ->
                "APP_BLOCK"
            else ->
                "GENERAL"
        }

        serviceScope.launch {
            try {
                val deviceId = onboardingStore.deviceId ?: return@launch
                phase2Api.recordVoiceCommand(
                    deviceId,
                    com.safeguard.parentalcontrol.data.remote.dto.VoiceCommandReportDto(
                        commandText = command,
                        intent = intent,
                        wasExecuted = true
                    )
                )
                Log.d(TAG, "Voice command reported: $command (intent=$intent)")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to report voice command", e)
            }
        }
    }

    private fun restartListening() {
        serviceScope.launch {
            try {
                kotlinx.coroutines.delay(1000)
                if (isListening) {
                    speechRecognizer?.cancel()
                    speechRecognizer?.destroy()
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(applicationContext)
                    speechRecognizer?.setRecognitionListener(createRecognitionListener())

                    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                        putExtra(
                            RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                            RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                        )
                        putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    }

                    speechRecognizer?.startListening(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to restart speech recognizer", e)
            }
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Voice commands",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Listens for voice commands"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("SafeGuard Voice")
            .setContentText("Listening for voice commands")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "VoiceCommandService"
        private const val CHANNEL_ID = "safeguard_voice"
        private const val NOTIFICATION_ID = 1005
        const val ACTION_START = "com.safeguard.parentalcontrol.START_VOICE"
        const val ACTION_STOP = "com.safeguard.parentalcontrol.STOP_VOICE"
    }
}
