package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.safeguard.parentalcontrol.data.local.entity.UrlFilterEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface UrlFilterDao {
    @Query("SELECT * FROM url_filter_rules WHERE isActive = 1")
    fun getActiveRules(): Flow<List<UrlFilterEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rules: List<UrlFilterEntity>)

    @Query("DELETE FROM url_filter_rules")
    suspend fun clear()
}
