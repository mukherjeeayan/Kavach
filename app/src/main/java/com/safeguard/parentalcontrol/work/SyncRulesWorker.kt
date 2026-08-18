package com.safeguard.parentalcontrol.work

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
import com.safeguard.parentalcontrol.repository.phase1.Phase1Repository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * Periodic sync worker:
 *  1. pulls app-block rules into the local Room cache (enforcement
 *     reads only from Room, so it stays offline-capable),
 *  2. pulls scheduled locks and contact rules into their Room caches,
 *  3. uploads buffered daily screen time and unsynced location pings,
 *     dropping the buffered rows only after the server acked them.
 *
 * Scheduled via [SyncScheduler.schedule] (runs at the WorkManager
 * platform minimum of 15 minutes — periodic work cannot be shorter).
 */
@HiltWorker
class SyncRulesWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val repository: AppBlockingRepository,
    private val phase1Repository: Phase1Repository,
    private val onboardingStore: OnboardingStore
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        // Real identifiers captured during onboarding. Before that
        // completes there is nothing to sync — report success so the
        // periodic worker does not spin forever.
        val childId = onboardingStore.childId ?: return Result.success()
        val deviceId = onboardingStore.deviceId ?: return Result.success()

        var ok = repository.syncFromServer(childId, deviceId)
        ok = phase1Repository.syncLocks(childId) && ok
        ok = phase1Repository.syncContacts(childId) && ok
        ok = phase1Repository.uploadScreenTimeSinceLastSync(deviceId) && ok
        ok = phase1Repository.uploadBufferedLocations(deviceId) && ok

        return if (ok) {
            Result.success()
        } else {
            // Sync failed — keep the worker alive so it retries on the
            // next run (fail-closed: old cache stays enforced meanwhile).
            Result.retry()
        }
    }
}