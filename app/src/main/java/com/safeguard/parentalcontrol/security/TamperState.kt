package com.safeguard.parentalcontrol.security

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Shared tamper/lockdown state between the enforcement service and
 * the repository. When [lockdown] is active the repository refuses
 * to weaken the enforced policy (fail-closed hardening): cached
 * blocked apps stay blocked even if the server reports them unblocked.
 *
 * The flag is persisted to SharedPreferences so a force-stop, crash,
 * or reboot cannot be used to clear lockdown — it must be lifted
 * explicitly via [clear]. When no [Context] is available (plain unit
 * tests) the state degrades to in-memory only.
 */
@Singleton
class TamperState @Inject constructor(
    @ApplicationContext private val context: Context?
) {
    /** Test convenience: in-memory-only instance. */
    constructor() : this(null)

    private val prefs by lazy {
        try {
            context?.getSharedPreferences("safeguard_security", Context.MODE_PRIVATE)
        } catch (_: Exception) {
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
