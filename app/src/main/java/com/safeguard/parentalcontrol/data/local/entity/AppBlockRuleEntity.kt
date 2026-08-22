package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Room entity for app block rules, mirrors the backend `app_block_rules` table.
 *
 * Design note: We store the full ruleset locally so enforcement continues
 * uninterrupted when the device is offline.  The security skill mandates
 * "fail closed" — if the cache is stale or the API is unreachable, every
 * rule in this table is treated as authoritative until a fresh sync succeeds.
 */
@Entity(
    tableName = "app_block_rules",
    indices = [
        Index(value = ["device_id"]),
        Index(value = ["package_name"]),
        Index(value = ["device_id", "package_name"], unique = true)
    ]
)
data class AppBlockRuleEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "device_id")
    val deviceId: String,

    @ColumnInfo(name = "child_id")
    val childId: String,

    @ColumnInfo(name = "package_name")
    val packageName: String,

    @ColumnInfo(name = "app_name")
    val appName: String? = null,

    @ColumnInfo(name = "is_blocked")
    val isBlocked: Boolean = false,

    @ColumnInfo(name = "block_reason")
    val blockReason: String? = null,

    @ColumnInfo(name = "unblock_requested")
    val unblockRequested: Boolean = false,

    @ColumnInfo(name = "unblock_reason")
    val unblockReason: String? = null,

    /** Per-app daily usage cap in minutes; null = no cap. */
    @ColumnInfo(name = "dailyLimitMinutes")
    val dailyLimitMinutes: Int? = null,

    @ColumnInfo(name = "created_at")
    val createdAt: String,

    @ColumnInfo(name = "updated_at")
    val updatedAt: String
)
