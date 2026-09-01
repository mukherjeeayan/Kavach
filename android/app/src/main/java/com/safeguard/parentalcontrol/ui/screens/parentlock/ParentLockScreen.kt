package com.safeguard.parentalcontrol.ui.screens.parentlock

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.safeguard.parentalcontrol.data.local.ParentPinStore
import com.safeguard.parentalcontrol.security.SecureScreen
import java.util.concurrent.Executors

/**
 * Gate shown before the parental control dashboard whenever a PIN is
 * set. Tries biometric unlock first (if enrolled), then falls back to
 * the PIN. The child cannot reach the dashboard without passing one.
 */
@Composable
fun ParentLockScreen(
    pinStore: ParentPinStore,
    onUnlocked: () -> Unit
) {
    SecureScreen {
        ParentLockScreenContent(
            pinStore = pinStore,
            onUnlocked = onUnlocked
        )
    }
}

@Composable
private fun ParentLockScreenContent(
    pinStore: ParentPinStore,
    onUnlocked: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? FragmentActivity
    val biometricAvailable = remember {
        BiometricManager.from(context).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
            BiometricManager.BIOMETRIC_SUCCESS
    }

    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    fun tryPin() {
        if (pinStore.verifyPin(pin)) {
            onUnlocked()
        } else {
            error = "Incorrect PIN"
            pin = ""
        }
    }

    if (activity != null && biometricAvailable) {
        val executor = remember { Executors.newSingleThreadExecutor() }
        val prompt = remember(activity) {
            BiometricPrompt(
                activity,
                executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        onUnlocked()
                    }

                    override fun onAuthenticationFailed() {
                        error = "Biometric not recognized — use the PIN"
                    }
                }
            )
        }

        DisposableEffect(Unit) {
            prompt.authenticate(
                BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Parental controls")
                    .setSubtitle("Verify yourself to open settings")
                    .setNegativeButtonText("Use PIN")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                    .build()
            )
            onDispose { executor.shutdown() }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(80.dp))
        Text("Protected", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            "Enter the parent PIN to open settings",
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

        OutlinedTextField(
            value = pin,
            onValueChange = { pin = it.filter(Char::isDigit).take(6) },
            label = { Text("Parent PIN") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = ::tryPin,
            enabled = pin.isNotEmpty(),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Unlock")
        }
    }
}