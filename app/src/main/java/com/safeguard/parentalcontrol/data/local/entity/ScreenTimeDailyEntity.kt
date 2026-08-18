package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.Entity

/**
 * Aggregated usage seconds per app per day. The enforcement service
 * accumulates foreground time locally; the sync worker uploads the
 * daily totals to the server (idempotent accumulation there too).
 */
@Entity(tableName = "screen_time_daily", primaryKeys = ["date", "appPackage"])
data class ScreenTimeDailyEntity(
    val appPackage: String,
    val appCategory: String?,
    val seconds: Int,
    val date: String
)
