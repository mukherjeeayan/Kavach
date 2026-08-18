package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Buffered GPS ping awaiting upload. `synced` flips to true once the
 * sync worker has POSTed the entry to the server.
 */
@Entity(tableName = "location_entries")
data class LocationEntryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val latitude: Double,
    val longitude: Double,
    val accuracyM: Double?,
    val speedKmh: Double?,
    val recordedAt: Long,
    val synced: Boolean = false
)
