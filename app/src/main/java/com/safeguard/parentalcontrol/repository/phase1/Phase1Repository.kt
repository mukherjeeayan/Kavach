package com.safeguard.parentalcontrol.repository.phase1

import com.safeguard.parentalcontrol.data.remote.dto.ContactInput
import com.safeguard.parentalcontrol.data.remote.dto.ContactRuleDto
import com.safeguard.parentalcontrol.data.remote.dto.LocationDto
import com.safeguard.parentalcontrol.data.remote.dto.LocationUploadRequest
import com.safeguard.parentalcontrol.data.remote.dto.LockInput
import com.safeguard.parentalcontrol.data.remote.dto.ScheduledLockDto
import com.safeguard.parentalcontrol.data.remote.dto.ScreenTimeRowDto
import com.safeguard.parentalcontrol.data.remote.dto.ScreenTimeSummaryDto
import com.safeguard.parentalcontrol.data.remote.dto.ScreenTimeUploadEntry

/**
 * Server-side operations for the Phase 1 features (screen time,
 * scheduled locks, location, contacts). Read methods fall back to
 * safe defaults on network failure; uploads return whether the call
 * succeeded so the sync worker can decide to keep buffered data.
 */
interface Phase1Repository {

    suspend fun listLocks(childId: String): List<ScheduledLockDto>
    suspend fun createLock(childId: String, input: LockInput): ScheduledLockDto?
    suspend fun updateLock(childId: String, lockId: String, input: LockInput): ScheduledLockDto?
    suspend fun deleteLock(childId: String, lockId: String): Boolean

    suspend fun listContacts(childId: String): List<ContactRuleDto>
    suspend fun createContact(childId: String, input: ContactInput): ContactRuleDto?
    suspend fun updateContact(childId: String, contactId: String, input: ContactInput): ContactRuleDto?
    suspend fun deleteContact(childId: String, contactId: String): Boolean

    suspend fun getDailyScreenTime(childId: String, date: String): List<ScreenTimeRowDto>
    suspend fun getScreenTimeSummary(childId: String, range: String): ScreenTimeSummaryDto?

    suspend fun uploadScreenTime(deviceId: String, entries: List<ScreenTimeUploadEntry>): Boolean
    suspend fun uploadLocation(
        deviceId: String,
        entry: LocationUploadRequest,
        recordedAtEpochMs: Long
    ): Boolean

    suspend fun getCurrentLocations(childId: String): List<LocationDto>
    suspend fun getLocationHistory(childId: String): List<LocationDto>

    // ── Sync-worker oriented operations ────────────────────────────
    // These report success (true/false) so buffered data is only
    // dropped or caches overwritten after the server confirmed it.

    /** Pulls locks into the Room cache; returns false on failure. */
    suspend fun syncLocks(childId: String): Boolean

    /** Pulls contact rules into the Room cache; returns false on failure. */
    suspend fun syncContacts(childId: String): Boolean

    /** Uploads today's accumulated screen-time rows and clears them on success. */
    suspend fun uploadScreenTimeSinceLastSync(deviceId: String): Boolean

    /** Uploads all unsynced location entries, marking them synced on success. */
    suspend fun uploadBufferedLocations(deviceId: String): Boolean

    /** Reports whether SafeGuard is active as a device admin. */
    suspend fun reportAdminStatus(deviceId: String, adminActive: Boolean): Boolean

    /** Pushes the current Firebase push token to the server. */
    suspend fun reportFcmToken(deviceId: String, token: String): Boolean
}