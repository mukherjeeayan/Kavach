package com.safeguard.parentalcontrol.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Shared tamper/lockdown state between the enforcement service and
 * the repository. When [lockdown] is active the repository refuses
 * to weaken the enforced policy (fail-closed hardening): cached
 * blocked apps stay blocked even if the server reports them unblocked.
 *
 * The flag is persisted to EncryptedSharedPreferences so it cannot be
 * read or modified on rooted devices. It must be lifted explicitly
 * via [clear].
 */
@Singleton
class TamperState @Inject constructor(
    @ApplicationContext private val context: Context?
) {
    /** Test convenience: in-memory-only instance. */
    constructor() : this(null)

    private val prefs: SharedPreferences? by lazy {
        try {
            val masterKey = SecureMasterKey.build(context!!)
            EncryptedSharedPreferences.create(
                context,
                "safeguard_security_encrypted",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (_: Exception) {
            // SECURITY: Do NOT fall back to plain SharedPreferences.
            // If encryption fails, the lockdown state is in-memory only.
            // This prevents the most critical security state from being
            // readable/writable on rooted devices.
            android.util.Log.e("TamperState", "EncryptedSharedPreferences failed — lockdown state is memory-only")
            null
        }
    }

    @Volatile
    var lockdown: Boolean = prefs?.getBoolean(KEY_LOCKDOWN, false) ?: false
        set(value) {
            field = value
            try {
                prefs?.edit()?.putBoolean(KEY_LOCKDOWN, value)?.apply()
            } catch (_: Exception) {
                // Persistence is best-effort; in-memory state still applies.
            }
        }

    fun clear() {
        lockdown = false
    }

    private companion object {
        const val KEY_LOCKDOWN = "tamper_lockdown"
    }
}
