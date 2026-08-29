package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.safeguard.parentalcontrol.data.local.entity.BehaviorPredictionEntity

@Dao
interface BehaviorPredictionDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(prediction: BehaviorPredictionEntity)

    @Query("SELECT * FROM behavior_predictions WHERE child_id = :childId ORDER BY created_at DESC LIMIT :limit")
    suspend fun getForChild(childId: String, limit: Int = 50): List<BehaviorPredictionEntity>

    @Query("SELECT * FROM behavior_predictions WHERE child_id = :childId ORDER BY created_at DESC LIMIT 1")
    suspend fun getLatestForChild(childId: String): BehaviorPredictionEntity?
}
