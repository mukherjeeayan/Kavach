package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "mood_logs")
data class MoodLogEntity(
    @PrimaryKey @ColumnInfo(name = "id") val id: String,
    @ColumnInfo(name = "child_id") val childId: String,
    @ColumnInfo(name = "mood_score") val moodScore: Int,
    @ColumnInfo(name = "mood_label") val moodLabel: String?,
    @ColumnInfo(name = "note") val note: String?,
    @ColumnInfo(name = "logged_at") val loggedAt: String
)
