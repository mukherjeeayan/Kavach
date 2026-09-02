package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.safeguard.parentalcontrol.data.local.entity.IntegrationConfigEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface IntegrationConfigDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(config: IntegrationConfigEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(configs: List<IntegrationConfigEntity>)

    @Query("SELECT * FROM integration_configs WHERE child_id = :childId")
    fun getForChildFlow(childId: String): Flow<List<IntegrationConfigEntity>>

    @Query("SELECT * FROM integration_configs WHERE child_id = :childId AND config_type = :configType LIMIT 1")
    suspend fun getByType(childId: String, configType: String): IntegrationConfigEntity?

    @Query("SELECT * FROM integration_configs WHERE child_id = :childId AND is_enabled = 1")
    suspend fun getEnabled(childId: String): List<IntegrationConfigEntity>

    @Query("DELETE FROM integration_configs WHERE id = :id")
    suspend fun deleteById(id: String)
}