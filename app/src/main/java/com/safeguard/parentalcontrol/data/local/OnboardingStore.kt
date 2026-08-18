package com.safeguard.parentalcontrol.data.local

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Lightweight (non-secret) store for the onboarding result: the real
 * device_id and child_id returned by the backend during registration.
 * These replace the placeholder IDs used before onboarding existed.
 *
 * Token material lives in [TokenStore]; this file holds only identifiers
 * that are sent to the backend with every request anyway.
 */
@Singleton
class OnboardingStore @Inject constructor(@ApplicationContext context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("safeguard_onboarding", Context.MODE_PRIVATE)

    var deviceId: String?
        get() = prefs.getString(KEY_DEVICE_ID, null)
        set(value) {
            prefs.edit().putString(KEY_DEVICE_ID, value).apply()
        }

    var childId: String?
        get() = prefs.getString(KEY_CHILD_ID, null)
        set(value) {
            prefs.edit().putString(KEY_CHILD_ID, value).apply()
        }

    var childName: String?
        get() = prefs.getString(KEY_CHILD_NAME, null)
        set(value) {
            prefs.edit().putString(KEY_CHILD_NAME, value).apply()
        }

    var deviceName: String?
        get() = prefs.getString(KEY_DEVICE_NAME, null)
        set(value) {
            prefs.edit().putString(KEY_DEVICE_NAME, value).apply()
        }

    /** True once the device has registered with a real device_id + child_id. */
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

        /**
         * Context-based check for non-injectable call sites
         * (e.g. BroadcastReceiver).
         */
        fun hasCompleted(context: Context): Boolean {
            val prefs = context.getSharedPreferences(
                "safeguard_onboarding",
                Context.MODE_PRIVATE
            )
            return !prefs.getString(KEY_DEVICE_ID, null).isNullOrEmpty() &&
                    !prefs.getString(KEY_CHILD_ID, null).isNullOrEmpty()
        }
    }
}