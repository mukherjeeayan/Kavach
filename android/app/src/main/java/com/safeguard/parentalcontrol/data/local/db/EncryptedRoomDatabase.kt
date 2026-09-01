package com.safeguard.parentalcontrol.data.local.db

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.sqlite.db.SupportSQLiteDatabase
import net.sqlcipher.database.SupportFactory
import javax.crypto.KeyGenerator

object EncryptedDatabase {

    private const val PREFS_NAME = "safeguard_db_prefs"
    private const val KEY_DB_PASSPHRASE = "db_passphrase"

    /**
     * Creates a SupportFactory for SQLCipher encryption using a passphrase
     * stored in EncryptedSharedPreferences (backed by Android Keystore).
     */
    fun createFactory(context: Context): SupportFactory {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        val prefs: SharedPreferences = EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        val passphrase = prefs.getString(KEY_DB_PASSPHRASE, null)
            ?: generateAndStorePassphrase(prefs)

        return SupportFactory(passphrase.toByteArray(Charsets.UTF_8))
    }

    private fun generateAndStorePassphrase(prefs: SharedPreferences): String {
        val passphrase = buildString {
            val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()"
            val secureRandom = java.security.SecureRandom()
            repeat(64) { append(chars[secureRandom.nextInt(chars.length)]) }
        }
        prefs.edit().putString(KEY_DB_PASSPHRASE, passphrase).apply()
        return passphrase
    }
}
