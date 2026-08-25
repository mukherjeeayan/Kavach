package work

import androidx.work.*
import com.safeguard.parentalcontrol.data.local.dao.SyncQueueDao
import dagger.hilt.android.binds.ApplicationContext
import dagger.hilt.ComponentInjector
import kotlinx.coroutines.CancelledException
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

class SyncQueueWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    @ApplicationContext ctx: Context,
    private val syncQueueDao: SyncQueueDao,
    private val cancelFlow: MutableSharedFlow<String>
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
                        // ... other feature types
                    }
                    syncQueueDao.updateStatus(item.id, "COMPLETED")
                } catch (e: Exception) {
                    if (item.retryCount >= item.maxRetries) {
                        syncQueueDao.updateStatus(item.id, "FAILED")
                    } else {
                        syncQueueDao.updateStatus(item.id, "PENDING")
                        // exponential backoff not shown for brevity
                    }
                }
            }
            hasMore = false // process one batch per run
        }
        return Result.success()
    }
}