package com.safeguard.parentalcontrol.ui.screens.onboarding.steps

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp

/** Step 3: name the device being registered and optionally provide the child's phone number. */
@Composable
internal fun DeviceStep(
    childName: String,
    isLoading: Boolean,
    onRegister: (String) -> Unit,
    onPhoneProvided: ((String) -> Unit)? = null
) {
    var deviceName by remember { mutableStateOf("") }
    var phoneNumber by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            "Registering this device for $childName",
            style = MaterialTheme.typography.bodyMedium
        )
        OutlinedTextField(
            value = deviceName,
            onValueChange = { deviceName = it },
            label = { Text("Device name (e.g. Kid's Phone)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = phoneNumber,
            onValueChange = { phoneNumber = it.filter { c -> c.isDigit() || c == '+' || c == '-' || c == ' ' }.take(15) },
            label = { Text("Child's phone number (optional)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            onClick = {
                if (phoneNumber.isNotBlank()) {
                    onPhoneProvided?.invoke(phoneNumber)
                }
                onRegister(deviceName)
            },
            enabled = !isLoading,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Register Device")
        }
    }
}
