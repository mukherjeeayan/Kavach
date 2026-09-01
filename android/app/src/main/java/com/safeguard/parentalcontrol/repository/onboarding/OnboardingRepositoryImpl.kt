package com.safeguard.parentalcontrol.repository.onboarding

import android.os.Build
import android.util.Log
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.ParentPinStore
import com.safeguard.parentalcontrol.data.local.TokenStore
import com.safeguard.parentalcontrol.data.remote.api.AuthApi
import com.safeguard.parentalcontrol.data.remote.dto.ApiResponse
import com.safeguard.parentalcontrol.data.remote.dto.ChildDto
import com.safeguard.parentalcontrol.data.remote.dto.CreateChildRequest
import com.safeguard.parentalcontrol.data.remote.dto.DeviceDto
import com.safeguard.parentalcontrol.data.remote.dto.LoginRequest
import com.safeguard.parentalcontrol.data.remote.dto.RegisterDeviceRequest
import com.safeguard.parentalcontrol.data.remote.dto.SetPinRequest
import com.safeguard.parentalcontrol.data.remote.dto.UpdatePhoneRequest
import com.safeguard.parentalcontrol.data.remote.dto.UserDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OnboardingRepositoryImpl @Inject constructor(
    private val api: AuthApi,
    private val tokenStore: TokenStore,
    private val onboardingStore: OnboardingStore,
    private val parentPinStore: ParentPinStore
) : OnboardingRepository {

    override fun isOnboarded(): Boolean = onboardingStore.isOnboarded()

    override suspend fun login(email: String, password: String): Result<UserDto> {
        return try {
            val response = api.login(LoginRequest(email = email.trim(), password = password))
            if (response.isSuccessful && response.body()?.data != null) {
                val session = response.body()!!.data!!
                tokenStore.token = session.token
                tokenStore.refreshToken = session.refresh_token
                tokenStore.parentName = session.user.name
                Log.i(TAG, "Logged in as ${session.user.email}")
                Result.success(session.user)
            } else {
                Result.failure(Exception(errorMessage(response)))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Login failed", e)
            Result.failure(e)
        }
    }

    override suspend fun listChildren(): Result<List<ChildDto>> {
        return try {
            val response = api.listChildren()
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!.children)
            } else {
                Result.failure(Exception(errorMessage(response)))
            }
        } catch (e: Exception) {
            Log.e(TAG, "listChildren failed", e)
            Result.failure(e)
        }
    }

    override suspend fun createChild(name: String, birthDate: String?): Result<ChildDto> {
        return try {
            val response = api.createChild(CreateChildRequest(name = name.trim(), birth_date = birthDate))
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!.child)
            } else {
                Result.failure(Exception(errorMessage(response)))
            }
        } catch (e: Exception) {
            Log.e(TAG, "createChild failed", e)
            Result.failure(e)
        }
    }

    override suspend fun registerDevice(child: ChildDto, deviceName: String): Result<DeviceDto> {
        return try {
            val response = api.registerDevice(
                RegisterDeviceRequest(
                    child_id = child.id,
                    device_id = onboardingStore.deviceId, // idempotent re-registration
                    device_name = deviceName.trim().ifEmpty { defaultDeviceName() },
                    os_version = Build.VERSION.RELEASE
                )
            )
            if (response.isSuccessful && response.body()?.data != null) {
                val device = response.body()!!.data!!.device
                onboardingStore.deviceId = device.device_id
                onboardingStore.childId = device.child_id
                onboardingStore.childName = child.name
                onboardingStore.deviceName = device.device_name
                Log.i(TAG, "Device registered: ${device.device_id} for child ${device.child_id}")
                Result.success(device)
            } else {
                Result.failure(Exception(errorMessage(response)))
            }
        } catch (e: Exception) {
            Log.e(TAG, "registerDevice failed", e)
            Result.failure(e)
        }
    }

    override suspend fun setParentPin(pin: String): Result<Unit> {
        // Local digest is the source of truth for offline unlocking —
        // store it even if the server call fails.
        if (!parentPinStore.setPin(pin)) {
            return Result.failure(IllegalArgumentException("PIN must be 4-6 digits"))
        }
        return try {
            val response = api.setPin(SetPinRequest(pin = pin.trim()))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Log.w(TAG, "Server PIN update failed (HTTP ${response.code()})")
                Result.success(Unit)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Server PIN update unavailable", e)
            Result.success(Unit)
        }
    }

    override fun logout() {
        tokenStore.clear()
        onboardingStore.clear()
        parentPinStore.clear()
        Log.i(TAG, "Session cleared")
    }

    override suspend fun updateChildPhone(childId: String, phoneNumber: String): Result<Unit> {
        return try {
            val response = api.updateChildPhone(childId, UpdatePhoneRequest(phone_number = phoneNumber))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Log.w(TAG, "Server phone update failed (HTTP ${response.code()})")
                Result.failure(Exception("Failed to update phone number"))
            }
        } catch (e: Exception) {
            Log.w(TAG, "Server phone update unavailable", e)
            Result.failure(e)
        }
    }

    private fun <T> errorMessage(response: retrofit2.Response<ApiResponse<T>>): String {
        val body = response.body()
        return if (body != null && body.error != null) {
            "Request failed: ${body.error}"
        } else {
            "Server error (HTTP ${response.code()})"
        }
    }

    private fun defaultDeviceName(): String = "Child's Device"

    companion object {
        private const val TAG = "OnboardingRepo"
    }
}