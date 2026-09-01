package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.safeguard.parentalcontrol.data.local.entity.LocationEntryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface LocationDao {

    @Insert
    suspend fun insert(entry: LocationEntryEntity)

    @Query("SELECT * FROM location_entries WHERE synced = 0 ORDER BY recordedAt ASC")
    suspend fun getUnsynced(): List<LocationEntryEntity>

    /** Reactive view of the most recent pings for the on-device dashboard. */
    @Query("SELECT * FROM location_entries ORDER BY recordedAt DESC LIMIT 50")
    fun flowRecent(): Flow<List<LocationEntryEntity>>

    @Query("UPDATE location_entries SET synced = 1 WHERE id IN (:ids)")
    suspend fun markSynced(ids: List<Long>)

    @Query("DELETE FROM location_entries WHERE synced = 1 AND recordedAt < :olderThan")
    suspend fun deleteSyncedOlderThan(olderThan: Long)
}
