package com.safeguard.parentalcontrol.ui.screens.phase2

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safeguard.parentalcontrol.viewmodel.phase2.MoodState
import com.safeguard.parentalcontrol.viewmodel.phase2.MoodViewModel

data class MoodOption(val score: Int, val emoji: String, val label: String)

private val moodOptions = listOf(
    MoodOption(1, "\uD83D\uDE22", "Very Sad"),
    MoodOption(2, "\uD83D\uDE1E", "Sad"),
    MoodOption(3, "\uD83D\uDE10", "Neutral"),
    MoodOption(4, "\uD83D\uDE0A", "Happy"),
    MoodOption(5, "\uD83D\uDE04", "Very Happy")
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoodScreen(
    viewModel: MoodViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var note by remember { mutableStateOf("") }

    LaunchedEffect(uiState) {
        when (val state = uiState) {
            is MoodState.Success -> {
                Toast.makeText(context, "Mood logged!", Toast.LENGTH_SHORT).show()
                viewModel.reset()
            }
            is MoodState.Error -> {
                Toast.makeText(context, state.message, Toast.LENGTH_SHORT).show()
            }
            else -> {}
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("How are you feeling?") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(5),
                modifier = Modifier.padding(vertical = 16.dp)
            ) {
                items(moodOptions) { option ->
                    MoodEmojiButton(
                        option = option,
                        onClick = { viewModel.logMood(option.score, option.label, note.ifBlank { null }) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Add a note (optional)") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                maxLines = 4
            )

            if (uiState is MoodState.Logging) {
                Spacer(modifier = Modifier.height(16.dp))
                CircularProgressIndicator()
            }
        }
    }
}

@Composable
fun MoodEmojiButton(option: MoodOption, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(4.dp)
    ) {
        TextButton(
            onClick = onClick,
            modifier = Modifier.size(64.dp)
        ) {
            Text(
                text = option.emoji,
                fontSize = 36.sp,
                textAlign = TextAlign.Center
            )
        }
        Text(
            text = option.label,
            style = MaterialTheme.typography.labelSmall,
            textAlign = TextAlign.Center
        )
    }
}
