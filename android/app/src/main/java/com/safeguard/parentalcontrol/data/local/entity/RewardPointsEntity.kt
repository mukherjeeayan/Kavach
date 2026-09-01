package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "reward_points")
data class RewardPointsEntity(
    @PrimaryKey @ColumnInfo(name = "child_id") val childId: String,
    @ColumnInfo(name = "total_earned") val totalEarned: Int,
    @ColumnInfo(name = "total_redeemed") val totalRedeemed: Int,
    @ColumnInfo(name = "available") val available: Int
)
