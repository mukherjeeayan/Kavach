package com.safeguard.parentalcontrol.security

import android.content.Context
import android.content.pm.PackageManager
import androidx.security.crypto.MasterKey
import timber.log.Timber

/**
 * Creates a [MasterKey] backed by hardware StrongBox (TEE/SE) when
 * available, falling back to the software-backed Android Keystore on
 * devices without StrongBox.
 *
 * StrongBox provides tamper-resistant key storage that survives OS
 * compromises and firmware-level attacks.
 */
object SecureMasterKey {

    /**
     * Builds the best-available MasterKey for the given context.
     * Checks for StrongBox availability at the system level before
     * requesting hardware-backed key generation.
     */
    fun build(context: Context): MasterKey {
        val hasStrongBox = try {
            context.packageManager.hasSystemFeature(
                PackageManager.FEATURE_STRONGBOX_KEYSTORE
            )
        } catch (_: Exception) {
            false
        }

        val builder = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)

        if (hasStrongBox) {
            try {
                builder.setRequestStrongBoxBacked(true)
                Timber.d("MasterKey: StrongBox hardware backing requested")
            } catch (e: Exception) {
                Timber.w(e, "MasterKey: StrongBox request failed, falling back to software keystore")
            }
        } else {
            Timber.d("MasterKey: StrongBox not available, using software-backed keystore")
        }

        return builder.build()
    }
}
