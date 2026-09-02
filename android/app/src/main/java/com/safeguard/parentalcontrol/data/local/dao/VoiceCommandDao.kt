package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.safeguard.parentalcontrol.data.local.entity.VoiceCommandEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface VoiceCommandDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(command: VoiceCommandEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(commands: List<VoiceCommandEntity>)

    @Query("SELECT * FROM voice_commands WHERE child_id = :childId ORDER BY created_at DESC LIMIT :limit")
    suspend fun getForChild(childId: String, limit: Int = 50): List<VoiceCommandEntity>

    @Query("SELECT * FROM voice_commands WHERE device_id = :deviceId ORDER BY created_at DESC LIMIT :limit")
    fun getForDeviceFlow(deviceId: String, limit: Int = 50): Flow<List<VoiceCommandEntity>>

    @Query("DELETE FROM voice_commands WHERE created_at < :olderThan")
    suspend fun deleteOlderThan(olderThan: String)
}