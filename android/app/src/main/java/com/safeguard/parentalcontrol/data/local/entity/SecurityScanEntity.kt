package com.safeguard.parentalcontrol.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "security_scans")
data class SecurityScanEntity(
    @PrimaryKey @ColumnInfo(name = "id") val id: String,
    @ColumnInfo(name = "child_id") val childId: String,
    @ColumnInfo(name = "device_id") val deviceId: String,
    @ColumnInfo(name = "is_rooted") val isRooted: Boolean,
    @ColumnInfo(name = "has_keylogger") val hasKeylogger: Boolean,
    @ColumnInfo(name = "wifi_ssid") val wifiSsid: String?,
    @ColumnInfo(name = "wifi_bssid") val wifiBssid: String?,
    @ColumnInfo(name = "is_open_network") val isOpenNetwork: Boolean,
    @ColumnInfo(name = "app_integrity_ok") val appIntegrityOk: Boolean,
    @ColumnInfo(name = "scan_result") val scanResult: String,
    @ColumnInfo(name = "created_at") val createdAt: String
)
