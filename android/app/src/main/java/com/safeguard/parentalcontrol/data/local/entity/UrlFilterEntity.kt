package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "url_filter_rules")
data class UrlFilterEntity(
    @PrimaryKey val id: String,
    val childId: String,
    val pattern: String,
    val ruleType: String,
    val category: String?,
    val isActive: Boolean
)
