package com.safeguard.parentalcontrol.repository.appblock

import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.dao.SyncQueueDao
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.data.local.entity.SyncQueueEntity
import com.safeguard.parentalcontrol.data.remote.api.AppBlockingApi
import com.safeguard.parentalcontrol.data.remote.dto.BlockAppRequest
import com.safeguard.parentalcontrol.data.remote.dto.RequestUnblockRequest
import com.safeguard.parentalcontrol.data.remote.dto.TamperAlertRequest
import com.safeguard.parentalcontrol.security.TamperState
import com.google.gson.Gson
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class AppBlockingRepositoryImpl @Inject constructor(
    private val appBlockRuleDao: AppBlockRuleDao,
    private val syncQueueDao: SyncQueueDao,
    private val api: AppBlockingApi,
    private val tamperState: TamperState
) : AppBlockingRepository {

    override fun getBlockedAppsFlow(deviceId: String): Flow<List<AppBlockRuleEntity>> =
        appBlockRuleDao.getBlockedAppsFlow(deviceId)

    override fun getAllRulesFlow(deviceId: String): Flow<List<AppBlockRuleEntity>> =
        appBlockRuleDao.getAllRulesFlow(deviceId)

    override suspend fun getBlockedAppsSnapshot(deviceId: String): List<AppBlockRuleEntity> =
        appBlockRuleDao.getBlockedAppsSnapshot(deviceId)

    override fun getUnblockRequestsFlow(deviceId: String): Flow<List<AppBlockRuleEntity>> =
        appBlockRuleDao.getUnblockRequestsFlow(deviceId)

    override suspend fun syncFromServer(childId: String, deviceId: String): Boolean {
        return try {
            val response = api.getBlockedApps(childId)
            if (response.isSuccessful && response.body()?.data != null) {
                val dtos = response.body()!!.data!!
                val entities = dtos.map { dto ->
                    AppBlockRuleEntity(
                        id = dto.id,
                        deviceId = dto.device_id,
                        childId = childId,
                        packageName = dto.package_name,
                        appName = dto.app_name,
                        isBlocked = dto.is_blocked,
                        blockReason = dto.block_reason,
                        unblockRequested = dto.unblock_requested,
                        unblockReason = dto.unblock_reason,
                        dailyLimitMinutes = dto.daily_limit_minutes,
                        createdAt = dto.created_at,
                        updatedAt = dto.updated_at
                    )
                }
                appBlockRuleDao.replaceAllForDevice(deviceId, entities)
                true
            } else {
                false
            }
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun blockApp(
        childId: String,
        deviceId: String,
        packageName: String,
        appName: String?,
        reason: String?
    ): Result<AppBlockRuleEntity> {
        return try {
            val response = api.blockApp(
                childId,
                BlockAppRequest(device_id = deviceId, package_name = packageName, app_name = appName, block_reason = reason)
            )
            if (response.isSuccessful && response.body()?.data != null) {
                val dto = response.body()!!.data!!
                val entity = AppBlockRuleEntity(
                    id = dto.id,
                    deviceId = dto.device_id,
                    childId = childId,
                    packageName = dto.package_name,
                    appName = dto.app_name,
                    isBlocked = dto.is_blocked,
                    blockReason = dto.block_reason,
                    unblockRequested = dto.unblock_requested,
                    unblockReason = dto.unblock_reason,
                    dailyLimitMinutes = dto.daily_limit_minutes,
                    createdAt = dto.created_at,
                    updatedAt = dto.updated_at
                )
                appBlockRuleDao.insert(entity)
                Result.success(entity)
            } else {
                syncQueueDao.insert(SyncQueueEntity(
                    featureType = "APP_BLOCK",
                    action = "CREATE",
                    payloadJson = Gson().toJson(mapOf(
                        "childId" to childId,
                        "deviceId" to deviceId,
                        "packageName" to packageName,
                        "appName" to appName,
                        "reason" to reason
                    ))
                ))
                Result.success(AppBlockRuleEntity(
                    id = "pending_${System.currentTimeMillis()}",
                    deviceId = deviceId,
                    childId = childId,
                    packageName = packageName,
                    appName = appName,
                    isBlocked = true,
                    blockReason = reason,
                    createdAt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date()),
                    updatedAt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date())
                ))
            }
        } catch (e: Exception) {
            syncQueueDao.insert(SyncQueueEntity(
                featureType = "APP_BLOCK",
                action = "CREATE",
                payloadJson = Gson().toJson(mapOf(
                    "childId" to childId,
                    "deviceId" to deviceId,
                    "packageName" to packageName,
                    "appName" to appName,
                    "reason" to reason
                ))
            ))
            Result.success(AppBlockRuleEntity(
                id = "pending_${System.currentTimeMillis()}",
                deviceId = deviceId,
                childId = childId,
                packageName = packageName,
                appName = appName,
                isBlocked = true,
                blockReason = reason,
                createdAt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date()),
                updatedAt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date())
            ))
        }
    }

    override suspend fun unblockApp(childId: String, ruleId: String): Result<Unit> {
        return try {
            val response = api.unblockApp(childId, ruleId)
            if (response.isSuccessful) {
                appBlockRuleDao.deleteById(ruleId)
                Result.success(Unit)
            } else {
                syncQueueDao.insert(SyncQueueEntity(
                    featureType = "APP_BLOCK",
                    action = "DELETE",
                    payloadJson = Gson().toJson(mapOf("childId" to childId, "ruleId" to ruleId))
                ))
                Result.success(Unit)
            }
        } catch (e: Exception) {
            syncQueueDao.insert(SyncQueueEntity(
                featureType = "APP_BLOCK",
                action = "DELETE",
                payloadJson = Gson().toJson(mapOf("childId" to childId, "ruleId" to ruleId))
            ))
            Result.success(Unit)
        }
    }

    override suspend fun requestUnblock(childId: String, ruleId: String, reason: String): Result<AppBlockRuleEntity> {
        return try {
            val response = api.requestUnblock(childId, RequestUnblockRequest(rule_id = ruleId, reason = reason))
            if (response.isSuccessful && response.body()?.data != null) {
                val dto = response.body()!!.data!!
                val entity = AppBlockRuleEntity(
                    id = dto.id,
                    deviceId = dto.device_id,
                    childId = childId,
                    packageName = dto.package_name,
                    appName = dto.app_name,
                    isBlocked = dto.is_blocked,
                    blockReason = dto.block_reason,
                    unblockRequested = dto.unblock_requested,
                    unblockReason = dto.unblock_reason,
                    dailyLimitMinutes = dto.daily_limit_minutes,
                    createdAt = dto.created_at,
                    updatedAt = dto.updated_at
                )
                appBlockRuleDao.insert(entity)
                Result.success(entity)
            } else {
                Result.failure(Exception("Failed to submit unblock request"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun reportTamper(deviceId: String, details: String): Boolean {
        return try {
            val response = api.reportTamper(deviceId, TamperAlertRequest(details = details))
            response.isSuccessful
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun getRuleByPackage(deviceId: String, packageName: String): AppBlockRuleEntity? {
        return try {
            appBlockRuleDao.getRuleByPackage(deviceId, packageName)
        } catch (_: Exception) {
            null
        }
    }
}
