package com.safeguard.parentalcontrol.ui.screens.parentlock

import android.content.Context
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ApplicationProvider
import com.safeguard.parentalcontrol.data.local.ParentPinStore
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Compose instrumentation tests for the parental PIN gate. The gate is
 * the child's last line of defence before the control dashboard — a
 * correct PIN must unlock, a wrong PIN must show an error and never
 * unlock.
 */
class ParentLockScreenTest {

    @get:Rule
    val composeRule = createComposeRule()

    private fun newPinStore(): ParentPinStore =
        ParentPinStore(ApplicationProvider.getApplicationContext<Context>())

    @Test
    fun correctPinUnlocks() {
        val pinStore = newPinStore()
        pinStore.setPin("1234")
        var unlocked = false

        composeRule.setContent {
            ParentLockScreen(pinStore = pinStore, onUnlocked = { unlocked = true })
        }

        composeRule.onNodeWithText("Parent PIN").performTextInput("1234")
        composeRule.onNodeWithText("Unlock").performClick()
        composeRule.waitForIdle()

        assertTrue(unlocked)
    }

    @Test
    fun wrongPinShowsErrorAndDoesNotUnlock() {
        val pinStore = newPinStore()
        pinStore.setPin("1234")
        var unlocked = false

        composeRule.setContent {
            ParentLockScreen(pinStore = pinStore, onUnlocked = { unlocked = true })
        }

        composeRule.onNodeWithText("Parent PIN").performTextInput("9999")
        composeRule.onNodeWithText("Unlock").performClick()
        composeRule.waitForIdle()

        composeRule.onNodeWithText("Incorrect PIN").assertExists()
        assertFalse(unlocked)
    }
}