package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class StringListConverter {
    @TypeConverter
    fun fromStringList(value: List<String>): String = Gson().toJson(value)
    @TypeConverter
    fun toStringList(value: String): List<String> = 
        Gson().fromJson(value, object : TypeToken<List<String>>() {}.type)
}

@Entity(tableName = "self_harm_alerts")
data class SelfHarmAlertEntity(
    @PrimaryKey @ColumnInfo(name = "id") val id: String,
    @ColumnInfo(name = "child_id") val childId: String,
    @ColumnInfo(name = "source_type") val sourceType: String,
    @ColumnInfo(name = "detected_keywords") val detectedKeywords: List<String>,
    @ColumnInfo(name = "content_snippet") val contentSnippet: String?,
    @ColumnInfo(name = "risk_level") val riskLevel: String,
    @ColumnInfo(name = "is_acknowledged") val isAcknowledged: Boolean,
    @ColumnInfo(name = "created_at") val createdAt: String
)
