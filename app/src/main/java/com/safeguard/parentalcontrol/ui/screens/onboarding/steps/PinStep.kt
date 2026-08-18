package com.safeguard.parentalcontrol.ui.screens.onboarding.steps

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp

/**
 * Step 4 — the parent picks the unlock PIN (4-6 digits) used to open
 * the parental control sections. The raw PIN is never stored on the
 * device; the repository keeps only a salted digest (and mirrors the
 * hash to the backend for the web dashboard).
 */
@Composable
fun PinStep(
    isLoading: Boolean,
    onSave: (String) -> Unit
) {
    var pin by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    val validLength = pin.length in 4..6

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        OutlinedTextField(
            value = pin,
            onValueChange = { pin = it.filter(Char::isDigit).take(6) },
            label = { Text("4-6 digit PIN") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = confirm,
            onValueChange = { confirm = it.filter(Char::isDigit).take(6) },
            label = { Text("Confirm PIN") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(8.dp))
        if (confirm.isNotEmpty() && pin != confirm) {
            Text(
                "PINs do not match",
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall
            )
            Spacer(Modifier.height(8.dp))
        }
        Button(
            onClick = { onSave(pin) },
            enabled = validLength && pin == confirm && !isLoading,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (isLoading) "Saving…" else "Continue")
        }
    }
}