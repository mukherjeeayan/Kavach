package com.safeguard.parentalcontrol.repository.onboarding

import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.ParentPinStore
import com.safeguard.parentalcontrol.data.local.TokenStore
import com.safeguard.parentalcontrol.data.remote.api.AuthApi
import com.safeguard.parentalcontrol.data.remote.dto.ApiResponse
import com.safeguard.parentalcontrol.data.remote.dto.ChildDto
import com.safeguard.parentalcontrol.data.remote.dto.CreateChildRequest
import com.safeguard.parentalcontrol.data.remote.dto.CreateChildResponse
import com.safeguard.parentalcontrol.data.remote.dto.DeviceDto
import com.safeguard.parentalcontrol.data.remote.dto.ChildrenListResponse
import com.safeguard.parentalcontrol.data.remote.dto.LoginRequest
import com.safeguard.parentalcontrol.data.remote.dto.LoginResponse
import com.safeguard.parentalcontrol.data.remote.dto.RegisterDeviceRequest
import com.safeguard.parentalcontrol.data.remote.dto.RegisterDeviceResponse
import com.safeguard.parentalcontrol.data.remote.dto.SetPinRequest
import com.safeguard.parentalcontrol.data.remote.dto.UserDto
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import retrofit2.Response

class OnboardingRepositoryImplTest {

    @Mock private lateinit var api: AuthApi
    @Mock private lateinit var tokenStore: TokenStore
    @Mock private lateinit var onboardingStore: OnboardingStore
    @Mock private lateinit var parentPinStore: ParentPinStore

    private lateinit var repository: OnboardingRepositoryImpl

    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        repository = OnboardingRepositoryImpl(api, tokenStore, onboardingStore, parentPinStore)
    }

    private fun <T> successBody(data: T): Response<ApiResponse<T>> =
        Response.success(ApiResponse(success = true, data = data, error = null, timestamp = null, request_id = null))

    private fun <T> errorResponse(code: Int, msg: String = "error"): Response<ApiResponse<T>> =
        Response.error(code, ResponseBody.create(null, """{"error":"$msg"}"""))

    // ── isOnboarded ─────────────────────────────────────────────

    @Test
    fun `isOnboarded delegates to store`() {
        whenever(onboardingStore.isOnboarded()).thenReturn(true)
        assertTrue(repository.isOnboarded())

        whenever(onboardingStore.isOnboarded()).thenReturn(false)
        assertFalse(repository.isOnboarded())
    }

    // ── login ───────────────────────────────────────────────────

    @Test
    fun `login stores tokens and returns user on success`() = runTest {
        val user = UserDto(id = "u1", name = "Test", email = "test@example.com")
        val loginResponse = LoginResponse(token = "access-123", refresh_token = "refresh-123", user = user, child = null)
        whenever(api.login(any())).thenReturn(successBody(loginResponse))

        val result = repository.login("test@example.com", "password123")

        assertTrue(result.isSuccess)
        assertEquals("test@example.com", result.getOrNull()!!.email)
        // Stores are mocked — verify the tokens were persisted.
        verify(tokenStore).token = "access-123"
        verify(tokenStore).refreshToken = "refresh-123"
    }

    @Test
    fun `login returns failure on bad credentials`() = runTest {
        whenever(api.login(any())).thenReturn(errorResponse(401, "Invalid credentials"))

        val result = repository.login("test@example.com", "wrongpass")

        assertTrue(result.isFailure)
    }

    @Test
    fun `login returns failure on network exception`() = runTest {
        whenever(api.login(any())).thenThrow(RuntimeException("offline"))

        val result = repository.login("test@example.com", "password123")

        assertTrue(result.isFailure)
    }

    // ── listChildren ────────────────────────────────────────────

    @Test
    fun `listChildren returns children on success`() = runTest {
        val children = listOf(ChildDto(id = "c1", name = "Kid", birth_date = "2015-01-01"))
        val response = ChildrenListResponse(children = children)
        whenever(api.listChildren()).thenReturn(successBody(response))

        val result = repository.listChildren()

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrNull()!!.size)
        assertEquals("Kid", result.getOrNull()!![0].name)
    }

    @Test
    fun `listChildren returns failure on error`() = runTest {
        whenever(api.listChildren()).thenReturn(errorResponse(500))

        val result = repository.listChildren()
        assertTrue(result.isFailure)
    }

    // ── createChild ─────────────────────────────────────────────

    @Test
    fun `createChild returns child on success`() = runTest {
        val child = ChildDto(id = "c2", name = "New Kid", birth_date = null)
        whenever(api.createChild(any())).thenReturn(successBody(CreateChildResponse(child = child)))

        val result = repository.createChild("New Kid")

        assertTrue(result.isSuccess)
        assertEquals("New Kid", result.getOrNull()!!.name)
    }

    @Test
    fun `createChild returns failure on error`() = runTest {
        whenever(api.createChild(any())).thenReturn(errorResponse(400))

        val result = repository.createChild("Bad")
        assertTrue(result.isFailure)
    }

    // ── registerDevice ──────────────────────────────────────────

    @Test
    fun `registerDevice stores device info and returns device`() = runTest {
        val child = ChildDto(id = "c1", name = "Kid", birth_date = null)
        val device = DeviceDto(device_id = "d1", child_id = "c1", device_name = "Pixel", device_type = "android", os_version = "15")
        whenever(api.registerDevice(any())).thenReturn(successBody(RegisterDeviceResponse(device = device)))

        val result = repository.registerDevice(child, "Pixel")

        assertTrue(result.isSuccess)
        verify(onboardingStore).deviceId = "d1"
        verify(onboardingStore).childId = "c1"
    }

    @Test
    fun `registerDevice returns failure on error`() = runTest {
        val child = ChildDto(id = "c1", name = "Kid", birth_date = null)
        whenever(api.registerDevice(any())).thenReturn(errorResponse(403))

        val result = repository.registerDevice(child, "Pixel")
        assertTrue(result.isFailure)
    }

    // ── setParentPin ────────────────────────────────────────────

    @Test
    fun `setParentPin stores local pin and syncs to server`() = runTest {
        whenever(parentPinStore.setPin("1234")).thenReturn(true)
        whenever(api.setPin(any())).thenReturn(successBody(Unit))

        val result = repository.setParentPin("1234")

        assertTrue(result.isSuccess)
        verify(parentPinStore).setPin("1234")
    }

    @Test
    fun `setParentPin returns failure for invalid pin format`() = runTest {
        whenever(parentPinStore.setPin("abc")).thenReturn(false)

        val result = repository.setParentPin("abc")
        assertTrue(result.isFailure)
    }

    @Test
    fun `setParentPin succeeds even if server call fails (local digest kept)`() = runTest {
        whenever(parentPinStore.setPin("1234")).thenReturn(true)
        whenever(api.setPin(any())).thenThrow(RuntimeException("offline"))

        val result = repository.setParentPin("1234")

        assertTrue(result.isSuccess)
        verify(parentPinStore).setPin("1234")
    }

    // ── logout ──────────────────────────────────────────────────

    @Test
    fun `logout clears all stores`() {
        repository.logout()

        verify(tokenStore).clear()
        verify(onboardingStore).clear()
        verify(parentPinStore).clear()
    }
}
