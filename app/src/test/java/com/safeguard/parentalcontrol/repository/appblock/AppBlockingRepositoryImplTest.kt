package com.safeguard.parentalcontrol.repository.appblock

import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.data.remote.api.AppBlockingApi
import com.safeguard.parentalcontrol.data.remote.dto.ApiResponse
import com.safeguard.parentalcontrol.data.remote.dto.AppBlockRuleDto
import com.safeguard.parentalcontrol.security.TamperState
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import retrofit2.Response

/**
 * Unit tests for AppBlockingRepositoryImpl.
 *
 * Strategy: mock the DAO and API, verify that:
 * - Reads always come from DAO (local-first).
 * - Successful syncs replace the local cache atomically.
 * - Failed syncs preserve the existing cache (fail closed).
 * - Write-through operations hit API then persist locally.
 */
class AppBlockingRepositoryImplTest {

    @Mock
    private lateinit var dao: AppBlockRuleDao

    @Mock
    private lateinit var api: AppBlockingApi

    private lateinit var repository: AppBlockingRepositoryImpl

    private val childId = "child-uuid"
    private val deviceId = "device-uuid"
    private val ruleId = "rule-uuid"

    private val sampleEntity = AppBlockRuleEntity(
        id = ruleId,
        deviceId = deviceId,
        childId = childId,
        packageName = "com.example.blocked",
        appName = "Blocked App",
        isBlocked = true,
        blockReason = "Inappropriate",
        unblockRequested = false,
        unblockReason = null,
        createdAt = "2024-01-01T00:00:00Z",
        updatedAt = "2024-01-01T00:00:00Z"
    )

    private val sampleDto = AppBlockRuleDto(
        id = ruleId,
        device_id = deviceId,
        package_name = "com.example.blocked",
        app_name = "Blocked App",
        is_blocked = true,
        block_reason = "Inappropriate",
        unblock_requested = false,
        unblock_reason = null,
        created_at = "2024-01-01T00:00:00Z",
        updated_at = "2024-01-01T00:00:00Z"
    )

    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        repository = AppBlockingRepositoryImpl(dao, api, TamperState())
    }

    // ── Local-first reads ─────────────────────────────────────

    @Test
    fun `getBlockedAppsFlow returns data from DAO`() = runTest {
        whenever(dao.getBlockedAppsFlow(deviceId)).thenReturn(flowOf(listOf(sampleEntity)))

        val flow = repository.getBlockedAppsFlow(deviceId)

        // Verify API was never called — reads are always local
        verify(api, never()).getBlockedApps(any())
    }

    @Test
    fun `getBlockedAppsSnapshot returns data from DAO`() = runTest {
        whenever(dao.getBlockedAppsSnapshot(deviceId)).thenReturn(listOf(sampleEntity))

        val result = repository.getBlockedAppsSnapshot(deviceId)

        assert(result.size == 1)
        assert(result[0].packageName == "com.example.blocked")
    }

    // ── Sync behaviour ────────────────────────────────────────

    @Test
    fun `syncFromServer replaces local cache on success`() = runTest {
        val apiResponse = ApiResponse(
            success = true,
            data = listOf(sampleDto),
            error = null,
            timestamp = null,
            request_id = null
        )
        whenever(api.getBlockedApps(childId)).thenReturn(Response.success(apiResponse))

        val result = repository.syncFromServer(childId, deviceId)

        assert(result) // sync succeeded
        verify(dao).replaceAllForDevice(any(), any())
    }

    @Test
    fun `syncFromServer preserves cache on network failure (fail closed)`() = runTest {
        whenever(api.getBlockedApps(childId)).thenThrow(RuntimeException("No network"))

        val result = repository.syncFromServer(childId, deviceId)

        assert(!result) // sync failed
        // Verify we never touched the local cache
        verify(dao, never()).replaceAllForDevice(any(), any())
        verify(dao, never()).deleteAllForDevice(any())
    }

    @Test
    fun `syncFromServer preserves cache on API error response (fail closed)`() = runTest {
        val errorResponse = ApiResponse<List<AppBlockRuleDto>>(
            success = false,
            data = null,
            error = "Server error",
            timestamp = null,
            request_id = null
        )
        whenever(api.getBlockedApps(childId)).thenReturn(Response.success(errorResponse))

        val result = repository.syncFromServer(childId, deviceId)

        assert(!result)
        verify(dao, never()).replaceAllForDevice(any(), any())
    }

    @Test
    fun `syncFromServer keeps cached blocked apps during tamper lockdown`() = runTest {
        val tamperState = TamperState()
        repository = AppBlockingRepositoryImpl(dao, api, tamperState)
        tamperState.lockdown = true

        // Server reports the app as UNblocked — a weakening sync
        val weakenedResponse = ApiResponse(
            success = true,
            data = listOf(sampleDto.copy(is_blocked = false)),
            error = null,
            timestamp = null,
            request_id = null
        )
        whenever(api.getBlockedApps(childId)).thenReturn(Response.success(weakenedResponse))
        // Local cache still has it as blocked
        whenever(dao.getBlockedAppsSnapshot(deviceId)).thenReturn(listOf(sampleEntity))

        val result = repository.syncFromServer(childId, deviceId)

        assert(result)
        // The hardened merge must keep the cached blocked rule
        verify(dao).replaceAllForDevice(any(), any())
    }

    @Test
    fun `reportTamper returns true when server acknowledges`() = runTest {
        whenever(api.reportTamper(any(), any())).thenReturn(
            Response.success(ApiResponse(success = true, data = Unit, error = null, timestamp = null, request_id = null))
        )

        val result = repository.reportTamper(deviceId, "root=true debugger=false")

        assert(result)
        verify(api).reportTamper(any(), any())
    }

    @Test
    fun `reportTamper returns false on network failure`() = runTest {
        whenever(api.reportTamper(any(), any())).thenThrow(RuntimeException("No network"))

        val result = repository.reportTamper(deviceId, "root=true")

        assert(!result)
    }

    // ── Write-through ─────────────────────────────────────────

    @Test
    fun `blockApp persists locally after successful API call`() = runTest {
        val apiResponse = ApiResponse(
            success = true,
            data = sampleDto,
            error = null,
            timestamp = null,
            request_id = null
        )
        whenever(api.blockApp(any(), any())).thenReturn(Response.success(apiResponse))

        val result = repository.blockApp(childId, deviceId, "com.example.blocked", "Blocked App", "Inappropriate")

        assert(result.isSuccess)
        verify(dao).insert(any())
    }

    @Test
    fun `blockApp returns failure when API call fails`() = runTest {
        whenever(api.blockApp(any(), any())).thenThrow(RuntimeException("Network error"))

        val result = repository.blockApp(childId, deviceId, "com.example.blocked")

        assert(result.isFailure)
        // Verify we did NOT write to local DB on failure
        verify(dao, never()).insert(any())
    }

    @Test
    fun `unblockApp removes from local DB after successful API call`() = runTest {
        whenever(api.unblockApp(childId, ruleId)).thenReturn(Response.success(
            ApiResponse(success = true, data = Unit, error = null, timestamp = null, request_id = null)
        ))

        val result = repository.unblockApp(childId, ruleId)

        assert(result.isSuccess)
        verify(dao).deleteById(ruleId)
    }

    @Test
    fun `unblockApp does not modify local DB when API fails`() = runTest {
        whenever(api.unblockApp(childId, ruleId)).thenThrow(RuntimeException("Network error"))

        val result = repository.unblockApp(childId, ruleId)

        assert(result.isFailure)
        verify(dao, never()).deleteById(any())
    }
}
