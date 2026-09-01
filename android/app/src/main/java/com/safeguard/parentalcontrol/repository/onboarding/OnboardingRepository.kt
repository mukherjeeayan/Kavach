package com.safeguard.parentalcontrol.repository.onboarding

import com.safeguard.parentalcontrol.data.remote.dto.ChildDto
import com.safeguard.parentalcontrol.data.remote.dto.DeviceDto
import com.safeguard.parentalcontrol.data.remote.dto.UserDto

/**
 * Repository interface for the parent-onboarding flow: login, child
 * selection/creation, device registration, and session teardown.
 * Defined as an interface so the implementation can be swapped for
 * testing (mandatory per the Android skill — interface + impl).
 */
interface OnboardingRepository {

    /** True once the device has a real device_id + child_id. */
    fun isOnboarded(): Boolean

    /** Authenticate the parent and store the session (token pair). */
    suspend fun login(email: String, password: String): Result<UserDto>

    /** List the parent's existing child profiles. */
    suspend fun listChildren(): Result<List<ChildDto>>

    /** Create a child profile for the authenticated parent. */
    suspend fun createChild(name: String, birthDate: String? = null): Result<ChildDto>

    /**
     * Register (or refresh) this device for the given child and persist
     * the real device_id + child_id locally.
     */
    suspend fun registerDevice(
        child: ChildDto,
        deviceName: String
    ): Result<DeviceDto>

    /**
     * Set (or rotate) the parental unlock PIN. Always stores the local
     * salted digest; the server hash is updated best-effort.
     */
    suspend fun setParentPin(pin: String): Result<Unit>

    /** Updates the child user's phone number on the server. */
    suspend fun updateChildPhone(childId: String, phoneNumber: String): Result<Unit>

    /** Clear the local session and onboarding state. */
    fun logout()
}