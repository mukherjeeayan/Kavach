package com.safeguard.parentalcontrol.ui.screens.onboarding.steps

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.safeguard.parentalcontrol.data.remote.dto.ChildDto

/** Step 2: pick an existing child profile or create a new one. */
@Composable
internal fun ChildStep(
    children: List<ChildDto>,
    isLoading: Boolean,
    onSelect: (ChildDto) -> Unit,
    onCreate: (String) -> Unit
) {
    var newChildName by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (children.isEmpty()) {
            Text(
                "No child profiles yet — create one to continue.",
                style = MaterialTheme.typography.bodyMedium
            )
        } else {
            children.forEach { child ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(child.name, style = MaterialTheme.typography.titleMedium)
                        OutlinedButton(onClick = { onSelect(child) }) {
                            Text("Use")
                        }
                    }
                }
            }
        }

        OutlinedTextField(
            value = newChildName,
            onValueChange = { newChildName = it },
            label = { Text("Or add a child profile") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            onClick = { onCreate(newChildName) },
            enabled = !isLoading && newChildName.isNotBlank(),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Create Profile")
        }
    }
}
