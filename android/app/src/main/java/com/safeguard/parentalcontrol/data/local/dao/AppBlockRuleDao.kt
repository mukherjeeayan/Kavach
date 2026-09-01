package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import kotlinx.coroutines.flow.Flow

/**
 * DAO for app block rules.  All read queries return Flow so the UI
 * and the enforcement service react automatically when the local
 * cache is updated after an API sync.
 */
@Dao
interface AppBlockRuleDao {

    /**
     * Observe all currently-blocked package names for a given device.
     * Used by the foreground service for real-time enforcement.
     */
    @Query("SELECT * FROM app_block_rules WHERE device_id = :deviceId AND is_blocked = 1")
    fun getBlockedAppsFlow(deviceId: String): Flow<List<AppBlockRuleEntity>>

    /**
     * Observe the full rule list (blocked + unblocked) for the UI layer.
     */
    @Query("SELECT * FROM app_block_rules WHERE device_id = :deviceId ORDER BY created_at DESC")
    fun getAllRulesFlow(deviceId: String): Flow<List<AppBlockRuleEntity>>

    /**
     * Non-Flow variant used by the enforcement service when it needs
     * an immediate snapshot rather than a reactive stream.
     */
    @Query("SELECT * FROM app_block_rules WHERE device_id = :deviceId AND is_blocked = 1")
    suspend fun getBlockedAppsSnapshot(deviceId: String): List<AppBlockRuleEntity>

    @Query("SELECT * FROM app_block_rules WHERE id = :ruleId")
    suspend fun getRuleById(ruleId: String): AppBlockRuleEntity?

    /**
     * Lookup a rule for a specific device+package combination. Used
     * by the blocked-app overlay where the child only sees a package
     * name (not the server-side rule id) and needs to submit an
     * unblock request for that exact app.
     */
    @Query("SELECT * FROM app_block_rules WHERE device_id = :deviceId AND package_name = :packageName LIMIT 1")
    suspend fun getRuleByPackage(deviceId: String, packageName: String): AppBlockRuleEntity?

    /**
     * Observe rules where the child has requested an unblock.
     */
    @Query("SELECT * FROM app_block_rules WHERE device_id = :deviceId AND unblock_requested = 1")
    fun getUnblockRequestsFlow(deviceId: String): Flow<List<AppBlockRuleEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(rules: List<AppBlockRuleEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(rule: AppBlockRuleEntity)

    @Query("DELETE FROM app_block_rules WHERE id = :ruleId")
    suspend fun deleteById(ruleId: String)

    @Query("DELETE FROM app_block_rules WHERE device_id = :deviceId")
    suspend fun deleteAllForDevice(deviceId: String)

    /**
     * Full-replace sync: wipe old rules for this device, insert the
     * server's current list.  Wrapped in @Transaction so enforcement
     * never sees a half-deleted state.
     */
    @Transaction
    suspend fun replaceAllForDevice(deviceId: String, rules: List<AppBlockRuleEntity>) {
        deleteAllForDevice(deviceId)
        insertAll(rules)
    }
}
