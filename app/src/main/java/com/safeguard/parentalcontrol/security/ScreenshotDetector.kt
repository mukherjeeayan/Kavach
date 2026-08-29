package com.safeguard.parentalcontrol.security

import android.content.Context
import android.database.ContentObserver
import android.os.Build
import android.os.FileObserver
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Log
import com.safeguard.parentalcontrol.data.remote.api.Phase2Api
import com.safeguard.parentalcontrol.data.remote.dto.SecurityScanReportDto
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

/**
 * Detects screenshots taken on the device using a [ContentObserver]
 * on [MediaStore.Images.Media.EXTERNAL_CONTENT_URI] (API 30+) or a
 * [FileObserver] on the external files directory (API ≤29).
 *
 * When a screenshot is detected in a restricted context, an alert
 * is sent to the backend via [Phase2Api.reportSecurityScan].
 */
class ScreenshotDetector(
    private val context: Context,
    private val phase2Api: Phase2Api? = null,
    private val deviceId: String? = null
) {
    private val _screenshotEvents = MutableSharedFlow<ScreenshotEvent>(extraBufferCapacity = 16)
    val screenshotEvents = _screenshotEvents.asSharedFlow()

    private var fileObserver: FileObserver? = null
    private var contentObserver: ContentObserver? = null
    private val handler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var restrictedPackageActive: String? = null

    data class ScreenshotEvent(val timestamp: Long, val path: String?)

    fun start() {
        stop()

        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.Q) {
            val dir = context.getExternalFilesDir(null) ?: return
            fileObserver = object : FileObserver(dir, MOVED_FROM or CLOSE_WRITE) {
                override fun onEvent(event: Int, path: String?) {
                    if (event == MOVED_FROM || event == CLOSE_WRITE) {
                        handler.postDelayed({
                            path?.let {
                                onScreenshotDetected(it)
                            }
                        }, 200)
                    }
                }
            }
            fileObserver?.startWatching()
        } else {
            contentObserver = object : ContentObserver(handler) {
                override fun onChange(selfChange: Boolean) {
                    super.onChange(selfChange)
                    val cursor = context.contentResolver.query(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        null, null, null, null
                    )
                    if (cursor != null && cursor.moveToLast()) {
                        val path = cursor.getString(
                            cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
                        )
                        onScreenshotDetected(path)
                        cursor.close()
                    }
                }
            }
            contentObserver?.let {
                context.contentResolver.registerContentObserver(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI, false, it
                )
            }
        }
        Log.i(TAG, "Screenshot detection started")
    }

    fun stop() {
        try {
            fileObserver?.stopWatching()
        } catch (_: Exception) {}
        fileObserver = null
        try {
            contentObserver?.let { context.contentResolver.unregisterContentObserver(it) }
        } catch (_: Exception) {}
        contentObserver = null
    }

    /**
     * Called by the enforcement layer to inform the detector which
     * package is currently in the foreground. When a non-null restricted
     * package is active, screenshot alerts are escalated to the backend.
     */
    fun setRestrictedPackageActive(packageName: String?) {
        restrictedPackageActive = packageName
    }

    private fun onScreenshotDetected(path: String) {
        val event = ScreenshotEvent(System.currentTimeMillis(), path)
        _screenshotEvents.tryEmit(event)
        Log.d(TAG, "Screenshot detected: $path")

        // If a restricted app is active, alert the backend
        val activePkg = restrictedPackageActive
        if (activePkg != null && phase2Api != null && deviceId != null) {
            scope.launch {
                try {
                    phase2Api.reportSecurityScan(
                        deviceId,
                        SecurityScanReportDto(
                            isRooted = false,
                            hasKeylogger = false,
                            appIntegrityOk = false
                        )
                    )
                    Log.i(TAG, "Screenshot alert sent for restricted app: $activePkg")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to send screenshot alert", e)
                }
            }
        }
    }

    companion object {
        private const val TAG = "ScreenshotDetector"
    }
}
