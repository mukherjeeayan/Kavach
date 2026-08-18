package com.safeguard.parentalcontrol.data.remote.dto

/**
 * DTOs for the auth + onboarding endpoints
 * (POST /auth/login, POST /auth/refresh-token, GET /children,
 *  POST /children, POST /devices/register).
 * Field names use snake_case to match the JSON contract.
 */

data class LoginRequest(
    val email: String,
    val password: String
)

data class UserDto(
    val id: String,
    val email: String,
    val name: String
)

data class ChildDto(
    val id: String,
    val name: String,
    val birth_date: String? = null
)

data class LoginResponse(
    val token: String,
    val refresh_token: String,
    val user: UserDto,
    val child: ChildDto?
)

data class RefreshTokenRequest(
    val refresh_token: String
)

data class RefreshTokenResponse(
    val token: String,
    val refresh_token: String
)

data class ChildrenListResponse(
    val children: List<ChildDto>
)

data class CreateChildRequest(
    val name: String,
    val birth_date: String? = null
)

data class CreateChildResponse(
    val child: ChildDto
)

data class RegisterDeviceRequest(
    val child_id: String,
    val device_id: String? = null,
    val device_name: String,
    val device_type: String = "android",
    val os_version: String? = null
)

data class DeviceDto(
    val device_id: String,
    val child_id: String,
    val device_name: String,
    val device_type: String,
    val os_version: String? = null
)

data class RegisterDeviceResponse(
    val device: DeviceDto
)