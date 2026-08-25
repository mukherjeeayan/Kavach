package com.safeguard.parentalcontrol.repository.phase2

import android.util.Log
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.GeofenceDao
import com.safeguard.parentalcontrol.data.local.dao.UrlFilterDao
import com.safeguard.parentalcontrol.data.local.entity.GeofenceEntity
import com.safeguard.parentalcontrol.data.local.entity.UrlFilterEntity
import com.safeguard.parentalcontrol.data.remote.api.Phase2Api
import com.safeguard.parentalcontrol.data.remote.dto.CommunicationEntryDto
import com.safeguard.parentalcontrol.data.remote.dto.CommunicationReportDto
import com.safeguard.parentalcontrol.data.remote.dto.DeviceHealthReportDto
import com.safeguard.parentalcontrol.data.remote.dto.GeofenceCheckDto
import com.safeguard.parentalcontrol.data.remote.dto.GeofenceEventDto
import com.safeguard.parentalcontrol.data.remote.dto.MoodLogDto
import com.safeguard.parentalcontrol.data.remote.dto.SecurityScanReportDto
import com.safeguard.parentalcontrol.data.remote.dto.SosEventDto
import com.safeguard.parentalcontrol.data.remote.dto.SosTriggerDto
import com.safeguard.parentalcontrol.data.remote.dto.VoiceCommandReportDto
import com.safeguard.parentalcontrol.data.remote.dto.WifiLogReportDto
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class Phase2RepositoryImpl @Inject constructor(
    private val api: Phase2Api,
    private val onboardingStore: OnboardingStore,
    private val urlFilterDao: UrlFilterDao,
    private val geofenceDao: GeofenceDao
) : Phase2Repository {

    private val childId: String get() = onboardingStore.childId ?: ""
    private val deviceId: String get() = onboardingStore.deviceId ?: ""

    override fun getUrlFilterRules(): Flow<List<UrlFilterEntity>> =
        urlFilterDao.getActiveRules()

    override suspend fun syncUrlFilterRules(): Result<Unit> {
        return try {
            val response = api.syncUrlFilters(childId)
            if (response.isSuccessful && response.body()?.success == true) {
                val rules = response.body()?.data?.map { dto ->
                    UrlFilterEntity(
                        id = dto.id,
                        childId = dto.childId,
                        pattern = dto.pattern,
                        ruleType = dto.ruleType,
                        category = dto.category,
                        isActive = dto.isActive
                    )
                } ?: emptyList()
                urlFilterDao.clear()
                urlFilterDao.upsertAll(rules)
                Result.success(Unit)
            } else {
                Log.w(TAG, "URL filter sync failed: HTTP ${response.code()}")
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "URL filter sync failed", e)
            Result.failure(e)
        }
    }

    override fun getActiveGeofences(): Flow<List<GeofenceEntity>> =
        geofenceDao.getActiveGeofences()

    override suspend fun syncGeofences(): Result<Unit> {
        return try {
            val response = api.getActiveGeofences(deviceId)
            if (response.isSuccessful && response.body()?.success == true) {
                val geofences = response.body()?.data?.map { dto ->
                    GeofenceEntity(
                        id = dto.id,
                        childId = dto.childId,
                        name = dto.name,
                        latitude = dto.latitude,
                        longitude = dto.longitude,
                        radiusMeters = dto.radiusMeters,
                        zoneType = dto.zoneType,
                        isActive = dto.isActive
                    )
                } ?: emptyList()
                geofenceDao.clear()
                geofenceDao.upsertAll(geofences)
                Result.success(Unit)
            } else {
                Log.w(TAG, "Geofence sync failed: HTTP ${response.code()}")
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Geofence sync failed", e)
            Result.failure(e)
        }
    }

    override suspend fun reportDeviceHealth(health: DeviceHealthReportDto): Result<Unit> {
        return try {
            val response = api.reportDeviceHealth(deviceId, health)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "reportDeviceHealth failed", e)
            Result.failure(e)
        }
    }

    override suspend fun reportCommunications(entries: List<CommunicationEntryDto>): Result<Unit> {
        return try {
            val response = api.reportCommunications(deviceId, CommunicationReportDto(entries))
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "reportCommunications failed", e)
            Result.failure(e)
        }
    }

    override suspend fun triggerSos(latitude: Double?, longitude: Double?): Result<SosEventDto> {
        return try {
            val response = api.triggerSos(
                deviceId,
                SosTriggerDto(latitude = latitude, longitude = longitude)
            )
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "triggerSos failed", e)
            Result.failure(e)
        }
    }

    override suspend fun checkGeofences(latitude: Double, longitude: Double): Result<List<GeofenceEventDto>> {
        return try {
            val response = api.checkGeofences(deviceId, GeofenceCheckDto(latitude, longitude))
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "checkGeofences failed", e)
            Result.failure(e)
        }
    }

    override suspend fun logMood(score: Int, label: String?, note: String?): Result<Unit> {
        return try {
            val response = api.logMood(deviceId, MoodLogDto(score, label, note))
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "logMood failed", e)
            Result.failure(e)
        }
    }

    override suspend fun reportSecurityScan(scan: SecurityScanReportDto): Result<Unit> {
        return try {
            val response = api.reportSecurityScan(deviceId, scan)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "reportSecurityScan failed", e)
            Result.failure(e)
        }
    }

    override suspend fun reportWifiLog(log: WifiLogReportDto): Result<Unit> {
        return try {
            val response = api.reportWifiLog(deviceId, log)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "reportWifiLog failed", e)
            Result.failure(e)
        }
    }

    override suspend fun recordVoiceCommand(text: String, intent: String?, executed: Boolean): Result<Unit> {
        return try {
            val response = api.recordVoiceCommand(
                deviceId,
                VoiceCommandReportDto(commandText = text, intent = intent, wasExecuted = executed)
            )
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "recordVoiceCommand failed", e)
            Result.failure(e)
        }
    }

    companion object {
        private const val TAG = "Phase2Repo"
    }
}
