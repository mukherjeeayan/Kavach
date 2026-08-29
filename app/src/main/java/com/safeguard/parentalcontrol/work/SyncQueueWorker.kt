package com.safeguard.parentalcontrol.work

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.data.local.dao.SyncQueueDao
import com.safeguard.parentalcontrol.data.remote.api.ParentalApi
import com.safeguard.parentalcontrol.data.remote.dto.LocationUploadRequest
import com.safeguard.parentalcontrol.data.remote.dto.ScreenTimeUploadEntry
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
import com.safeguard.parentalcontrol.repository.phase1.Phase1Repository
import com.safeguard.parentalcontrol.repository.phase2.Phase2Repository
import com.google.gson.Gson
import com.google.gson.JsonObject
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * One-shot worker that drains the local sync queue. Each pending item
 * is retried with exponential backoff; items that exhaust retries are
 * marked FAILED. Returns [Result.retry] when the network is unavailable
 * so WorkManager reschedules the attempt.
 */
@HiltWorker
class SyncQueueWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val syncQueueDao: SyncQueueDao,
    private val locationDao: LocationDao,
    private val screenTimeDao: ScreenTimeDao,
    private val phase1Repository: Phase1Repository,
    private val phase2Repository: Phase2Repository,
    private val appBlockingRepository: AppBlockingRepository,
    private val parentalApi: ParentalApi,
    private val onboardingStore: OnboardingStore
) : CoroutineWorker(appContext, workerParams) {

    private val gson = Gson()

    override suspend fun doWork(): Result {
        if (!hasNetworkConnectivity()) {
            return Result.retry()
        }

        var hasMore = true
        while (hasMore) {
            val pending = syncQueueDao.getPendingItemsList()
            if (pending.isEmpty()) {
                hasMore = false
                break
            }

            for (item in pending) {
                try {
                    when (item.featureType) {
                        "APP_BLOCK" -> handleAppBlock(item.action, item.payloadJson)
                        "CONTACT" -> handleContact(item.action, item.payloadJson)
                        "LOCATION" -> handleLocation(item.action, item.payloadJson)
                        "SCREEN_TIME" -> handleScreenTime(item.action, item.payloadJson)
                        "SOS" -> handleSos(item.action, item.payloadJson)
                    }
                    syncQueueDao.updateStatus(item.id, "COMPLETED")
                } catch (e: Exception) {
                    Log.e(TAG, "Sync failed for item ${item.id}: ${e.message}")
                    if (item.retryCount >= item.maxRetries) {
                        syncQueueDao.updateStatus(item.id, "FAILED")
                    } else {
                        syncQueueDao.updateStatus(item.id, "PENDING")
                    }
                }
            }
            hasMore = false
        }
        return Result.success()
    }

    private suspend fun handleAppBlock(action: String, payloadJson: String) {
        val payload = gson.fromJson(payloadJson, JsonObject::class.java)
        val childId = payload.get("childId")?.asString ?: return
        val deviceId = payload.get("deviceId")?.asString ?: return

        when (action) {
            "CREATE" -> {
                val packageName = payload.get("packageName")?.asString ?: return
                val appName = payload.get("appName")?.asString
                val reason = payload.get("reason")?.asString
                appBlockingRepository.blockApp(childId, deviceId, packageName, appName, reason)
            }
            "DELETE" -> {
                val ruleId = payload.get("ruleId")?.asString ?: return
                appBlockingRepository.unblockApp(childId, ruleId)
            }
        }
    }

    private suspend fun handleContact(action: String, payloadJson: String) {
        val payload = gson.fromJson(payloadJson, JsonObject::class.java)
        val childId = payload.get("childId")?.asString ?: return

        when (action) {
            "CREATE" -> {
                val phoneNumber = payload.get("phoneNumber")?.asString ?: return
                val contactName = payload.get("contactName")?.asString
                val ruleType = payload.get("ruleType")?.asString ?: "BLOCK"
                phase1Repository.createContact(
                    childId,
                    com.safeguard.parentalcontrol.data.remote.dto.ContactInput(
                        phone_number = phoneNumber,
                        contact_name = contactName,
                        rule_type = ruleType
                    )
                )
            }
        }
    }

    private suspend fun handleLocation(action: String, payloadJson: String) {
        val payload = gson.fromJson(payloadJson, JsonObject::class.java)
        val deviceId = onboardingStore.deviceId ?: return

        when (action) {
            "UPLOAD_BATCH" -> {
                phase1Repository.uploadBufferedLocations(deviceId)
            }
        }
    }

    private suspend fun handleScreenTime(action: String, payloadJson: String) {
        val deviceId = onboardingStore.deviceId ?: return

        when (action) {
            "UPLOAD" -> {
                phase1Repository.uploadScreenTimeSinceLastSync(deviceId)
            }
        }
    }

    private suspend fun handleSos(action: String, payloadJson: String) {
        val payload = gson.fromJson(payloadJson, JsonObject::class.java)
        val latitude = payload.get("latitude")?.asDouble
        val longitude = payload.get("longitude")?.asDouble

        phase2Repository.triggerSos(latitude, longitude)
    }

    private fun hasNetworkConnectivity(): Boolean {
        val cm = applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE)
            as android.net.ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    companion object {
        private const val TAG = "SyncQueueWorker"
    }
}
