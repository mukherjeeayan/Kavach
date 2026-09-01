package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Scheduled lock window synced from the server. A null deviceId means
 * the window applies to every device of the child; a null dayOfWeek
 * means every day.
 */
@Entity(tableName = "scheduled_locks")
data class ScheduledLockEntity(
    @PrimaryKey val id: String,
    val deviceId: String?,
    val dayOfWeek: Int?,
    val startTime: String,
    val endTime: String,
    val isActive: Boolean
)
