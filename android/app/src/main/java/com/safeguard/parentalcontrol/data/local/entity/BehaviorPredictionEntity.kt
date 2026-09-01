package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "behavior_predictions")
data class BehaviorPredictionEntity(
    @PrimaryKey @ColumnInfo(name = "id") val id: String,
    @ColumnInfo(name = "child_id") val childId: String,
    @ColumnInfo(name = "prediction_type") val predictionType: String,
    @ColumnInfo(name = "risk_score") val riskScore: Double,
    @ColumnInfo(name = "explanation") val explanation: String,
    @ColumnInfo(name = "data_window_days") val dataWindowDays: Int,
    @ColumnInfo(name = "created_at") val createdAt: String
)
