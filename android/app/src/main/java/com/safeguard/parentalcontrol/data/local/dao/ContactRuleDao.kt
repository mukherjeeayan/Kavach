package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import com.safeguard.parentalcontrol.data.local.entity.ContactRuleEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ContactRuleDao {

    @Query("SELECT * FROM contact_rules ORDER BY contactName COLLATE NOCASE")
    fun getAll(): Flow<List<ContactRuleEntity>>

    @Query("SELECT * FROM contact_rules WHERE ruleType = 'BLOCK' AND isActive = 1")
    fun getActiveBlocks(): Flow<List<ContactRuleEntity>>

    @Upsert
    suspend fun upsertAll(contacts: List<ContactRuleEntity>)

    @Query("DELETE FROM contact_rules")
    suspend fun clearAll()
}
