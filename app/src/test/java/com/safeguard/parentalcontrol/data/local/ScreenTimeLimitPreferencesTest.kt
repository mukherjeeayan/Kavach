package com.safeguard.parentalcontrol.data.local

import android.content.Context
import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.ArgumentMatchers.anyString
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations

class ScreenTimeLimitPreferencesTest {

    @Mock private lateinit var context: Context
    @Mock private lateinit var sharedPrefs: SharedPreferences
    @Mock private lateinit var editor: SharedPreferences.Editor

    private lateinit var preferences: ScreenTimeLimitPreferences

    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        `when`(context.getSharedPreferences(ScreenTimeLimitPreferences.PREFS_NAME, Context.MODE_PRIVATE))
            .thenReturn(sharedPrefs)
        `when`(sharedPrefs.edit()).thenReturn(editor)
        `when`(editor.putBoolean(anyString(), org.mockito.ArgumentMatchers.anyBoolean()))
            .thenReturn(editor)
        `when`(editor.putInt(anyString(), anyInt())).thenReturn(editor)
        preferences = ScreenTimeLimitPreferences(context)
    }

    @Test
    fun `default daily limit is 120 minutes`() {
        `when`(
            sharedPrefs.getInt(
                ScreenTimeLimitPreferences.KEY_DAILY_LIMIT,
                ScreenTimeLimitPreferences.DEFAULT_DAILY_LIMIT_MINUTES
            )
        ).thenReturn(ScreenTimeLimitPreferences.DEFAULT_DAILY_LIMIT_MINUTES)
        `when`(sharedPrefs.getBoolean(ScreenTimeLimitPreferences.KEY_ENABLED, false))
            .thenReturn(false)

        assertEquals(120, preferences.dailyLimitMinutes)
        assertEquals(120, ScreenTimeLimitPreferences.DEFAULT_DAILY_LIMIT_MINUTES)
        assertFalse(preferences.enabled)
    }

    @Test
    fun `enabled flag is persisted when set to true`() {
        preferences.enabled = true

        org.mockito.Mockito.verify(editor).putBoolean(
            ScreenTimeLimitPreferences.KEY_ENABLED,
            true
        )
    }

    @Test
    fun `enabled flag reads back the stored boolean`() {
        `when`(sharedPrefs.getBoolean(ScreenTimeLimitPreferences.KEY_ENABLED, false))
            .thenReturn(true)

        assertTrue(preferences.enabled)
    }

    @Test
    fun `daily limit is read from SharedPreferences when present`() {
        `when`(
            sharedPrefs.getInt(
                ScreenTimeLimitPreferences.KEY_DAILY_LIMIT,
                ScreenTimeLimitPreferences.DEFAULT_DAILY_LIMIT_MINUTES
            )
        ).thenReturn(180)

        assertEquals(180, preferences.dailyLimitMinutes)
    }

    @Test
    fun `daily limit is clamped to minimum on read`() {
        `when`(
            sharedPrefs.getInt(
                ScreenTimeLimitPreferences.KEY_DAILY_LIMIT,
                ScreenTimeLimitPreferences.DEFAULT_DAILY_LIMIT_MINUTES
            )
        ).thenReturn(0)

        assertEquals(ScreenTimeLimitPreferences.MIN_LIMIT_MINUTES, preferences.dailyLimitMinutes)
    }

    @Test
    fun `daily limit is clamped to maximum on read`() {
        `when`(
            sharedPrefs.getInt(
                ScreenTimeLimitPreferences.KEY_DAILY_LIMIT,
                ScreenTimeLimitPreferences.DEFAULT_DAILY_LIMIT_MINUTES
            )
        ).thenReturn(99_999)

        assertEquals(ScreenTimeLimitPreferences.MAX_LIMIT_MINUTES, preferences.dailyLimitMinutes)
    }

    @Test
    fun `daily limit is clamped when written above maximum`() {
        preferences.dailyLimitMinutes = 10_000

        org.mockito.Mockito.verify(editor).putInt(
            ScreenTimeLimitPreferences.KEY_DAILY_LIMIT,
            ScreenTimeLimitPreferences.MAX_LIMIT_MINUTES
        )
    }

    @Test
    fun `daily limit is clamped when written below minimum`() {
        preferences.dailyLimitMinutes = 1

        org.mockito.Mockito.verify(editor).putInt(
            ScreenTimeLimitPreferences.KEY_DAILY_LIMIT,
            ScreenTimeLimitPreferences.MIN_LIMIT_MINUTES
        )
    }

    @Test
    fun `daily limit within range is written verbatim`() {
        preferences.dailyLimitMinutes = 90

        org.mockito.Mockito.verify(editor).putInt(
            ScreenTimeLimitPreferences.KEY_DAILY_LIMIT,
            90
        )
    }

    @Test
    fun `enable toggle round trip`() {
        `when`(sharedPrefs.getBoolean(ScreenTimeLimitPreferences.KEY_ENABLED, false))
            .thenReturn(false)

        // Disabled by default
        assertFalse(preferences.enabled)

        // Toggle on
        preferences.enabled = true
        org.mockito.Mockito.verify(editor).putBoolean(
            ScreenTimeLimitPreferences.KEY_ENABLED,
            true
        )

        // Now stub the next read to return true
        `when`(sharedPrefs.getBoolean(ScreenTimeLimitPreferences.KEY_ENABLED, false))
            .thenReturn(true)
        assertTrue(preferences.enabled)
    }
}
