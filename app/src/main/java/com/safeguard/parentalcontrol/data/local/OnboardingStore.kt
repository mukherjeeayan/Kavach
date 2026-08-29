package com.safeguard.parentalcontrol.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OnboardingStore @Inject constructor(@ApplicationContext context: Context) {

    @Inject
    lateinit var masterKey: MasterKey

    private val prefs: SharedPreferences by lazy {
        try {
            EncryptedSharedPreferences.create(
                context,
                "safeguard_onboarding_encrypted",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            throw RuntimeException("Failed to initialize encrypted storage. App cannot continue.", e)
        }
    }

    var deviceId: String?
        get() = prefs.getString(KEY_DEVICE_ID, null)
        set(value) { prefs.edit().putString(KEY_DEVICE_ID, value).apply() }

    var childId: String?
        get() = prefs.getString(KEY_CHILD_ID, null)
        set(value) { prefs.edit().putString(KEY_CHILD_ID, value).apply() }

    var childName: String?
        get() = prefs.getString(KEY_CHILD_NAME, null)
        set(value) { prefs.edit().putString(KEY_CHILD_NAME, value).apply() }

    var deviceName: String?
        get() = prefs.getString(KEY_DEVICE_NAME, null)
        set(value) { prefs.edit().putString(KEY_DEVICE_NAME, value).apply() }

    fun isOnboarded(): Boolean =
        !deviceId.isNullOrEmpty() && !childId.isNullOrEmpty()

    fun clear() {
        prefs.edit()
            .remove(KEY_DEVICE_ID)
            .remove(KEY_CHILD_ID)
            .remove(KEY_CHILD_NAME)
            .remove(KEY_DEVICE_NAME)
            .apply()
    }

    companion object {
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_CHILD_ID = "child_id"
        private const val KEY_CHILD_NAME = "child_name"
        private const val KEY_DEVICE_NAME = "device_name"
    }
}
