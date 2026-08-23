package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.Entity
import androidx.room.Index

/**
 * Aggregated usage seconds per app per day. The enforcement service
 * accumulates foreground time locally; the sync worker uploads the
 * daily totals to the server (idempotent accumulation there too).
 */
@Entity(
    tableName = "screen_time_daily",
    primaryKeys = ["date", "appPackage"],
    indices = [
        Index(value = ["date", "seconds"]),  // For upload queries sorted by date and seconds
        Index(value = ["appPackage"])  // For per-app queries
    ]
)
data class ScreenTimeDailyEntity(
    val appPackage: String,
    val appCategory: String?,
    val seconds: Int,
    val date: String
)
