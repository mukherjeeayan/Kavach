package com.safeguard.parentalcontrol.work

import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.os.Build
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.remote.api.Phase2Api
import com.safeguard.parentalcontrol.data.remote.dto.SecurityScanReportDto
import com.safeguard.parentalcontrol.data.remote.dto.WifiLogReportDto
import com.safeguard.parentalcontrol.security.TamperDetector
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.security.MessageDigest

/**
 * Periodic worker (every 12 hours) that performs a comprehensive
 * security scan: root detection, WiFi network analysis, and app
 * integrity verification. Reports results to the backend via
 * [Phase2Api.reportSecurityScan] and [Phase2Api.reportWifiLog].
 *
 * Stores last scan results in SharedPreferences for comparison.
 * Scheduled via [SyncScheduler.scheduleSecurityScan].
 */
@HiltWorker
class SecurityScanWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val phase2Api: Phase2Api,
    private val onboardingStore: OnboardingStore
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val deviceId = onboardingStore.deviceId ?: return Result.success()

        return try {
            val isRooted = TamperDetector.isRooted(applicationContext)

            val wifiInfo = getWifiInfo()
            val wifiSsid = wifiInfo?.ssid
            val wifiBssid = wifiInfo?.bssid
            val isOpenNetwork = wifiInfo?.isOpen ?: false

            val appIntegrityOk = checkAppIntegrity()

            val scan = SecurityScanReportDto(
                isRooted = isRooted,
                hasKeylogger = false,
                wifiSsid = wifiSsid,
                wifiBssid = wifiBssid,
                isOpenNetwork = isOpenNetwork,
                appIntegrityOk = appIntegrityOk
            )

            val scanResponse = phase2Api.reportSecurityScan(deviceId, scan)

            if (wifiSsid != null && wifiBssid != null) {
                val wifiLog = WifiLogReportDto(
                    wifiSsid = wifiSsid,
                    wifiBssid = wifiBssid,
                    wifiSecurity = wifiInfo?.security ?: "UNKNOWN",
                    isOpenNetwork = isOpenNetwork
                )
                phase2Api.reportWifiLog(deviceId, wifiLog)
            }

            if (scanResponse.isSuccessful && scanResponse.body()?.success == true) {
                val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit()
                    .putBoolean(LAST_IS_ROOTED, isRooted)
                    .putString(LAST_WIFI_SSID, wifiSsid)
                    .putString(LAST_WIFI_BSSID, wifiBssid)
                    .putBoolean(LAST_IS_OPEN, isOpenNetwork)
                    .putBoolean(LAST_INTEGRITY, appIntegrityOk)
                    .putLong(LAST_SCAN_TIME, System.currentTimeMillis())
                    .apply()

                Log.d(TAG, "Security scan reported: rooted=$isRooted, wifi=$wifiSsid, integrity=$appIntegrityOk")
                Result.success()
            } else {
                Log.w(TAG, "Security scan report failed: HTTP ${scanResponse.code()}")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e(TAG, "SecurityScanWorker failed", e)
            Result.retry()
        }
    }

    private fun getWifiInfo(): WifiNetworkInfo? {
        @Suppress("DEPRECATION")
        return try {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val connectionInfo = wifiManager.connectionInfo
            val ssid = connectionInfo.ssid?.removeSurrounding("\"")
            val bssid = connectionInfo.bssid
            if (ssid.isNullOrBlank() || ssid == "<unknown ssid>") return null

            val isWifiEnabled = wifiManager.isWifiEnabled
            if (!isWifiEnabled) return null

            val security = getSecurityType(wifiManager)

            WifiNetworkInfo(
                ssid = ssid,
                bssid = bssid,
                isOpen = security == "NONE",
                security = security
            )
        } catch (e: SecurityException) {
            Log.w(TAG, "ACCESS_WIFI_STATE permission not granted", e)
            null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get WiFi info", e)
            null
        }
    }

    private fun getSecurityType(wifiManager: WifiManager): String {
        @Suppress("DEPRECATION")
        return try {
            val scanResults = wifiManager.scanResults
            val connectionInfo = wifiManager.connectionInfo
            val matchedScan = scanResults?.find { it.BSSID == connectionInfo.bssid }

            if (matchedScan != null) {
                val capabilities = matchedScan.capabilities ?: ""
                when {
                    capabilities.contains("WPA3") -> "WPA3"
                    capabilities.contains("WPA2") -> "WPA2"
                    capabilities.contains("WPA") -> "WPA"
                    capabilities.contains("WEP") -> "WEP"
                    else -> "NONE"
                }
            } else {
                "UNKNOWN"
            }
        } catch (_: Exception) {
            "UNKNOWN"
        }
    }

    private fun checkAppIntegrity(): Boolean {
        return try {
            val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                applicationContext.packageManager.getPackageInfo(
                    applicationContext.packageName,
                    PackageManager.GET_SIGNING_CERTIFICATES
                )
            } @Suppress("DEPRECATION") else {
                applicationContext.packageManager.getPackageInfo(
                    applicationContext.packageName,
                    PackageManager.GET_SIGNATURES
                )
            }

            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.signingInfo.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }

            if (signatures == null || signatures.isEmpty()) return false

            val storedHash = getStoredSignatureHash()
            val currentHash = computeSignatureHash(signatures[0].toByteArray())

            if (storedHash == null) {
                saveSignatureHash(currentHash)
                true
            } else {
                currentHash == storedHash
            }
        } catch (e: Exception) {
            Log.e(TAG, "App integrity check failed", e)
            false
        }
    }

    private fun computeSignatureHash(signatureBytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(signatureBytes)
        return hash.joinToString("") { "%02x".format(it) }
    }

    private fun getStoredSignatureHash(): String? {
        val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(STORED_SIGNATURE_HASH, null)
    }

    private fun saveSignatureHash(hash: String) {
        applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(STORED_SIGNATURE_HASH, hash)
            .apply()
    }

    private data class WifiNetworkInfo(
        val ssid: String,
        val bssid: String,
        val isOpen: Boolean,
        val security: String
    )

    companion object {
        private const val TAG = "SecurityScanWorker"
        private const val PREFS_NAME = "safeguard_security_scan"
        private const val LAST_IS_ROOTED = "last_is_rooted"
        private const val LAST_WIFI_SSID = "last_wifi_ssid"
        private const val LAST_WIFI_BSSID = "last_wifi_bssid"
        private const val LAST_IS_OPEN = "last_is_open"
        private const val LAST_INTEGRITY = "last_integrity"
        private const val LAST_SCAN_TIME = "last_scan_time"
        private const val STORED_SIGNATURE_HASH = "stored_signature_hash"
    }
}
