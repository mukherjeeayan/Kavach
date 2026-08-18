package com.safeguard.parentalcontrol.ui.screens.onboarding

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safeguard.parentalcontrol.data.remote.dto.ChildDto
import com.safeguard.parentalcontrol.ui.screens.onboarding.steps.ChildStep
import com.safeguard.parentalcontrol.ui.screens.onboarding.steps.DeviceStep
import com.safeguard.parentalcontrol.ui.screens.onboarding.steps.LoginStep
import com.safeguard.parentalcontrol.ui.screens.onboarding.steps.PermissionsStep
import com.safeguard.parentalcontrol.ui.screens.onboarding.steps.PinStep
import com.safeguard.parentalcontrol.viewmodel.onboarding.OnboardingStep
import com.safeguard.parentalcontrol.viewmodel.onboarding.OnboardingViewModel

/**
 * Five-step parent onboarding:
 *  1. Login (parent credentials)
 *  2. Select or create the child profile
 *  3. Register this device
 *  4. Set the parental unlock PIN
 *  5. Grant the permissions enforcement needs
 *
 * The final step gates on all permissions; the child should not be
 * able to reach the dashboard with blocking crippled.
 */
@Composable
fun OnboardingScreen(
    onComplete: () -> Unit,
    viewModel: OnboardingViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val step by viewModel.step.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()

    var selectedChild by remember { mutableStateOf<ChildDto?>(null) }

    LaunchedEffect(step) {
        if (step == OnboardingStep.Done) onComplete()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(32.dp))
        Text("SafeGuard Setup", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            text = when (step) {
                OnboardingStep.Login -> "Sign in with your parent account"
                OnboardingStep.Child -> "Who will use this device?"
                OnboardingStep.Device -> "Name this device"
                OnboardingStep.Pin -> "Choose a parent PIN"
                OnboardingStep.Permissions -> "Grant protection permissions"
                OnboardingStep.Done -> ""
            },
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(Modifier.height(24.dp))

        error?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall
            )
            Spacer(Modifier.height(8.dp))
        }

        when (step) {
            OnboardingStep.Login -> LoginStep(viewModel)
            OnboardingStep.Child -> ChildStep(
                children = viewModel.children.collectAsStateWithLifecycle().value,
                isLoading = isLoading,
                onSelect = { child ->
                    selectedChild = child
                    viewModel.selectChild(child)
                },
                onCreate = viewModel::createChild
            )
            OnboardingStep.Device -> DeviceStep(
                childName = selectedChild?.name ?: "",
                isLoading = isLoading,
                onRegister = { name ->
                    selectedChild?.let { viewModel.registerDevice(it, name) }
                }
            )
            OnboardingStep.Pin -> PinStep(
                isLoading = isLoading,
                onSave = viewModel::savePin
            )
            OnboardingStep.Permissions -> PermissionsStep(
                context = context,
                onFinished = viewModel::finishOnboarding
            )
            OnboardingStep.Done -> {}
        }
    }
}
