package com.safeguard.parentalcontrol.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import androidx.security.crypto.EncryptedSharedPreferences
import com.safeguard.parentalcontrol.security.SecureMasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.LocalTime
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Type-safe accessor for the bedtime configuration stored in
 * SharedPreferences ("safeguard_bedtime"). Replaces the raw
 * getString/getBoolean calls previously sprinkled across the worker
 * and the new settings UI.
 */
@Singleton
class BedtimePreferences @Inject constructor(
    @ApplicationContext context: Context
) {
    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        SecureMasterKey.build(context),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    var enabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, false)
        set(value) = prefs.edit { putBoolean(KEY_ENABLED, value) }

    var bedtimeStart: LocalTime
        get() = readTime(KEY_BEDTIME_START) ?: DEFAULT_START
        set(value) = prefs.edit { putString(KEY_BEDTIME_START, formatTime(value)) }

    var bedtimeEnd: LocalTime
        get() = readTime(KEY_BEDTIME_END) ?: DEFAULT_END
        set(value) = prefs.edit { putString(KEY_BEDTIME_END, formatTime(value)) }

    var dndEnabled: Boolean
        get() = prefs.getBoolean(KEY_DND_ENABLED, false)
        set(value) = prefs.edit { putBoolean(KEY_DND_ENABLED, value) }

    private fun readTime(key: String): LocalTime? {
        val raw = prefs.getString(key, null) ?: return null
        return parseTime(raw)
    }

    private fun parseTime(hhmm: String): LocalTime? {
        val parts = hhmm.split(":")
        if (parts.size != 2) return null
        val h = parts[0].toIntOrNull() ?: return null
        val m = parts[1].toIntOrNull() ?: return null
        if (h !in 0..23 || m !in 0..59) return null
        return LocalTime.of(h, m)
    }

    private fun formatTime(time: LocalTime): String =
        "%02d:%02d".format(time.hour, time.minute)

    companion object {
        const val PREFS_NAME = "safeguard_bedtime"
        const val KEY_ENABLED = "bedtime_enabled"
        const val KEY_BEDTIME_START = "bedtime_start"
        const val KEY_BEDTIME_END = "bedtime_end"
        const val KEY_DND_ENABLED = "dnd_enabled"

        val DEFAULT_START: LocalTime = LocalTime.of(21, 0)
        val DEFAULT_END: LocalTime = LocalTime.of(7, 0)
    }
}

/**
 * Type-safe accessor for the overall daily screen-time limit
 * ("safeguard_screen_time_limits"). Previously read with raw
 * getInt() inside the OnlyWorkWorker.
 */
@Singleton
class ScreenTimeLimitPreferences @Inject constructor(
    @ApplicationContext context: Context
) {
    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        SecureMasterKey.build(context),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    var enabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, false)
        set(value) = prefs.edit { putBoolean(KEY_ENABLED, value) }

    var dailyLimitMinutes: Int
        get() = prefs.getInt(KEY_DAILY_LIMIT, DEFAULT_DAILY_LIMIT_MINUTES)
            .coerceIn(MIN_LIMIT_MINUTES, MAX_LIMIT_MINUTES)
        set(value) = prefs.edit {
            putInt(KEY_DAILY_LIMIT, value.coerceIn(MIN_LIMIT_MINUTES, MAX_LIMIT_MINUTES))
        }

    companion object {
        const val PREFS_NAME = "safeguard_screen_time_limits"
        const val KEY_ENABLED = "daily_limit_enabled"
        const val KEY_DAILY_LIMIT = "daily_limit_minutes"

        const val DEFAULT_DAILY_LIMIT_MINUTES = 120
        const val MIN_LIMIT_MINUTES = 15
        const val MAX_LIMIT_MINUTES = 24 * 60
    }
}
