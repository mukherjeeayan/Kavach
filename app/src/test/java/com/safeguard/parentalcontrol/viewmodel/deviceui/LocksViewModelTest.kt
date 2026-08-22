package com.safeguard.parentalcontrol.viewmodel.deviceui

import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.entity.ScheduledLockEntity
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
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.whenever

/**
 * Unit tests for LocksViewModel: it mirrors the Room lock-window flow
 * into a typed UI state, success or error.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class LocksViewModelTest {

    @Mock
    private lateinit var scheduledLockDao: ScheduledLockDao

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

    private fun lock(id: String, active: Boolean) = ScheduledLockEntity(
        id = id,
        deviceId = null,
        dayOfWeek = 2,
        startTime = "20:00",
        endTime = "22:00",
        isActive = active
    )

    @Test
    fun `emits success with the synced lock windows`() = runTest(dispatcher) {
        whenever(scheduledLockDao.getAll()).thenReturn(
            flowOf(listOf(lock("l1", true), lock("l2", false)))
        )

        val viewModel = LocksViewModel(scheduledLockDao)
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is LocksUiState.Success)
        assertEquals(2, (state as LocksUiState.Success).locks.size)
        assertEquals("l1", state.locks[0].id)
    }

    @Test
    fun `flow failure surfaces a typed error state`() = runTest(dispatcher) {
        whenever(scheduledLockDao.getAll()).thenReturn(
            flow<List<ScheduledLockEntity>> { throw RuntimeException("table missing") }
        )

        val viewModel = LocksViewModel(scheduledLockDao)
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is LocksUiState.Error)
        assertEquals("table missing", (state as LocksUiState.Error).message)
    }
}