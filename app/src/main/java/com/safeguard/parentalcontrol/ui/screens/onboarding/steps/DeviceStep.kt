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
import androidx.compose.ui.unit.dp

/** Step 3: name the device being registered. */
@Composable
internal fun DeviceStep(
    childName: String,
    isLoading: Boolean,
    onRegister: (String) -> Unit
) {
    var deviceName by remember { mutableStateOf("") }

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
        Button(
            onClick = { onRegister(deviceName) },
            enabled = !isLoading,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Register Device")
        }
    }
}
