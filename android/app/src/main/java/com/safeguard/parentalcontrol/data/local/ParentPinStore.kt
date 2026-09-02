package com.safeguard.parentalcontrol.data.local

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ParentPinStore @Inject constructor(@ApplicationContext context: Context) {

    @Inject
    lateinit var masterKey: MasterKey

    private val prefs: SharedPreferences by lazy {
        try {
            EncryptedSharedPreferences.create(
                context,
                "safeguard_pin_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            throw RuntimeException("Failed to initialize encrypted storage. App cannot continue.", e)
        }
    }

    fun hasPin(): Boolean {
        return !prefs.getString(KEY_SALT, null).isNullOrEmpty() &&
            !prefs.getString(KEY_HASH, null).isNullOrEmpty()
    }

    fun setPin(pin: String): Boolean {
        val trimmed = pin.trim()
        if (trimmed.length !in MIN_PIN_LENGTH..MAX_PIN_LENGTH) {
            return false
        }
        val salt = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val saltHex = salt.toHex()
        prefs.edit()
            .putString(KEY_SALT, saltHex)
            .putString(KEY_HASH, pbkdf2(trimmed, salt))
            .putInt(KEY_FAILED_ATTEMPTS, 0)
            .remove(KEY_LOCKOUT_UNTIL)
            .apply()
        Log.i(TAG, "Parent PIN set (digest only, never the raw PIN)")
        return true
    }

    fun verifyPin(pin: String): Boolean {
        val lockoutUntil = prefs.getLong(KEY_LOCKOUT_UNTIL, 0)
        if (lockoutUntil > System.currentTimeMillis()) {
            Log.w(TAG, "PIN verification locked out until $lockoutUntil")
            return false
        }

        val saltHex = prefs.getString(KEY_SALT, null) ?: return false
        val expected = prefs.getString(KEY_HASH, null) ?: return false
        val salt = saltHex.hexToBytes()
        val valid = MessageDigest.isEqual(
            pbkdf2(pin.trim(), salt).toByteArray(Charsets.UTF_8),
            expected.toByteArray(Charsets.UTF_8)
        )

        if (valid) {
            prefs.edit()
                .putInt(KEY_FAILED_ATTEMPTS, 0)
                .remove(KEY_LOCKOUT_UNTIL)
                .apply()
        } else {
            val attempts = prefs.getInt(KEY_FAILED_ATTEMPTS, 0) + 1
            prefs.edit().putInt(KEY_FAILED_ATTEMPTS, attempts).apply()

            if (attempts >= MAX_ATTEMPTS) {
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

    fun clear() {
        prefs.edit()
            .remove(KEY_SALT)
            .remove(KEY_HASH)
            .remove(KEY_FAILED_ATTEMPTS)
            .remove(KEY_LOCKOUT_UNTIL)
            .apply()
    }

    private fun pbkdf2(password: String, salt: ByteArray): String {
        val spec = PBEKeySpec(password.toCharArray(), salt, PBKDF2_ITERATIONS, 256)
        val key = SecretKeyFactory.getInstance(PBKDF2_ALGORITHM).generateSecret(spec)
        return key.encoded.joinToString("") { "%02x".format(it) }
    }

    private fun ByteArray.toHex(): String =
        joinToString("") { "%02x".format(it) }

    private fun String.hexToBytes(): ByteArray =
        chunked(2).map { it.toInt(16).toByte() }.toByteArray()

    companion object {
        private const val TAG = "ParentPinStore"
        private const val KEY_SALT = "pin_salt"
        private const val KEY_HASH = "pin_hash"
        private const val KEY_FAILED_ATTEMPTS = "failed_attempts"
        private const val KEY_LOCKOUT_UNTIL = "lockout_until"
        private const val MIN_PIN_LENGTH = 6
        private const val MAX_PIN_LENGTH = 16
        private const val MAX_ATTEMPTS = 5
        private const val MAX_LOCKOUT_MS = 30 * 60 * 1000L
        private const val PBKDF2_ITERATIONS = 120_000
        private const val PBKDF2_ALGORITHM = "PBKDF2WithHmacSHA256"
    }
}
