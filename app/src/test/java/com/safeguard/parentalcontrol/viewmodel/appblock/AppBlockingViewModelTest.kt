package com.safeguard.parentalcontrol.viewmodel.appblock

import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
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
import org.mockito.kotlin.whenever

@OptIn(ExperimentalCoroutinesApi::class)
class AppBlockingViewModelTest {

    @Mock private lateinit var repository: AppBlockingRepository
    @Mock private lateinit var onboardingStore: OnboardingStore

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        // Unconfined Main makes viewModelScope coroutines run eagerly on
        // the calling thread — StandardTestDispatcher as Main defers them
        // behind the scheduler in ways runTest cannot always advance.
        Dispatchers.setMain(UnconfinedTestDispatcher(dispatcher.scheduler))
        whenever(onboardingStore.deviceId).thenReturn("device-1")
        whenever(onboardingStore.childId).thenReturn("child-1")
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun rule(id: String, pkg: String, blocked: Boolean = true) = AppBlockRuleEntity(
        id = id,
        deviceId = "device-1",
        childId = "child-1",
        packageName = pkg,
        appName = "App $id",
        isBlocked = blocked,
        blockReason = null,
        unblockRequested = false,
        dailyLimitMinutes = null,
        createdAt = "2026-08-21T00:00:00Z",
        updatedAt = "2026-08-21T00:00:00Z"
    )

    @Test
    fun `emits Loading then Success with blocked apps and unblock requests`() = runTest(dispatcher) {
        val blocked = listOf(rule("r1", "com.game"), rule("r2", "com.social"))
        val requests = listOf(rule("r3", "com.msg", blocked = false).copy(unblockRequested = true))

        whenever(repository.getBlockedAppsFlow("device-1")).thenReturn(flowOf(blocked))
        whenever(repository.getUnblockRequestsFlow("device-1")).thenReturn(flowOf(requests))

        val viewModel = AppBlockingViewModel(repository, onboardingStore)
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is AppBlockingUiState.Success)
        val success = state as AppBlockingUiState.Success
        assertEquals(2, success.blockedApps.size)
        assertEquals(1, success.unblockRequests.size)
        assertEquals("com.game", success.blockedApps[0].packageName)
    }

    @Test
    fun `flow error surfaces Error state`() = runTest(dispatcher) {
        whenever(repository.getBlockedAppsFlow("device-1")).thenReturn(
            flow { throw RuntimeException("db error") }
        )
        whenever(repository.getUnblockRequestsFlow("device-1")).thenReturn(flowOf(emptyList()))

        val viewModel = AppBlockingViewModel(repository, onboardingStore)
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is AppBlockingUiState.Error)
        assertEquals("db error", (state as AppBlockingUiState.Error).message)
    }

    @Test
    fun `blockApp optimistic update applied then cleared on success`() = runTest(dispatcher) {
        whenever(repository.getBlockedAppsFlow("device-1")).thenReturn(flowOf(emptyList()))
        whenever(repository.getUnblockRequestsFlow("device-1")).thenReturn(flowOf(emptyList()))
        whenever(repository.blockApp(any(), any(), any(), any(), any()))
            .thenReturn(Result.success(rule("r-new", "com.game")))

        val viewModel = AppBlockingViewModel(repository, onboardingStore)
        dispatcher.scheduler.advanceUntilIdle()

        viewModel.blockApp("com.game", "Game", "distraction")
        dispatcher.scheduler.advanceUntilIdle()

        // Optimistic map should be cleaned up after success
        assertTrue(viewModel.optimisticBlocks.value.isEmpty())
    }

    @Test
    fun `blockApp emits toast on failure`() = runTest(dispatcher) {
        // Mockito's coroutine machinery re-wraps answers for suspend
        // functions returning kotlin.Result (the stub silently degrades to
        // Result.success(null)), so this test uses a hand-written fake that
        // throws — the continuation then carries Result.failure exactly
        // like a real network error.
        val failingRepo = object : AppBlockingRepository {
            override fun getBlockedAppsFlow(deviceId: String) = flowOf(emptyList<AppBlockRuleEntity>())
            override fun getAllRulesFlow(deviceId: String) = flowOf(emptyList<AppBlockRuleEntity>())
            override suspend fun getBlockedAppsSnapshot(deviceId: String) = emptyList<AppBlockRuleEntity>()
            override suspend fun getRuleByPackage(deviceId: String, packageName: String): AppBlockRuleEntity? = null
            override fun getUnblockRequestsFlow(deviceId: String) = flowOf(emptyList<AppBlockRuleEntity>())
            override suspend fun syncFromServer(childId: String, deviceId: String) = true
            override suspend fun blockApp(
                childId: String,
                deviceId: String,
                packageName: String,
                appName: String?,
                reason: String?
            ): Result<AppBlockRuleEntity> = Result.failure(RuntimeException("network error"))
            override suspend fun unblockApp(childId: String, ruleId: String): Result<Unit> =
                Result.success(Unit)
            override suspend fun requestUnblock(
                childId: String,
                ruleId: String,
                reason: String
            ): Result<AppBlockRuleEntity> = throw UnsupportedOperationException()
            override suspend fun reportTamper(deviceId: String, details: String) = true
        }

        val viewModel = AppBlockingViewModel(failingRepo, onboardingStore)
        dispatcher.scheduler.advanceUntilIdle()

        val events = mutableListOf<AppBlockingUiEvent>()
        val job = kotlinx.coroutines.CoroutineScope(dispatcher).launch {
            viewModel.uiEvents.collect { events.add(it) }
        }
        dispatcher.scheduler.advanceUntilIdle()

        viewModel.blockApp("com.game", "Game", null)
        dispatcher.scheduler.advanceUntilIdle()

        assertTrue(events.any { it is AppBlockingUiEvent.ShowToast })
        job.cancel()
    }

    @Test
    fun `unblockApp optimistic update applied then cleared on success`() = runTest(dispatcher) {
        whenever(repository.getBlockedAppsFlow("device-1")).thenReturn(flowOf(emptyList()))
        whenever(repository.getUnblockRequestsFlow("device-1")).thenReturn(flowOf(emptyList()))
        whenever(repository.unblockApp(any(), any()))
            .thenReturn(Result.success(Unit))

        val viewModel = AppBlockingViewModel(repository, onboardingStore)
        dispatcher.scheduler.advanceUntilIdle()

        viewModel.unblockApp("rule-1", "com.game")
        dispatcher.scheduler.advanceUntilIdle()

        assertTrue(viewModel.optimisticBlocks.value.isEmpty())
    }

    @Test
    fun `requestUnblock emits toast on failure`() = runTest(dispatcher) {
        whenever(repository.getBlockedAppsFlow("device-1")).thenReturn(flowOf(emptyList()))
        whenever(repository.getUnblockRequestsFlow("device-1")).thenReturn(flowOf(emptyList()))
        whenever(repository.requestUnblock(any(), any(), any()))
            .thenReturn(Result.failure(RuntimeException("server down")))

        val viewModel = AppBlockingViewModel(repository, onboardingStore)
        dispatcher.scheduler.advanceUntilIdle()

        val events = mutableListOf<AppBlockingUiEvent>()
        val job = kotlinx.coroutines.CoroutineScope(dispatcher).launch {
            viewModel.uiEvents.collect { events.add(it) }
        }
        dispatcher.scheduler.advanceUntilIdle()

        viewModel.requestUnblock("rule-1", "Need for homework")
        dispatcher.scheduler.advanceUntilIdle()

        assertTrue(events.any { it is AppBlockingUiEvent.ShowToast })
        job.cancel()
    }
}
