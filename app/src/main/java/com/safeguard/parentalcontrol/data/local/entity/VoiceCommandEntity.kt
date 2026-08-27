package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "voice_commands")
data class VoiceCommandEntity(
    @PrimaryKey @ColumnInfo(name = "id") val id: String,
    @ColumnInfo(name = "child_id") val childId: String,
    @ColumnInfo(name = "device_id") val deviceId: String,
    @ColumnInfo(name = "command_text") val commandText: String,
    @ColumnInfo(name = "intent") val intent: String?,
    @ColumnInfo(name = "was_executed") val wasExecuted: Boolean,
    @ColumnInfo(name = "created_at") val createdAt: String
)
