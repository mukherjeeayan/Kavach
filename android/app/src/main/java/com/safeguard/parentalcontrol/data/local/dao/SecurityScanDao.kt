package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.safeguard.parentalcontrol.data.local.entity.SecurityScanEntity

@Dao
interface SecurityScanDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(scan: SecurityScanEntity)

    @Query("SELECT * FROM security_scans ORDER BY created_at DESC LIMIT :limit")
    suspend fun getRecent(limit: Int = 50): List<SecurityScanEntity>

    @Query("SELECT * FROM security_scans WHERE has_keylogger = 1 ORDER BY created_at DESC LIMIT :limit")
    suspend fun getKeyloggerHits(limit: Int = 50): List<SecurityScanEntity>

    @Query("DELETE FROM security_scans WHERE created_at < :olderThan")
    suspend fun deleteOlderThan(olderThan: String)
}
