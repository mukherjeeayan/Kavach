package com.safeguard.parentalcontrol.repository.appblock

import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import kotlinx.coroutines.flow.Flow

/**
 * Repository interface for app blocking.
 * Defined as an interface so the implementation can be swapped for
 * testing (mandatory per the Android skill — interface + impl).
 */
interface AppBlockingRepository {

    /** Reactive stream of all blocked apps for a device. */
    fun getBlockedAppsFlow(deviceId: String): Flow<List<AppBlockRuleEntity>>

    /** Reactive stream of the full rule list for the UI. */
    fun getAllRulesFlow(deviceId: String): Flow<List<AppBlockRuleEntity>>

    /** Immediate snapshot for the enforcement service. */
    suspend fun getBlockedAppsSnapshot(deviceId: String): List<AppBlockRuleEntity>

    /** Reactive stream of pending unblock requests. */
    fun getUnblockRequestsFlow(deviceId: String): Flow<List<AppBlockRuleEntity>>

    /**
     * Pull latest rules from the server and replace the local cache.
     * Returns true if the sync succeeded, false if it fell back to cache.
     */
    suspend fun syncFromServer(childId: String, deviceId: String): Boolean

    /** Block an app via API, then persist locally. */
    suspend fun blockApp(
        childId: String,
        deviceId: String,
        packageName: String,
        appName: String? = null,
        reason: String? = null
    ): Result<AppBlockRuleEntity>

    /** Unblock an app via API, then remove from local cache. */
    suspend fun unblockApp(childId: String, ruleId: String): Result<Unit>

    /** Submit a child-initiated unblock request. */
    suspend fun requestUnblock(childId: String, ruleId: String, reason: String): Result<AppBlockRuleEntity>
}
