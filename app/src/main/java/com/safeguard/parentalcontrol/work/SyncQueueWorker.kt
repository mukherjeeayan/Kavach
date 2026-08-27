package com.safeguard.parentalcontrol.work

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.safeguard.parentalcontrol.data.local.dao.SyncQueueDao
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class SyncQueueWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val syncQueueDao: SyncQueueDao
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        var hasMore = true
        while (hasMore) {
            val pending = syncQueueDao.getPendingItemsList()
            if (pending.isEmpty()) {
                hasMore = false
                break
            }

            for (item in pending) {
                try {
                    when (item.featureType) {
                        "APP_BLOCK" -> when (item.action) {
                            "CREATE" -> { /* call appBlockingApi.blockApp(...) */ }
                            "DELETE" -> { /* call appBlockingApi.unblockApp(...) */ }
                        }
                        "CONTACT" -> when (item.action) {
                            "CREATE" -> { /* call contact repository */ }
                        }
                    }
                    syncQueueDao.updateStatus(item.id, "COMPLETED")
                } catch (e: Exception) {
                    if (item.retryCount >= item.maxRetries) {
                        syncQueueDao.updateStatus(item.id, "FAILED")
                    } else {
                        syncQueueDao.updateStatus(item.id, "PENDING")
                    }
                }
            }
            hasMore = false
        }
        return Result.success()
    }
}
