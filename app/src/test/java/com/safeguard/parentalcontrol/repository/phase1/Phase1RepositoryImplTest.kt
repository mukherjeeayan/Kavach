package com.safeguard.parentalcontrol.repository.phase1

import com.safeguard.parentalcontrol.data.local.dao.ContactRuleDao
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.data.local.entity.ContactRuleEntity
import com.safeguard.parentalcontrol.data.local.entity.LocationEntryEntity
import com.safeguard.parentalcontrol.data.local.entity.ScheduledLockEntity
import com.safeguard.parentalcontrol.data.local.entity.ScreenTimeDailyEntity
import com.safeguard.parentalcontrol.data.remote.api.ParentalApi
import com.safeguard.parentalcontrol.data.remote.dto.ApiResponse
import com.safeguard.parentalcontrol.data.remote.dto.ContactInput
import com.safeguard.parentalcontrol.data.remote.dto.ContactRuleDto
import com.safeguard.parentalcontrol.data.remote.dto.LocationDto
import com.safeguard.parentalcontrol.data.remote.dto.LocationUploadRequest
import com.safeguard.parentalcontrol.data.remote.dto.LockInput
import com.safeguard.parentalcontrol.data.remote.dto.ScheduledLockDto
import com.safeguard.parentalcontrol.data.remote.dto.ScreenTimeSummaryDto
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import retrofit2.Response

class Phase1RepositoryImplTest {

    @Mock private lateinit var api: ParentalApi
    @Mock private lateinit var scheduledLockDao: ScheduledLockDao
    @Mock private lateinit var contactRuleDao: ContactRuleDao
    @Mock private lateinit var screenTimeDao: ScreenTimeDao
    @Mock private lateinit var locationDao: LocationDao

    private lateinit var repository: Phase1RepositoryImpl

