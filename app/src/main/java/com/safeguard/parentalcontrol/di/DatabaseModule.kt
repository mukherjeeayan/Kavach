@Dao
abstract fun provideSyncQueueDao(): SyncQueueDao

@TypeConverters(converters = TypeConverters::class)
abstract class DatabaseModule {
    companion object {
        const val MIGRATION_4_5 = SQLiteiteMigrations.createSyncQueueTable()

        object SQLiteiteMigrations {
            fun createSyncQueueTable(): Migration {
                return Migration(4, 5) {
                    db -> db.execSQL(
                        "CREATE TABLE IF NOT EXISTS sync_queue (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "featureType TEXT," +
                        "action TEXT," +
                        "payloadJson TEXT," +
                        "createdAt INTEGER," +
                        "retryCount INTEGER DEFAULT 0," +
                        "maxRetries INTEGER DEFAULT 5," +
                        "status TEXT DEFAULT 'PENDING')"
                    )
                }
            }
        }
    }
}