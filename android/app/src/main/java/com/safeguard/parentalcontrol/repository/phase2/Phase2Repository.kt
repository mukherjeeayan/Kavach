package com.safeguard.parentalcontrol.repository.phase2

import com.safeguard.parentalcontrol.data.local.entity.GeofenceEntity
import com.safeguard.parentalcontrol.data.local.entity.UrlFilterEntity
import com.safeguard.parentalcontrol.data.remote.dto.CommunicationEntryDto
import com.safeguard.parentalcontrol.data.remote.dto.DeviceHealthReportDto
import com.safeguard.parentalcontrol.data.remote.dto.GeofenceEventDto
import com.safeguard.parentalcontrol.data.remote.dto.SecurityScanReportDto
import com.safeguard.parentalcontrol.data.remote.dto.SosEventDto
import com.safeguard.parentalcontrol.data.remote.dto.WifiLogReportDto
import kotlinx.coroutines.flow.Flow

interface Phase2Repository {

    fun getUrlFilterRules(): Flow<List<UrlFilterEntity>>

    suspend fun syncUrlFilterRules(): Result<Unit>

    fun getActiveGeofences(): Flow<List<GeofenceEntity>>

    suspend fun syncGeofences(): Result<Unit>

    suspend fun reportDeviceHealth(health: DeviceHealthReportDto): Result<Unit>

    suspend fun reportCommunications(entries: List<CommunicationEntryDto>): Result<Unit>

    suspend fun triggerSos(latitude: Double?, longitude: Double?): Result<SosEventDto>

    suspend fun checkGeofences(latitude: Double, longitude: Double): Result<List<GeofenceEventDto>>

    suspend fun logMood(score: Int, label: String?, note: String?): Result<Unit>

    suspend fun reportSecurityScan(scan: SecurityScanReportDto): Result<Unit>

    suspend fun reportWifiLog(log: WifiLogReportDto): Result<Unit>

    suspend fun recordVoiceCommand(text: String, intent: String?, executed: Boolean): Result<Unit>
}
