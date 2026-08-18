package com.safeguard.parentalcontrol.work

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * Periodically pulls the latest rules from the server into the local
 * Room cache. The enforcement service reads only from Room, so this
 * keeps the cache fresh while staying fully offline-capable.
 *
 * Scheduled via [SyncScheduler.schedule] (runs at the WorkManager
 * platform minimum of 15 minutes — periodic work cannot be shorter).
 */
@HiltWorker
class SyncRulesWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val repository: AppBlockingRepository,
    private val onboardingStore: OnboardingStore
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        // Real identifiers captured during onboarding. Before that
        // completes there is nothing to sync — report success so the
        // periodic worker does not spin forever.
        val childId = onboardingStore.childId ?: return Result.success()
        val deviceId = onboardingStore.deviceId ?: return Result.success()

        val synced = repository.syncFromServer(childId, deviceId)
        return if (synced) {
            Result.success()
        } else {
            // Sync failed — keep the worker alive so it retries on the
            // next run (fail-closed: old cache stays enforced meanwhile).
            Result.retry()
        }
    }
}