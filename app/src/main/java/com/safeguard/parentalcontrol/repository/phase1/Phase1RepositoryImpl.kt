package com.safeguard.parentalcontrol.repository.phase1

import com.safeguard.parentalcontrol.data.local.dao.ContactRuleDao
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.data.local.entity.ContactRuleEntity
import com.safeguard.parentalcontrol.data.local.entity.ScheduledLockEntity
import com.safeguard.parentalcontrol.data.remote.api.ParentalApi
import com.safeguard.parentalcontrol.data.remote.dto.ContactInput
import com.safeguard.parentalcontrol.data.remote.dto.ContactRuleDto
import com.safeguard.parentalcontrol.data.remote.dto.LocationDto
import com.safeguard.parentalcontrol.data.remote.dto.LocationUploadRequest
import com.safeguard.parentalcontrol.data.remote.dto.LockInput
import com.safeguard.parentalcontrol.data.remote.dto.ScheduledLockDto
import com.safeguard.parentalcontrol.data.remote.dto.ScreenTimeRowDto
import com.safeguard.parentalcontrol.data.remote.dto.ScreenTimeSummaryDto
import com.safeguard.parentalcontrol.data.remote.dto.ScreenTimeUploadEntry
import com.safeguard.parentalcontrol.data.remote.dto.AdminStatusRequest
import com.safeguard.parentalcontrol.data.remote.dto.FcmTokenRequest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject

/**
 * Network-failure-safe implementation: every read degrades to an
 * empty/absent result, every upload reports success so buffered data
 * is only dropped once the server confirmed it.
 */
