package com.safeguard.parentalcontrol.viewmodel.deviceui

import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.data.local.entity.ScreenTimeDailyEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.whenever


/**
 * Unit tests for ScreenTimeViewModel: the local-first dashboard must
 * render whatever the Room flow emits (including an empty day) and
 * surface a typed error when the flow fails.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ScreenTimeViewModelTest {

    @Mock
    private lateinit var screenTimeDao: ScreenTimeDao

    @Mock
    private lateinit var onboardingStore: OnboardingStore

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun newViewModel(): ScreenTimeViewModel {
        whenever(onboardingStore.childId).thenReturn("child-1")
        return ScreenTimeViewModel(screenTimeDao, onboardingStore)
    }

    private fun row(pkg: String, seconds: Int, date: String = "2026-08-20") =
        ScreenTimeDailyEntity(appPackage = pkg, appCategory = null, seconds = seconds, date = date)

    @Test
    fun `emits success with summed totals from the room flow`() = runTest(dispatcher) {
        whenever(screenTimeDao.flowByDate(org.mockito.kotlin.any())).thenReturn(
            flowOf(listOf(row("a.b", 60), row("c.d", 240)))
        )

        val viewModel = newViewModel()
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is ScreenTimeUiState.Success)
        assertEquals(2, (state as ScreenTimeUiState.Success).rows.size)
        assertEquals(300, state.totalSeconds)
    }

    @Test
    fun `empty day renders an empty success state`() = runTest(dispatcher) {
        whenever(screenTimeDao.flowByDate(org.mockito.kotlin.any())).thenReturn(flowOf(emptyList()))

        val viewModel = newViewModel()
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is ScreenTimeUiState.Success)
        assertEquals(0, (state as ScreenTimeUiState.Success).totalSeconds)
    }

    @Test
    fun `flow failure surfaces a typed error state`() = runTest(dispatcher) {
        whenever(screenTimeDao.flowByDate(org.mockito.kotlin.any())).thenReturn(
            flow<List<ScreenTimeDailyEntity>> { throw RuntimeException("db locked") }
        )

        val viewModel = newViewModel()
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is ScreenTimeUiState.Error)
        assertEquals("db locked", (state as ScreenTimeUiState.Error).message)
    }
}