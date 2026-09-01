package com.safeguard.parentalcontrol.viewmodel.settings

import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.ParentPinStore
import com.safeguard.parentalcontrol.data.local.TokenStore
import com.safeguard.parentalcontrol.repository.onboarding.OnboardingRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import android.content.Context

@OptIn(ExperimentalCoroutinesApi::class)
class ChangePinValidationTest {

    @Mock private lateinit var context: Context
    @Mock private lateinit var onboardingRepository: OnboardingRepository
    @Mock private lateinit var tokenStore: TokenStore
    @Mock private lateinit var onboardingStore: OnboardingStore
    @Mock private lateinit var parentPinStore: ParentPinStore

    @Mock private lateinit var dpm: android.app.admin.DevicePolicyManager
    @Mock private lateinit var pm: android.content.pm.PackageManager

    private val dispatcher = UnconfinedTestDispatcher()

    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(dispatcher)
        whenever(onboardingStore.childName).thenReturn(null)
        whenever(tokenStore.parentName).thenReturn(null)
        whenever(context.getSystemService(Context.DEVICE_POLICY_SERVICE)).thenReturn(dpm)
        whenever(dpm.isAdminActive(any())).thenReturn(false)
        whenever(context.packageManager).thenReturn(pm)
        whenever(pm.getPackageInfo(any<String>(), any<Int>())).thenReturn(android.content.pm.PackageInfo())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun newViewModel() = SettingsViewModel(
        context = context,
        onboardingRepository = onboardingRepository,
        tokenStore = tokenStore,
        onboardingStore = onboardingStore,
        parentPinStore = parentPinStore
    )

    @Test
    fun `new PIN shorter than 6 digits is rejected`() = runTest(dispatcher) {
        whenever(parentPinStore.hasPin()).thenReturn(true)
        whenever(parentPinStore.verifyPin("123456")).thenReturn(true)
        whenever(onboardingRepository.setParentPin(any())).thenReturn(Result.success(Unit))

        val viewModel = newViewModel()
        viewModel.changePin(currentPin = "123456", newPin = "12345")

        val event = viewModel.events.value
        assertTrue("Expected Error event, got $event", event is SettingsEvent.Error)
        assertTrue((event as SettingsEvent.Error).message.contains("PIN", ignoreCase = true))
    }

    @Test
    fun `new PIN longer than 16 digits is rejected`() = runTest(dispatcher) {
        whenever(parentPinStore.hasPin()).thenReturn(true)
        whenever(parentPinStore.verifyPin("123456")).thenReturn(true)

        val viewModel = newViewModel()
        viewModel.changePin(currentPin = "123456", newPin = "12345678901234567")

        val event = viewModel.events.value
        assertTrue(event is SettingsEvent.Error)
    }

    @Test
    fun `new PIN of 6 digits is accepted when current PIN is correct`() = runTest(dispatcher) {
        whenever(parentPinStore.hasPin()).thenReturn(true)
        whenever(parentPinStore.verifyPin("654321")).thenReturn(true)
        whenever(onboardingRepository.setParentPin(eq("111111"))).thenReturn(Result.success(Unit))

        val viewModel = newViewModel()
        viewModel.changePin(currentPin = "654321", newPin = "111111")

        val event = viewModel.events.value
        assertTrue("Expected PinChanged event, got $event", event is SettingsEvent.PinChanged)
    }

    @Test
    fun `new PIN of 16 digits is accepted when current PIN is correct`() = runTest(dispatcher) {
        whenever(parentPinStore.hasPin()).thenReturn(true)
        whenever(parentPinStore.verifyPin("654321")).thenReturn(true)
        whenever(onboardingRepository.setParentPin(any())).thenReturn(Result.success(Unit))

        val viewModel = newViewModel()
        viewModel.changePin(
            currentPin = "654321",
            newPin = "1234567890123456"
        )

        val event = viewModel.events.value
        assertTrue(event is SettingsEvent.PinChanged)
    }

    @Test
    fun `incorrect current PIN is rejected with error`() = runTest(dispatcher) {
        whenever(parentPinStore.hasPin()).thenReturn(true)
        whenever(parentPinStore.verifyPin("000000")).thenReturn(false)

        val viewModel = newViewModel()
        viewModel.changePin(currentPin = "000000", newPin = "111111")

        val event = viewModel.events.value
        assertTrue("Expected Error event, got $event", event is SettingsEvent.Error)
        assertTrue((event as SettingsEvent.Error).message.contains("incorrect", ignoreCase = true))
    }

    @Test
    fun `change is rejected when no PIN has been set yet`() = runTest(dispatcher) {
        whenever(parentPinStore.hasPin()).thenReturn(false)

        val viewModel = newViewModel()
        viewModel.changePin(currentPin = "123456", newPin = "654321")

        val event = viewModel.events.value
        assertTrue(event is SettingsEvent.Error)
        assertTrue(
            (event as SettingsEvent.Error).message.contains("No PIN", ignoreCase = true)
        )
    }

    @Test
    fun `failed setParentPin surfaces the error message`() = runTest(dispatcher) {
        whenever(parentPinStore.hasPin()).thenReturn(true)
        whenever(parentPinStore.verifyPin("123456")).thenReturn(true)
        whenever(onboardingRepository.setParentPin(any()))
            .thenReturn(Result.failure(RuntimeException("server rejected")))

        val viewModel = newViewModel()
        viewModel.changePin(currentPin = "123456", newPin = "654321")

        val event = viewModel.events.value
        assertTrue("Expected Error event, got $event", event is SettingsEvent.Error)
        val message = (event as SettingsEvent.Error).message
        assertTrue(message.contains("server rejected"))
    }

    @Test
    fun `loading flag is reset after a successful PIN change`() = runTest(dispatcher) {
        whenever(parentPinStore.hasPin()).thenReturn(true)
        whenever(parentPinStore.verifyPin("123456")).thenReturn(true)
        whenever(onboardingRepository.setParentPin(any())).thenReturn(Result.success(Unit))

        val viewModel = newViewModel()
        viewModel.changePin(currentPin = "123456", newPin = "654321")

        assertEquals(false, viewModel.uiState.value.isLoading)
    }
}
