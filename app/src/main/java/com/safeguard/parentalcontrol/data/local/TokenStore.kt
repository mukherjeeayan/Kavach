package com.safeguard.parentalcontrol.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Secure storage for the JWT using EncryptedSharedPreferences
 * (the security-crypto library already declared in build.gradle.kts).
 */
@Singleton
open class TokenStore @Inject constructor(@ApplicationContext context: Context) {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "safeguard_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_TOKEN, value).apply()
        }

    var refreshToken: String?
        get() = prefs.getString(KEY_REFRESH_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_REFRESH_TOKEN, value).apply()
        }

    var parentName: String?
        get() = prefs.getString(KEY_PARENT_NAME, null)
        set(value) {
            prefs.edit().putString(KEY_PARENT_NAME, value).apply()
        }

    fun clear() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_PARENT_NAME)
            .apply()
    }

    companion object {
        private const val KEY_TOKEN = "jwt_token"
        private const val KEY_REFRESH_TOKEN = "jwt_refresh_token"
        private const val KEY_PARENT_NAME = "parent_name"
    }
}
