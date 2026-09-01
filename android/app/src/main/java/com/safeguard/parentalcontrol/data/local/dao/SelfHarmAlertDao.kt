package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.safeguard.parentalcontrol.data.local.entity.SelfHarmAlertEntity

@Dao
interface SelfHarmAlertDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(alert: SelfHarmAlertEntity)

    @Update
    suspend fun update(alert: SelfHarmAlertEntity)

    @Query("SELECT * FROM self_harm_alerts WHERE child_id = :childId ORDER BY created_at DESC LIMIT :limit")
    suspend fun getForChild(childId: String, limit: Int = 50): List<SelfHarmAlertEntity>

    @Query("SELECT * FROM self_harm_alerts WHERE is_acknowledged = 0 ORDER BY created_at DESC")
    suspend fun getUnacknowledged(): List<SelfHarmAlertEntity>
}
