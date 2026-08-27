package com.safeguard.parentalcontrol.security

import android.content.Context
import android.database.ContentObserver
import android.os.Build
import android.os.FileObserver
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

class ScreenshotDetector(private val context: Context) {
    private val _screenshotEvents = MutableSharedFlow<ScreenshotEvent>()
    val screenshotEvents = _screenshotEvents.asSharedFlow()

    private var fileObserver: FileObserver? = null
    private var contentObserver: ContentObserver? = null
    private val handler = Handler(Looper.getMainLooper())

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
                                _screenshotEvents.tryEmit(ScreenshotEvent(System.currentTimeMillis(), it))
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
                        val path = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME))
                        _screenshotEvents.tryEmit(ScreenshotEvent(System.currentTimeMillis(), path))
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
}
