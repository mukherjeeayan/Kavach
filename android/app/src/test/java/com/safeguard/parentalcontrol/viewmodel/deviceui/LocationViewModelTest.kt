package com.safeguard.parentalcontrol.viewmodel.deviceui

import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.data.local.entity.LocationEntryEntity
import com.safeguard.parentalcontrol.data.remote.dto.LocationDto
import com.safeguard.parentalcontrol.repository.phase1.Phase1Repository
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

@OptIn(ExperimentalCoroutinesApi::class)
class LocationViewModelTest {

    @Mock private lateinit var locationDao: LocationDao
    @Mock private lateinit var phase1Repository: Phase1Repository
    @Mock private lateinit var onboardingStore: OnboardingStore

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(dispatcher)
        whenever(onboardingStore.childId).thenReturn("child-1")
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun ping(id: Long, lat: Double) = LocationEntryEntity(
        id = id,
        latitude = lat,
        longitude = 77.2,
        accuracyM = 10.0,
        speedKmh = 0.0,
        recordedAt = System.currentTimeMillis(),
        synced = true
    )

    @Test
    fun `emits Loading then Success with local pings`() = runTest(dispatcher) {
        val localPings = listOf(ping(1, 28.6139), ping(2, 28.6200))
        whenever(locationDao.flowRecent()).thenReturn(flowOf(localPings))

        val viewModel = LocationViewModel(locationDao, phase1Repository, onboardingStore)
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is LocationUiState.Success)
        val success = state as LocationUiState.Success
        assertEquals(2, success.localPings.size)
        assertEquals(28.6139, success.localPings[0].latitude, 0.001)
        assertTrue(success.serverPings.isEmpty())
    }

    @Test
    fun `flow error surfaces Error state`() = runTest(dispatcher) {
        whenever(locationDao.flowRecent()).thenReturn(
            flow { throw RuntimeException("location db locked") }
        )

        val viewModel = LocationViewModel(locationDao, phase1Repository, onboardingStore)
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is LocationUiState.Error)
        assertEquals("location db locked", (state as LocationUiState.Error).message)
    }

    @Test
    fun `refreshFromServer populates server pings`() = runTest(dispatcher) {
        val localPings = listOf(ping(1, 28.6139))
        whenever(locationDao.flowRecent()).thenReturn(flowOf(localPings))

        val serverDtos = listOf(
            LocationDto(
                id = "loc-1",
                child_id = "child-1",
                device_id = "device-1",
                latitude = 28.7000,
                longitude = 77.1000,
                accuracy_m = 15.0,
                speed_kmh = 5.0,
                recorded_at = "2026-08-21T10:00:00.000Z"
            )
        )
        whenever(phase1Repository.getCurrentLocations("child-1")).thenReturn(serverDtos)

        val viewModel = LocationViewModel(locationDao, phase1Repository, onboardingStore)
        dispatcher.scheduler.advanceUntilIdle()

        viewModel.refreshFromServer()
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value as LocationUiState.Success
        assertEquals(1, state.serverPings.size)
        assertEquals(28.7, state.serverPings[0].latitude, 0.001)
    }

    @Test
    fun `refreshFromServer handles empty server response`() = runTest(dispatcher) {
        whenever(locationDao.flowRecent()).thenReturn(flowOf(emptyList()))
        whenever(phase1Repository.getCurrentLocations("child-1")).thenReturn(emptyList())

        val viewModel = LocationViewModel(locationDao, phase1Repository, onboardingStore)
        dispatcher.scheduler.advanceUntilIdle()

        viewModel.refreshFromServer()
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value as LocationUiState.Success
        assertTrue(state.serverPings.isEmpty())
    }
}
