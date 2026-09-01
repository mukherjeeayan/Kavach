package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.*
import com.safeguard.parentalcontrol.data.local.entity.SyncQueueEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SyncQueueDao {
    @Query("SELECT * FROM sync_queue WHERE status = 'PENDING' ORDER BY createdAt ASC")
    fun getPendingItems(): Flow<List<SyncQueueEntity>>

    @Query("SELECT * FROM sync_queue WHERE status = 'PENDING' ORDER BY createdAt ASC")
    suspend fun getPendingItemsList(): List<SyncQueueEntity>

    @Insert
    suspend fun insert(item: SyncQueueEntity): Long

    @Query("UPDATE sync_queue SET status = :status, retryCount = retryCount + 1 WHERE id = :id")
    suspend fun updateStatus(id: Long, status: String)

    @Query("DELETE FROM sync_queue WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM sync_queue WHERE status = 'COMPLETED'")
    suspend fun deleteCompleted()

    @Query("SELECT COUNT(*) FROM sync_queue WHERE status = 'PENDING'")
    suspend fun getPendingCount(): Int
}