    private val childId = "child-1"
    private val deviceId = "device-1"

    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        repository = Phase1RepositoryImpl(api, scheduledLockDao, contactRuleDao, screenTimeDao, locationDao)
    }

    private fun <T> successBody(data: T): Response<ApiResponse<T>> =
        Response.success(ApiResponse(success = true, data = data, error = null, timestamp = null, request_id = null))

    private fun <T> errorResponse(code: Int): Response<ApiResponse<T>> =
        Response.error(code, ResponseBody.create(null, "error"))

    // ── Locks ───────────────────────────────────────────────────

    @Test
    fun `listLocks returns locks on success`() = runTest {
        val locks = listOf(ScheduledLockDto("l1", "child-1", null, null, "21:00", "07:00", true, "2026-08-21T00:00:00Z", "2026-08-21T00:00:00Z"))
        whenever(api.listLocks(childId)).thenReturn(successBody(ParentalApi.LocksPayload(locks = locks)))

        val result = repository.listLocks(childId)
        assertEquals(1, result.size)
        assertEquals("l1", result[0].id)
    }

    @Test
    fun `listLocks returns empty on network failure`() = runTest {
        whenever(api.listLocks(childId)).thenThrow(RuntimeException("network"))

        val result = repository.listLocks(childId)
        assertTrue(result.isEmpty())
    }

    @Test
    fun `createLock returns null on failure`() = runTest {
        whenever(api.createLock(any(), any())).thenReturn(errorResponse(500))

        val result = repository.createLock(childId, LockInput(start_time = "21:00", end_time = "07:00"))
        assertNull(result)
    }

    @Test
    fun `deleteLock returns false on failure`() = runTest {
        whenever(api.deleteLock(any(), any())).thenThrow(RuntimeException("timeout"))

        val result = repository.deleteLock(childId, "l1")
        assertFalse(result)
    }

    // ── Contacts ────────────────────────────────────────────────

    @Test
    fun `listContacts returns contacts on success`() = runTest {
        val contacts = listOf(ContactRuleDto("c1", "child-1", null, "+15551234567", "Grandma", "ALLOW", true, "2026-08-21T00:00:00Z", "2026-08-21T00:00:00Z"))
        whenever(api.listContacts(childId)).thenReturn(successBody(ParentalApi.ContactsPayload(contacts = contacts)))

        val result = repository.listContacts(childId)
        assertEquals(1, result.size)
        assertEquals("Grandma", result[0].contact_name)
    }

    @Test
    fun `listContacts returns empty on exception`() = runTest {
        whenever(api.listContacts(childId)).thenThrow(RuntimeException("timeout"))

        val result = repository.listContacts(childId)
        assertTrue(result.isEmpty())
    }

    @Test
    fun `createContact returns null on failure`() = runTest {
        whenever(api.createContact(any(), any())).thenReturn(errorResponse(400))

        val result = repository.createContact(childId, ContactInput(phone_number = "+15551234567"))
        assertNull(result)
    }

    @Test
    fun `deleteContact returns false on exception`() = runTest {
        whenever(api.deleteContact(any(), any())).thenThrow(RuntimeException("offline"))

        val result = repository.deleteContact(childId, "c1")
        assertFalse(result)
    }

    // ── Screen Time ─────────────────────────────────────────────

    @Test
    fun `getScreenTimeSummary returns summary on success`() = runTest {
        val summary = ScreenTimeSummaryDto(range = "week", total_seconds = 3600, daily = emptyList(), by_app = emptyList())
        whenever(api.getScreenTimeSummary(childId, "week")).thenReturn(successBody(summary))

        val result = repository.getScreenTimeSummary(childId, "week")
        assertNotNull(result)
        assertEquals(3600, result!!.total_seconds)
    }

    @Test
    fun `getScreenTimeSummary returns null on failure`() = runTest {
        whenever(api.getScreenTimeSummary(childId, "week")).thenReturn(errorResponse(500))

        val result = repository.getScreenTimeSummary(childId, "week")
        assertNull(result)
    }

    // ── Location ────────────────────────────────────────────────

    @Test
    fun `getCurrentLocations returns locations on success`() = runTest {
        val locations = listOf(LocationDto("loc1", "child-1", "d1", 28.6139, 77.209, 10.0, 0.0, "2026-08-21T10:00:00Z"))
        whenever(api.getCurrentLocations(childId)).thenReturn(successBody(ParentalApi.LocationPayload(locations = locations)))

        val result = repository.getCurrentLocations(childId)
        assertEquals(1, result.size)
        assertEquals(28.6139, result[0].latitude, 0.001)
    }

    @Test
    fun `getCurrentLocations returns empty on exception`() = runTest {
        whenever(api.getCurrentLocations(childId)).thenThrow(RuntimeException("offline"))

        val result = repository.getCurrentLocations(childId)
        assertTrue(result.isEmpty())
    }

    @Test
    fun `uploadLocation returns true on success`() = runTest {
        whenever(api.uploadLocation(any(), any())).thenReturn(successBody(Unit))

        val result = repository.uploadLocation(
            deviceId,
            LocationUploadRequest(latitude = 28.6139, longitude = 77.209),
            System.currentTimeMillis()
        )
        assertTrue(result)
    }

    @Test
    fun `uploadLocation returns false on exception`() = runTest {
        whenever(api.uploadLocation(any(), any())).thenThrow(RuntimeException("timeout"))

        val result = repository.uploadLocation(
            deviceId,
            LocationUploadRequest(latitude = 28.6139, longitude = 77.209),
            System.currentTimeMillis()
        )
        assertFalse(result)
    }

    // ── Sync operations ─────────────────────────────────────────

    @Test
    fun `syncLocks returns false on API failure`() = runTest {
        whenever(api.listLocks(childId)).thenReturn(errorResponse(500))

        val result = repository.syncLocks(childId)
        assertFalse(result)
    }

    @Test
    fun `syncContacts returns false on exception`() = runTest {
        whenever(api.listContacts(childId)).thenThrow(RuntimeException("offline"))

        val result = repository.syncContacts(childId)
        assertFalse(result)
    }

    @Test
    fun `uploadScreenTimeSinceLastSync returns true for empty list`() = runTest {
        whenever(screenTimeDao.getAll()).thenReturn(emptyList())

        val result = repository.uploadScreenTimeSinceLastSync(deviceId)
        assertTrue(result)
    }

    @Test
    fun `uploadBufferedLocations returns true for empty list`() = runTest {
        whenever(locationDao.getUnsynced()).thenReturn(emptyList())

        val result = repository.uploadBufferedLocations(deviceId)
        assertTrue(result)
    }

    @Test
    fun `reportAdminStatus returns false on exception`() = runTest {
        whenever(api.reportAdminStatus(any(), any())).thenThrow(RuntimeException("offline"))

        val result = repository.reportAdminStatus(deviceId, true)
        assertFalse(result)
    }

    @Test
    fun `reportFcmToken returns false on exception`() = runTest {
        whenever(api.reportFcmToken(any(), any())).thenThrow(RuntimeException("offline"))

        val result = repository.reportFcmToken(deviceId, "token-123")
        assertFalse(result)
    }
}
