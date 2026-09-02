package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.safeguard.parentalcontrol.data.local.entity.RewardPointsEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface RewardPointsDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(rewards: RewardPointsEntity)

    @Query("SELECT * FROM reward_points WHERE child_id = :childId LIMIT 1")
    suspend fun getForChild(childId: String): RewardPointsEntity?

    @Query("SELECT * FROM reward_points WHERE child_id = :childId LIMIT 1")
    fun getForChildFlow(childId: String): Flow<RewardPointsEntity?>

    @Query("UPDATE reward_points SET total_earned = total_earned + :delta, available = available + :delta WHERE child_id = :childId")
    suspend fun incrementEarned(childId: String, delta: Int)

    @Query("UPDATE reward_points SET total_redeemed = total_redeemed + :delta, available = available - :delta WHERE child_id = :childId")
    suspend fun incrementRedeemed(childId: String, delta: Int)
}