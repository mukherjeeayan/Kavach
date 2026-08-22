package com.safeguard.parentalcontrol.work

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.firebase.messaging.FirebaseMessaging
import com.safeguard.parentalcontrol.BuildConfig
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.repository.phase1.Phase1Repository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.tasks.await

/**
 * Uploads the current Firebase push token to the server. Enqueued from
 * [SafeGuardMessagingService.onNewToken] and on app start so a rotated
 * token is registered quickly and a stale one is replaced. No-ops when
 * FCM is not configured for this build (no google-services.json).
 */
@HiltWorker
class FcmTokenSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val phase1Repository: Phase1Repository,
    private val onboardingStore: OnboardingStore
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        if (!BuildConfig.FCM_ENABLED) return Result.success()
        val deviceId = onboardingStore.deviceId ?: return Result.success()

        return try {
            val token = FirebaseMessaging.getInstance().token.await()
            if (token.isNullOrEmpty()) return Result.retry()
            if (phase1Repository.reportFcmToken(deviceId, token)) {
                Result.success()
            } else {
                Result.retry()
            }
        } catch (_: Exception) {
            Result.retry()
        }
    }
}