package com.safeguard.parentalcontrol.work

import android.content.Context
import android.provider.CallLog
import android.provider.Telephony
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.remote.api.Phase2Api
import com.safeguard.parentalcontrol.data.remote.dto.CommunicationEntryDto
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Periodic worker (every 1 hour) that reads SMS logs and call logs
 * from the ContentResolver, deduplicates against previously synced
 * entries (tracked by last sync timestamp), and reports them to the
 * backend via [Phase2Api.reportCommunications].
 *
 * Requires READ_SMS and READ_CALL_LOG permissions.
 * Scheduled via [SyncScheduler.scheduleCommunicationSync].
 */
@HiltWorker
class CommunicationSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val phase2Api: Phase2Api,
    private val onboardingStore: OnboardingStore
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val deviceId = onboardingStore.deviceId ?: return Result.success()

        return try {
            val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val lastSyncTimestamp = prefs.getLong(KEY_LAST_SYNC, 0L)

            val entries = mutableListOf<CommunicationEntryDto>()

            entries.addAll(readSmsLogs(lastSyncTimestamp))
            entries.addAll(readCallLogs(lastSyncTimestamp))

            if (entries.isEmpty()) {
                Log.d(TAG, "No new communications to sync")
                return Result.success()
            }

            val response = phase2Api.reportCommunications(deviceId, entries)
            if (response.isSuccessful && response.body()?.success == true) {
                prefs.edit().putLong(KEY_LAST_SYNC, System.currentTimeMillis()).apply()
                Log.d(TAG, "Communications synced: ${entries.size} entries")
                Result.success()
            } else {
                Log.w(TAG, "Communication sync failed: HTTP ${response.code()}")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e(TAG, "CommunicationSyncWorker failed", e)
            Result.retry()
        }
    }

    private fun readSmsLogs(sinceTimestamp: Long): List<CommunicationEntryDto> {
        val entries = mutableListOf<CommunicationEntryDto>()
        try {
            val uri = Telephony.Sms.CONTENT_URI
            val projection = arrayOf(
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE
            )
            val selection = "${Telephony.Sms.DATE} > ?"
            val selectionArgs = arrayOf(sinceTimestamp.toString())
            val sortOrder = "${Telephony.Sms.DATE} DESC"

            applicationContext.contentResolver.query(
                uri, projection, selection, selectionArgs, sortOrder
            )?.use { cursor ->
                val addressIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val bodyIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
                val typeIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.TYPE)

                while (cursor.moveToNext()) {
                    val address = cursor.getString(addressIdx) ?: continue
                    val body = cursor.getString(bodyIdx) ?: continue
                    val date = cursor.getLong(dateIdx)
                    val type = cursor.getInt(typeIdx)

                    val direction = when (type) {
                        Telephony.Sms.MESSAGE_TYPE_SENT -> "OUTGOING"
                        Telephony.Sms.MESSAGE_TYPE_RECEIVED -> "INCOMING"
                        else -> "UNKNOWN"
                    }

                    entries.add(
                        CommunicationEntryDto(
                            commType = "SMS",
                            direction = direction,
                            peerNumber = address,
                            contentPreview = body.take(MAX_CONTENT_PREVIEW_LENGTH),
                            durationSeconds = null,
                            timestamp = formatTimestamp(date)
                        )
                    )
                }
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "READ_SMS permission not granted", e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read SMS logs", e)
        }
        return entries
    }

    private fun readCallLogs(sinceTimestamp: Long): List<CommunicationEntryDto> {
        val entries = mutableListOf<CommunicationEntryDto>()
        try {
            val uri = CallLog.Calls.CONTENT_URI
            val projection = arrayOf(
                CallLog.Calls.NUMBER,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.TYPE
            )
            val selection = "${CallLog.Calls.DATE} > ?"
            val selectionArgs = arrayOf(sinceTimestamp.toString())
            val sortOrder = "${CallLog.Calls.DATE} DESC"

            applicationContext.contentResolver.query(
                uri, projection, selection, selectionArgs, sortOrder
            )?.use { cursor ->
                val numberIdx = cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
                val dateIdx = cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)
                val durationIdx = cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)
                val typeIdx = cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)

                while (cursor.moveToNext()) {
                    val number = cursor.getString(numberIdx) ?: continue
                    val date = cursor.getLong(dateIdx)
                    val duration = cursor.getInt(durationIdx)
                    val type = cursor.getInt(typeIdx)

                    val direction = when (type) {
                        CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                        CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                        CallLog.Calls.MISSED_TYPE -> "MISSED"
                        CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                        else -> "UNKNOWN"
                    }

                    entries.add(
                        CommunicationEntryDto(
                            commType = "CALL",
                            direction = direction,
                            peerNumber = number,
                            contentPreview = null,
                            durationSeconds = duration,
                            timestamp = formatTimestamp(date)
                        )
                    )
                }
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "READ_CALL_LOG permission not granted", e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read call logs", e)
        }
        return entries
    }

    private fun formatTimestamp(millis: Long): String {
        return dateFormat.format(Date(millis))
    }

    companion object {
        private const val TAG = "CommunicationSyncWorker"
        private const val PREFS_NAME = "safeguard_comm_sync"
        private const val KEY_LAST_SYNC = "last_sync_timestamp"
        private const val MAX_CONTENT_PREVIEW_LENGTH = 160
        private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
    }
}
