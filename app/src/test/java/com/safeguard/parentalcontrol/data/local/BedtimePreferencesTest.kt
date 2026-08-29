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
import java.time.LocalTime

class BedtimePreferencesTest {

    @Mock private lateinit var context: Context
    @Mock private lateinit var sharedPrefs: SharedPreferences
    @Mock private lateinit var editor: SharedPreferences.Editor

    private lateinit var preferences: BedtimePreferences

    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        `when`(context.getSharedPreferences(BedtimePreferences.PREFS_NAME, Context.MODE_PRIVATE))
            .thenReturn(sharedPrefs)
        `when`(sharedPrefs.edit()).thenReturn(editor)
        `when`(editor.putBoolean(anyString(), org.mockito.ArgumentMatchers.anyBoolean()))
            .thenReturn(editor)
        `when`(editor.putString(anyString(), anyString())).thenReturn(editor)
        preferences = BedtimePreferences(context)
    }

    @Test
    fun `default values are returned when no value is stored`() {
        `when`(sharedPrefs.getBoolean(BedtimePreferences.KEY_ENABLED, false)).thenReturn(false)
        `when`(sharedPrefs.getBoolean(BedtimePreferences.KEY_DND_ENABLED, false)).thenReturn(false)
        `when`(sharedPrefs.getString(BedtimePreferences.KEY_BEDTIME_START, null)).thenReturn(null)
        `when`(sharedPrefs.getString(BedtimePreferences.KEY_BEDTIME_END, null)).thenReturn(null)

        assertFalse(preferences.enabled)
        assertFalse(preferences.dndEnabled)
        assertEquals(BedtimePreferences.DEFAULT_START, preferences.bedtimeStart)
        assertEquals(BedtimePreferences.DEFAULT_END, preferences.bedtimeEnd)
        assertEquals(LocalTime.of(21, 0), BedtimePreferences.DEFAULT_START)
        assertEquals(LocalTime.of(7, 0), BedtimePreferences.DEFAULT_END)
    }

    @Test
    fun `enabled flag is persisted to SharedPreferences`() {
        preferences.enabled = true

        org.mockito.Mockito.verify(editor).putBoolean(BedtimePreferences.KEY_ENABLED, true)
    }

    @Test
    fun `bedtime start is stored as HH colon MM string`() {
        preferences.bedtimeStart = LocalTime.of(22, 30)

        org.mockito.Mockito.verify(editor).putString(
            BedtimePreferences.KEY_BEDTIME_START,
            "22:30"
        )
    }

    @Test
    fun `bedtime end is stored as HH colon MM string`() {
        preferences.bedtimeEnd = LocalTime.of(6, 45)

        org.mockito.Mockito.verify(editor).putString(
            BedtimePreferences.KEY_BEDTIME_END,
            "06:45"
        )
    }

    @Test
    fun `dnd enabled is persisted to SharedPreferences`() {
        preferences.dndEnabled = true

        org.mockito.Mockito.verify(editor).putBoolean(BedtimePreferences.KEY_DND_ENABLED, true)
    }

    @Test
    fun `stored time strings are parsed back into LocalTime`() {
        `when`(sharedPrefs.getString(BedtimePreferences.KEY_BEDTIME_START, null))
            .thenReturn("20:15")
        `when`(sharedPrefs.getString(BedtimePreferences.KEY_BEDTIME_END, null))
            .thenReturn("06:30")

        assertEquals(LocalTime.of(20, 15), preferences.bedtimeStart)
        assertEquals(LocalTime.of(6, 30), preferences.bedtimeEnd)
    }

    @Test
    fun `malformed time string falls back to default`() {
        `when`(sharedPrefs.getString(BedtimePreferences.KEY_BEDTIME_START, null))
            .thenReturn("not-a-time")

        assertEquals(BedtimePreferences.DEFAULT_START, preferences.bedtimeStart)
    }

    @Test
    fun `out of range time string falls back to default`() {
        `when`(sharedPrefs.getString(BedtimePreferences.KEY_BEDTIME_END, null))
            .thenReturn("25:99")

        assertEquals(BedtimePreferences.DEFAULT_END, preferences.bedtimeEnd)
    }

    @Test
    fun `enabled flag reads the stored boolean`() {
        `when`(sharedPrefs.getBoolean(BedtimePreferences.KEY_ENABLED, false)).thenReturn(true)

        assertTrue(preferences.enabled)
    }

    @Test
    fun `type safe accessors round trip the time values`() {
        // First read returns "no value stored", defaults are returned.
        `when`(sharedPrefs.getString(BedtimePreferences.KEY_BEDTIME_START, null)).thenReturn(null)
        `when`(sharedPrefs.getString(BedtimePreferences.KEY_BEDTIME_END, null)).thenReturn(null)
        assertEquals(BedtimePreferences.DEFAULT_START, preferences.bedtimeStart)

        // Write a new value -> the in-memory mock receives putString.
        val newStart = LocalTime.of(23, 0)
        preferences.bedtimeStart = newStart
        org.mockito.Mockito.verify(editor).putString(
            BedtimePreferences.KEY_BEDTIME_START,
            "23:00"
        )
    }
}
