package com.safeguard.parentalcontrol.security

import android.content.Context
import android.database.ContentObserver
import android.os.Build
import android.os.Environment
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
        fileObserver?.stop()
        contentObserver?.stop()

        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.Q) {
            fileObserver = FileObserver(context.getExternalFilesDir(null)?.absolutePath ?: "") { event ->
                if (event == FileObserver.MOVED_FROM || event == FileObserver.CLOSE_WRITE) {
                    handler.postDelayed { _screenshotEvents.emit(ScreenshotEvent(System.currentTimeMillis(), it) }, 200)
                }
            }
            fileObserver?.start(FileObserver.MOVED_FROM or FileObserver.CLOSE_WRITE)
        } else {
            contentObserver = object : ContentObserver(handler) {
                override fun onChange(selfChange: Boolean) {
                    super.onChange(selfChange)
                    val cursor = context.contentResolver.query(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        null,
                        null,
                        null,
                        null
                    )
                    if (cursor != null && cursor.moveToLast()) {
                        val path = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME))
                        _screenshotEvents.emit(ScreenshotEvent(System.currentTimeMillis(), path))
                        cursor.close()
                    }
                }
            }
            context.contentResolver.registerContentObserver(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, false, contentObserver)
        }
    }

    fun stop() {
        fileObserver?.stop()
        contentObserver?.stop()
        context.contentResolver.unregisterContentObserver(contentObserver)
    }
}