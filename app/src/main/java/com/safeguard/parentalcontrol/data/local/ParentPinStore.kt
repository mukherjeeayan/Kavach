package com.safeguard.parentalcontrol.data.local

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.MessageDigest
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Local store for the parental unlock PIN.
 *
 * Security posture:
 * - The PIN is never stored in plaintext — only a salted SHA-256
 *   digest (salt stored alongside, 256-bit random per install).
 * - Stored in EncryptedSharedPreferences (AES-256-GCM) so the digest
 *   is additionally protected at rest.
 * - Verification is fully offline-capable; the backend keeps its own
 *   bcrypt hash for the web dashboard (set via PUT /auth/pin).
 * - Brute-force protection: exponential backoff after failed attempts.
 */
@Singleton
open class ParentPinStore @Inject constructor(@ApplicationContext context: Context) {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "safeguard_pin_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun hasPin(): Boolean {
        return !prefs.getString(KEY_SALT, null).isNullOrEmpty() &&
            !prefs.getString(KEY_HASH, null).isNullOrEmpty()
    }

    /** Stores a salted digest of the PIN. Returns false if the input is invalid. */
    fun setPin(pin: String): Boolean {
        val trimmed = pin.trim()
        if (trimmed.length !in MIN_PIN_LENGTH..MAX_PIN_LENGTH) {
            return false
        }
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val saltHex = salt.toHex()
        prefs.edit()
            .putString(KEY_SALT, saltHex)
            .putString(KEY_HASH, sha256(saltHex + trimmed))
            .putInt(KEY_FAILED_ATTEMPTS, 0)
            .remove(KEY_LOCKOUT_UNTIL)
            .apply()
        Log.i(TAG, "Parent PIN set (digest only, never the raw PIN)")
        return true
    }

    fun verifyPin(pin: String): Boolean {
        // Check lockout first
        val lockoutUntil = prefs.getLong(KEY_LOCKOUT_UNTIL, 0)
        if (lockoutUntil > System.currentTimeMillis()) {
            Log.w(TAG, "PIN verification locked out until $lockoutUntil")
            return false
        }
        
        val salt = prefs.getString(KEY_SALT, null) ?: return false
        val expected = prefs.getString(KEY_HASH, null) ?: return false
        val valid = sha256(salt + pin.trim()).contentEquals(expected)
        
        if (valid) {
            // Reset attempts on success
            prefs.edit()
                .putInt(KEY_FAILED_ATTEMPTS, 0)
                .remove(KEY_LOCKOUT_UNTIL)
                .apply()
        } else {
            // Increment attempts and apply backoff
            val attempts = prefs.getInt(KEY_FAILED_ATTEMPTS, 0) + 1
            prefs.edit().putInt(KEY_FAILED_ATTEMPTS, attempts).apply()
            
            if (attempts >= MAX_ATTEMPTS) {
                // Apply exponential backoff: 30s, 60s, 120s, etc.
                val backoffMs = minOf(
                    30_000L * (1L shl (attempts - MAX_ATTEMPTS).coerceAtMost(5)),
                    MAX_LOCKOUT_MS
                )
                prefs.edit().putLong(KEY_LOCKOUT_UNTIL, System.currentTimeMillis() + backoffMs).apply()
                Log.w(TAG, "PIN locked out for ${backoffMs / 1000}s after $attempts failed attempts")
            }
        }
        
        return valid
    }

    /** Removes the local digest (e.g. on sign-out). */
    fun clear() {
        prefs.edit()
            .remove(KEY_SALT)
            .remove(KEY_HASH)
            .remove(KEY_FAILED_ATTEMPTS)
            .remove(KEY_LOCKOUT_UNTIL)
            .apply()
    }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return digest.toHex()
    }

    private fun ByteArray.toHex(): String =
        joinToString("") { "%02x".format(it) }

    companion object {
        private const val TAG = "ParentPinStore"
        private const val KEY_SALT = "pin_salt"
        private const val KEY_HASH = "pin_hash"
        private const val KEY_FAILED_ATTEMPTS = "failed_attempts"
        private const val KEY_LOCKOUT_UNTIL = "lockout_until"
        private const val MIN_PIN_LENGTH = 4
        private const val MAX_PIN_LENGTH = 6
        private const val MAX_ATTEMPTS = 5
        private const val MAX_LOCKOUT_MS = 30 * 60 * 1000L // 30 minutes max
    }
}
