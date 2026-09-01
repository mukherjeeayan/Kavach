package com.safeguard.parentalcontrol.viewmodel.deviceui

import com.safeguard.parentalcontrol.data.local.dao.ContactRuleDao
import com.safeguard.parentalcontrol.data.local.entity.ContactRuleEntity
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
 * Unit tests for ContactsViewModel: it mirrors the Room contact-rule
 * flow into a typed UI state, success or error.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ContactsViewModelTest {

    @Mock
    private lateinit var contactRuleDao: ContactRuleDao

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

    private fun contact(id: String, ruleType: String) = ContactRuleEntity(
        id = id,
        phoneNumber = "+911234567890",
        contactName = "Contact $id",
        ruleType = ruleType,
        isActive = true
    )

    @Test
    fun `emits success with the synced contact rules`() = runTest(dispatcher) {
        whenever(contactRuleDao.getAll()).thenReturn(
            flowOf(listOf(contact("c1", "BLOCK"), contact("c2", "ALLOW")))
        )

        val viewModel = ContactsViewModel(contactRuleDao)
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is ContactsUiState.Success)
        assertEquals(2, (state as ContactsUiState.Success).contacts.size)
        assertEquals("BLOCK", state.contacts[0].ruleType)
    }

    @Test
    fun `flow failure surfaces a typed error state`() = runTest(dispatcher) {
        whenever(contactRuleDao.getAll()).thenReturn(
            flow<List<ContactRuleEntity>> { throw RuntimeException("db locked") }
        )

        val viewModel = ContactsViewModel(contactRuleDao)
        dispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is ContactsUiState.Error)
        assertEquals("db locked", (state as ContactsUiState.Error).message)
    }
}