class Phase1RepositoryImpl @Inject constructor(
    private val api: ParentalApi,
    private val scheduledLockDao: ScheduledLockDao,
    private val contactRuleDao: ContactRuleDao,
    private val screenTimeDao: ScreenTimeDao,
    private val locationDao: LocationDao
) : Phase1Repository {

    override suspend fun listLocks(childId: String): List<ScheduledLockDto> {
        return try {
            api.listLocks(childId).body()?.data?.locks ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    override suspend fun createLock(childId: String, input: LockInput): ScheduledLockDto? {
        return try {
            api.createLock(childId, input).body()?.data
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun updateLock(
        childId: String,
        lockId: String,
        input: LockInput
    ): ScheduledLockDto? {
        return try {
            api.updateLock(childId, lockId, input).body()?.data
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun deleteLock(childId: String, lockId: String): Boolean {
        return try {
            api.deleteLock(childId, lockId).isSuccessful
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun listContacts(childId: String): List<ContactRuleDto> {
        return try {
            api.listContacts(childId).body()?.data?.contacts ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    override suspend fun createContact(childId: String, input: ContactInput): ContactRuleDto? {
        return try {
            api.createContact(childId, input).body()?.data
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun updateContact(
        childId: String,
        contactId: String,
        input: ContactInput
    ): ContactRuleDto? {
        return try {
            api.updateContact(childId, contactId, input).body()?.data
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun deleteContact(childId: String, contactId: String): Boolean {
        return try {
            api.deleteContact(childId, contactId).isSuccessful
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun getDailyScreenTime(childId: String, date: String): List<ScreenTimeRowDto> {
        return try {
            api.getDailyScreenTime(childId, date).body()?.data ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    override suspend fun getScreenTimeSummary(
        childId: String,
        range: String
    ): ScreenTimeSummaryDto? {
        return try {
            api.getScreenTimeSummary(childId, range).body()?.data
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun uploadScreenTime(
        deviceId: String,
        entries: List<ScreenTimeUploadEntry>
    ): Boolean {
        if (entries.isEmpty()) return true
        return try {
            api.uploadScreenTime(deviceId, ParentalApi.ScreenTimeUploadBody(entries)).isSuccessful
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun uploadLocation(
        deviceId: String,
        entry: LocationUploadRequest,
        recordedAtEpochMs: Long
    ): Boolean {
        val withTimestamp = if (entry.recorded_at == null) {
            entry.copy(recorded_at = isoUtc(recordedAtEpochMs))
        } else {
            entry
        }
        return try {
            api.uploadLocation(deviceId, withTimestamp).isSuccessful
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun getCurrentLocations(childId: String): List<LocationDto> {
        return try {
            api.getCurrentLocations(childId).body()?.data?.locations ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    override suspend fun getLocationHistory(childId: String): List<LocationDto> {
        return try {
            api.getLocationHistory(childId).body()?.data?.locations ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    override suspend fun syncLocks(childId: String): Boolean {
        return try {
            val remote = api.listLocks(childId)
            if (!remote.isSuccessful || remote.body()?.success != true) return false
            val locks = remote.body()?.data?.locks ?: emptyList()
            scheduledLockDao.clearAll()
            scheduledLockDao.upsertAll(
                locks.map {
                    ScheduledLockEntity(
                        id = it.id,
                        deviceId = it.device_id,
                        dayOfWeek = it.day_of_week,
                        startTime = it.start_time,
                        endTime = it.end_time,
                        isActive = it.is_active
                    )
                }
            )
            true
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun syncContacts(childId: String): Boolean {
        return try {
            val remote = api.listContacts(childId)
            if (!remote.isSuccessful || remote.body()?.success != true) return false
            val contacts = remote.body()?.data?.contacts ?: emptyList()
            contactRuleDao.clearAll()
            contactRuleDao.upsertAll(
                contacts.map {
                    ContactRuleEntity(
                        id = it.id,
                        phoneNumber = it.phone_number,
                        contactName = it.contact_name,
                        ruleType = it.rule_type,
                        isActive = it.is_active
                    )
                }
            )
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Uploads every buffered screen-time row (all dates — a device
     * that stayed offline for days must not lose the days it missed).
     * Rows are deleted only after the server acknowledged them, and
     * only for the dates that were actually uploaded.
     */
    override suspend fun uploadScreenTimeSinceLastSync(deviceId: String): Boolean {
        return try {
            val rows = screenTimeDao.getAll()
            if (rows.isEmpty()) return true

            val ok = api.uploadScreenTime(
                deviceId,
                ParentalApi.ScreenTimeUploadBody(
                    rows.map {
                        ScreenTimeUploadEntry(
                            app_package = it.appPackage,
                            app_category = it.appCategory,
                            seconds = it.seconds,
                            date = it.date
                        )
                    }
                )
            ).isSuccessful
            if (ok) {
                // Server accumulates seconds idempotently, so a dropped
                // delta is safe only after the server confirmed it.
                rows.map { it.date }.distinct().forEach { date ->
                    screenTimeDao.deleteByDate(date)
                }
            }
            ok
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun uploadBufferedLocations(deviceId: String): Boolean {
        return try {
            val pending = locationDao.getUnsynced()
            if (pending.isEmpty()) return true

            val syncedIds = mutableListOf<Long>()
            for (entry in pending) {
                val ok = uploadLocation(
                    deviceId,
                    LocationUploadRequest(
                        latitude = entry.latitude,
                        longitude = entry.longitude,
                        accuracy_m = entry.accuracyM,
                        speed_kmh = entry.speedKmh
                    ),
                    entry.recordedAt
                )
                if (ok) syncedIds.add(entry.id)
            }
            if (syncedIds.isNotEmpty()) {
                locationDao.markSynced(syncedIds)
            }
            locationDao.deleteSyncedOlderThan(System.currentTimeMillis() - DAY_MS * 7)
            syncedIds.size == pending.size
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun reportAdminStatus(deviceId: String, adminActive: Boolean): Boolean {
        return try {
            api.reportAdminStatus(deviceId, AdminStatusRequest(adminActive)).isSuccessful
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun reportFcmToken(deviceId: String, token: String): Boolean {
        return try {
            api.reportFcmToken(deviceId, FcmTokenRequest(token)).isSuccessful
        } catch (_: Exception) {
            false
        }
    }

    private fun isoUtc(epochMs: Long): String {
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        format.timeZone = TimeZone.getTimeZone("UTC")
        return format.format(Date(epochMs))
    }

    private companion object {
        const val DAY_MS = 24L * 60 * 60 * 1000
    }
}