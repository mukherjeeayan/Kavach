package com.safeguard.parentalcontrol.viewmodel.onboarding

import com.safeguard.parentalcontrol.data.remote.dto.ChildDto
import com.safeguard.parentalcontrol.data.remote.dto.DeviceDto
import com.safeguard.parentalcontrol.data.remote.dto.UserDto
import com.safeguard.parentalcontrol.repository.onboarding.OnboardingRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/**
 * Unit tests for OnboardingViewModel: the step machine must advance
 * only on repository success, surface errors otherwise, and never
 * leak state between sessions (logout).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingViewModelTest {

    @Mock
    private lateinit var repository: OnboardingRepository

    private val dispatcher = StandardTestDispatcher()
    private lateinit var viewModel: OnboardingViewModel

    private val user = UserDto(id = "parent-1", email = "p@example.com", name = "Parent")
    private val child = ChildDto(id = "child-1", name = "Kid", birth_date = "2015-01-01")
    private val device = DeviceDto(
        device_id = "device-1",
        child_id = "child-1",
        device_name = "Phone",
        device_type = "android"
    )

    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(dispatcher)
        viewModel = OnboardingViewModel(repository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `login success advances to child step and loads children`() = runTest(dispatcher) {
        whenever(repository.login("p@example.com", "pw")).thenReturn(Result.success(user))
        whenever(repository.listChildren()).thenReturn(Result.success(listOf(child)))

        viewModel.login("p@example.com", "pw")
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals(OnboardingStep.Child, viewModel.step.value)
        assertEquals(listOf(child), viewModel.children.value)
        assertNull(viewModel.error.value)
    }

    @Test
    fun `login failure surfaces error and stays on login step`() = runTest(dispatcher) {
        whenever(repository.login("p@example.com", "bad")).thenReturn(
            Result.failure(Exception("Invalid credentials"))
        )

        viewModel.login("p@example.com", "bad")
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals(OnboardingStep.Login, viewModel.step.value)
        assertEquals("Invalid credentials", viewModel.error.value)
    }

    @Test
    fun `createChild appends the new child and advances to device step`() = runTest(dispatcher) {
        whenever(repository.createChild("New Kid")).thenReturn(Result.success(child))

        viewModel.createChild("New Kid")
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals(OnboardingStep.Device, viewModel.step.value)
        assertTrue(viewModel.children.value.contains(child))
    }

    @Test
    fun `registerDevice advances to pin step on success`() = runTest(dispatcher) {
        whenever(repository.registerDevice(child, "Phone")).thenReturn(Result.success(device))

        viewModel.registerDevice(child, "Phone")
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals(OnboardingStep.Pin, viewModel.step.value)
    }

    @Test
    fun `registerDevice failure surfaces error and stays put`() = runTest(dispatcher) {
        viewModel.selectChild(child) // step -> Device
        whenever(repository.registerDevice(child, "Phone")).thenReturn(
            Result.failure(Exception("Device limit reached"))
        )

        viewModel.registerDevice(child, "Phone")
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals(OnboardingStep.Device, viewModel.step.value)
        assertEquals("Device limit reached", viewModel.error.value)
    }

    @Test
    fun `savePin advances to permissions step`() = runTest(dispatcher) {
        whenever(repository.setParentPin("1234")).thenReturn(Result.success(Unit))

        viewModel.savePin("1234")
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals(OnboardingStep.Permissions, viewModel.step.value)
    }

    @Test
    fun `logout clears children and returns to login`() {
        viewModel.selectChild(child) // step -> Device
        viewModel.logout()

        assertEquals(OnboardingStep.Login, viewModel.step.value)
        assertTrue(viewModel.children.value.isEmpty())
        verify(repository).logout()
    }
}