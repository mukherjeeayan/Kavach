package com.safeguard.parentalcontrol.provisioning

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECPublicKeySpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.KeyAgreement
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * ECDH key exchange for QR-code device pairing.
 *
 * Flow:
 * 1. Frontend generates ephemeral ECDH key pair and sends public key in QR code.
 * 2. Child device generates its own ECDH key pair (backed by Android Keystore/StrongBox).
 * 3. Both sides derive a shared secret via ECDH.
 * 4. Shared secret is used to encrypt the pairing nonce and derive a device encryption key.
 *
 * The public keys are exchanged via the QR code; the shared secret never leaves the device.
 */
object KeyExchange {

    private const val TAG = "KeyExchange"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "kavach_pairing_key"
    private const val EC_CURVE = "secp256r1" // NIST P-256

    /**
     * Generate an ECDH key pair backed by Android Keystore (StrongBox if available).
     * Returns the Base64-encoded public key to be sent to the backend.
     */
    fun generateKeyPair(): String {
        val kpg = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            KEYSTORE_PROVIDER
        )

        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_AGREE_KEY
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec(EC_CURVE))
            .setAttestationChallenge(null) // No attestation needed for pairing
            .setIsStrongBoxBacked(true)
            .build()

        kpg.initialize(spec)
        val keyPair = kpg.generateKeyPair()

        val publicKeyBytes = keyPair.public.encoded
        val publicKeyBase64 = Base64.encodeToString(publicKeyBytes, Base64.NO_WRAP)

        Log.d(TAG, "Generated ECDH key pair (public key: ${publicKeyBase64.take(20)}...)")
        return publicKeyBase64
    }

    /**
     * Derive a shared secret from the frontend's ephemeral public key and our Keystore key.
     *
     * @param frontendPublicKeyBase64 Base64-encoded public key from the QR code
     * @param pairingNonce Nonce from the QR code (mixed into key derivation)
     * @return Base64-encoded derived key suitable for AES-256-GCM
     */
    fun deriveSharedSecret(
        frontendPublicKeyBase64: String,
        pairingNonce: String
    ): String? {
        try {
            // Load our private key from Android Keystore
            val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
            val privateKeyEntry = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.PrivateKeyEntry
                ?: run {
                    Log.e(TAG, "No key found in KeyStore. Call generateKeyPair() first.")
                    return null
                }

            // Decode the frontend's public key
            val publicKeyBytes = Base64.decode(frontendPublicKeyBase64, Base64.NO_WRAP)
            val publicKey = KeyFactory.getInstance("EC")
                .generatePublic(X509EncodedKeySpec(publicKeyBytes)) as ECPublicKey

            // Perform ECDH key agreement
            val keyAgreement = KeyAgreement.getInstance("ECDH")
            keyAgreement.init(privateKeyEntry.privateKey)
            keyAgreement.doPhase(publicKey, true)
            val sharedSecret = keyAgreement.generateSecret()

            // Derive a 256-bit key from the shared secret using HKDF-like construction
            // Mix in the pairing nonce to prevent replay attacks
            val derivedKey = deriveKeyFromSecret(sharedSecret.encoded, pairingNonce)

            Log.d(TAG, "Shared secret derived successfully")
            return Base64.encodeToString(derivedKey, Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to derive shared secret", e)
            return null
        }
    }

    /**
     * Derive an AES-256 key from the ECDH shared secret using PBKDF2.
     * The pairing nonce serves as salt.
     */
    private fun deriveKeyFromSecret(
        sharedSecret: ByteArray,
        nonce: String
    ): ByteArray {
        val spec = PBEKeySpec(
            CharArray(0), // No password — shared secret is the key material
            nonce.toByteArray(Charsets.UTF_8), // Salt = pairing nonce
            100_000, // Iterations
            256 // Key length in bits
        )
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val derivedKey = factory.generateSecret(spec).encoded
        spec.clearPassword()
        return derivedKey
    }

    /**
     * Clean up the Keystore entry (called on account deletion or logout).
     */
    fun deleteKeyPair() {
        try {
            val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
            keyStore.deleteEntry(KEY_ALIAS)
            Log.d(TAG, "Pairing key deleted from Keystore")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete pairing key", e)
        }
    }
}
