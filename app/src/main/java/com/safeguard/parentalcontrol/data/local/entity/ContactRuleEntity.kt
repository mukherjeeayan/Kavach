package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Allow/block rule for a phone number, synced from the server. */
@Entity(tableName = "contact_rules")
data class ContactRuleEntity(
    @PrimaryKey val id: String,
    val phoneNumber: String,
    val contactName: String?,
    val ruleType: String,
    val isActive: Boolean
)
