package com.safeguard.parentalcontrol.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.safeguard.parentalcontrol.data.local.entity.ScreenTimeDailyEntity

@Dao
interface ScreenTimeDao {

    /**
     * Accumulate seconds into the daily row for (date, appPackage),
     * creating the row when it does not exist yet.
     */
    @Query(
        """
        INSERT INTO screen_time_daily (appPackage, appCategory, seconds, date)
        VALUES (:appPackage, :appCategory, :seconds, :date)
        ON CONFLICT (date, appPackage)
        DO UPDATE SET seconds = seconds + :seconds,
                      appCategory = COALESCE(:appCategory, appCategory)
        """
    )
    suspend fun addSeconds(appPackage: String, appCategory: String?, seconds: Int, date: String)

    @Query("SELECT * FROM screen_time_daily WHERE date = :date ORDER BY seconds DESC")
    suspend fun getByDate(date: String): List<ScreenTimeDailyEntity>

    /** All buffered rows across every date, oldest first — the upload delta. */
    @Query("SELECT * FROM screen_time_daily ORDER BY date ASC, seconds DESC")
    suspend fun getAll(): List<ScreenTimeDailyEntity>

    @Query("DELETE FROM screen_time_daily WHERE date = :date")
    suspend fun deleteByDate(date: String)

    @Query("DELETE FROM screen_time_daily WHERE date < :date")
    suspend fun deleteOlderThan(date: String)
}
