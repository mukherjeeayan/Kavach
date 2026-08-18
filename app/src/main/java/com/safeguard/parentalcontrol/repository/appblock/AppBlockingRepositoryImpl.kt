package com.safeguard.parentalcontrol.repository.appblock

import android.util.Log
import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.data.remote.api.AppBlockingApi
import com.safeguard.parentalcontrol.data.remote.dto.BlockAppRequest
import com.safeguard.parentalcontrol.data.remote.dto.RequestUnblockRequest
import com.safeguard.parentalcontrol.data.remote.dto.TamperAlertRequest
import com.safeguard.parentalcontrol.security.TamperState
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

/**
 * Local-first repository implementation.
 *
 * Reads always come from Room so the UI is instantly responsive.
 * Writes go to the API first; on success, the local cache is updated.
 * If the API is unreachable, the local cache is NOT cleared — the
 * security skill mandates "fail closed": blocked apps stay blocked
 * until a successful sync proves otherwise.
 */
class AppBlockingRepositoryImpl @Inject constructor(
    private val dao: AppBlockRuleDao,
    private val api: AppBlockingApi,
    private val tamperState: TamperState
) : AppBlockingRepository {

    // ── Reactive reads (always from Room) ─────────────────────────

    override fun getBlockedAppsFlow(deviceId: String): Flow<List<AppBlockRuleEntity>> =
        dao.getBlockedAppsFlow(deviceId)

    override fun getAllRulesFlow(deviceId: String): Flow<List<AppBlockRuleEntity>> =
        dao.getAllRulesFlow(deviceId)

    override suspend fun getBlockedAppsSnapshot(deviceId: String): List<AppBlockRuleEntity> =
        dao.getBlockedAppsSnapshot(deviceId)

    override fun getUnblockRequestsFlow(deviceId: String): Flow<List<AppBlockRuleEntity>> =
        dao.getUnblockRequestsFlow(deviceId)

    // ── Sync from server ──────────────────────────────────────────

    /**
     * Pull the full blocked-app list from the server and replace the
     * local cache atomically.  Returns false (and keeps old cache
     * intact) if the network call fails for any reason.
     */
    override suspend fun syncFromServer(childId: String, deviceId: String): Boolean {
        return try {
            val response = api.getBlockedApps(childId)
            if (response.isSuccessful && response.body()?.success == true) {
                val serverRules = response.body()?.data?.map { dto ->
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
                        createdAt = dto.created_at,
                        updatedAt = dto.updated_at
                    )
                } ?: emptyList()

                // Atomic replace so the enforcement service never sees
                // a half-deleted state
                if (tamperState.lockdown) {
                    // Tamper lockdown: never weaken the policy. Keep
                    // every currently-cached blocked app as blocked even
                    // if the server reports it as unblocked, until a
                    // verified sync succeeds outside the lockdown.
                    val cached = dao.getBlockedAppsSnapshot(deviceId)
                    val hardened = serverRules + cached.filter { it.isBlocked }
                    dao.replaceAllForDevice(
                        deviceId,
                        hardened.distinctBy { it.id }
                    )
                    Log.w(TAG, "Tamper lockdown active — sync hardened, cache kept restrictive")
                } else {
                    dao.replaceAllForDevice(deviceId, serverRules)
                }
                Log.i(TAG, "Sync complete: ${serverRules.size} rules for device $deviceId")
                true
            } else {
                // API returned an error — keep existing cache (fail closed)
                Log.w(TAG, "Sync failed: API returned ${response.code()}")
                false
            }
        } catch (e: Exception) {
            // Network unreachable — keep existing cache (fail closed)
            Log.e(TAG, "Sync failed: network error", e)
            false
        }
    }

    // ── Write-through operations ──────────────────────────────────

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
                BlockAppRequest(
                    device_id = deviceId,
                    package_name = packageName,
                    app_name = appName,
                    block_reason = reason
                )
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
                    createdAt = dto.created_at,
                    updatedAt = dto.updated_at
                )
                dao.insert(entity)
                Result.success(entity)
            } else {
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "blockApp failed", e)
            Result.failure(e)
        }
    }

    override suspend fun unblockApp(childId: String, ruleId: String): Result<Unit> {
        return try {
            val response = api.unblockApp(childId, ruleId)
            if (response.isSuccessful) {
                dao.deleteById(ruleId)
                Result.success(Unit)
            } else {
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "unblockApp failed", e)
            Result.failure(e)
        }
    }

    override suspend fun requestUnblock(
        childId: String,
        ruleId: String,
        reason: String
    ): Result<AppBlockRuleEntity> {
        return try {
            val response = api.requestUnblock(
                childId,
                RequestUnblockRequest(rule_id = ruleId, reason = reason)
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
                    createdAt = dto.created_at,
                    updatedAt = dto.updated_at
                )
                dao.insert(entity)
                Result.success(entity)
            } else {
                Result.failure(Exception("API error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "requestUnblock failed", e)
            Result.failure(e)
        }
    }

    override suspend fun reportTamper(deviceId: String, details: String): Boolean {
        return try {
            val response = api.reportTamper(
                deviceId,
                TamperAlertRequest(details = details)
            )
            if (response.isSuccessful && response.body()?.success == true) {
                Log.w(TAG, "Tamper alert acknowledged by server")
                true
            } else {
                Log.w(TAG, "Tamper alert rejected: HTTP ${response.code()}")
                false
            }
        } catch (e: Exception) {
            // Offline / unreachable — the local lockdown still applies
            Log.e(TAG, "Tamper alert failed to reach server", e)
            false
        }
    }

    companion object {
        private const val TAG = "AppBlockingRepo"
    }
}
