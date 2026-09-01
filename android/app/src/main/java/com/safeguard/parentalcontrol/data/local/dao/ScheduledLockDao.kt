package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import com.safeguard.parentalcontrol.data.local.entity.ScheduledLockEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ScheduledLockDao {

    @Query("SELECT * FROM scheduled_locks WHERE isActive = 1 ORDER BY startTime ASC")
    fun getAll(): Flow<List<ScheduledLockEntity>>

    @Query("SELECT * FROM scheduled_locks")
    suspend fun getAllOnce(): List<ScheduledLockEntity>

    @Upsert
    suspend fun upsertAll(locks: List<ScheduledLockEntity>)

    @Query("DELETE FROM scheduled_locks")
    suspend fun clearAll()
}
