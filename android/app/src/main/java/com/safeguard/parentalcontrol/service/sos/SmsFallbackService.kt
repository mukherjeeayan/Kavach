package com.safeguard.parentalcontrol.service.sos

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.telephony.SmsManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * SMS fallback service for emergency SOS alerts.
 *
 * When FCM push notifications fail to deliver (e.g., parent device
 * has no internet, Doze mode, or FCM is unavailable), this service
 * sends an emergency SMS with the child's location to the parent's
 * registered phone number.
 *
 * SMS is used as a last-resort fallback because:
 * - SMS works even without internet connectivity
 * - SMS bypasses Doze mode and battery optimization
 * - SMS is delivered with high priority by carriers
 * - SMS has near-universal delivery guarantee
 *
 * The SMS includes:
 * - Child's name and emergency message
 * - Google Maps link with current coordinates
 * - Timestamp
 * - Kavach emergency hotline number
 */
@Singleton
class SmsFallbackService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val locationDao: LocationDao
) {
    companion object {
        private const val TAG = "SmsFallbackService"
        private const val EMERGENCY_HOTLINE = "112" // Emergency number
        private const val MAX_SMS_LENGTH = 160
    }

    /**
     * Send emergency SMS to parent's phone number.
     *
     * @param parentPhone Parent's phone number (E.164 format)
     * @param childName Child's name for the message
     * @param childId Child's ID to fetch latest location
     * @param message Custom emergency message
     * @return true if SMS was sent successfully, false otherwise
     */
    suspend fun sendEmergencySms(
        parentPhone: String,
        childName: String,
        childId: String,
        message: String = "EMERGENCY: Your child needs help!"
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            // Check SMS permission
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                Log.e(TAG, "SEND_SMS permission not granted")
                return@withContext false
            }

            // Get child's last known location
            val lastLocation = locationDao.getLastLocation(childId)
            val locationText = if (lastLocation != null) {
                val mapsUrl = "https://maps.google.com/?q=${lastLocation.latitude},${lastLocation.longitude}"
                "\n📍 Location: $mapsUrl"
            } else {
                "\n📍 Location: Unknown"
            }

            // Build SMS message
            val smsMessage = buildString {
                append("🚨 EMERGENCY ALERT 🚨\n")
                append("\n")
                append("$childName needs help!\n")
                append("$message\n")
                append(locationText)
                append("\n\n🕐 Time: ${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())}")
                append("\n\n📞 Call $EMERGENCY_HOTLINE for immediate help")
                append("\n\n— Kavach Safety App")
            }

            // Send SMS
            val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            // Split message if too long
            val parts = smsManager.divideMessage(smsMessage)
            if (parts != null && parts.size > 1) {
                smsManager.sendMultipartTextMessage(parentPhone, null, parts, null, null)
            } else {
                smsManager.sendTextMessage(parentPhone, null, smsMessage, null, null)
            }

            Log.i(TAG, "Emergency SMS sent to $parentPhone for child $childId")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send emergency SMS", e)
            false
        }
    }

    /**
     * Send SOS SMS to multiple recipients.
     *
     * @param recipients List of phone numbers to send to
     * @param childName Child's name
     * @param childId Child's ID
     * @param message Custom message
     * @return Number of successful sends
     */
    suspend fun sendEmergencySmsToMultiple(
        recipients: List<String>,
        childName: String,
        childId: String,
        message: String = "EMERGENCY: Your child needs help!"
    ): Int {
        var successCount = 0
        for (phone in recipients) {
            if (sendEmergencySms(phone, childName, childId, message)) {
                successCount++
            }
        }
        return successCount
    }

    /**
     * Convenience method for SOS fallback when API/FCM fails.
     * Fetches the latest location and parent phone numbers, then sends SMS.
     */
    suspend fun sendSosFallback(latitude: Double?, longitude: Double?) {
        try {
            val latestLocation = locationDao.getLatest()
            val lat = latitude ?: latestLocation?.latitude
            val lng = longitude ?: latestLocation?.longitude

            // TODO: Fetch parent phone numbers from local cache or API
            // For now, log the attempt — parent phone numbers need to be
            // cached locally during sync for offline SMS fallback to work
            Log.w(TAG, "SMS fallback triggered (lat=$lat, lng=$lng) — parent phone numbers not cached locally")
        } catch (e: Exception) {
            Log.e(TAG, "SMS fallback failed", e)
        }
    }
}
