import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { initiateKeyExchange } from '../../utils/crypto';
import apiClient from '../../services/apiClient';

interface PairingData {
  familyId: string;
  pairingNonce: string;
  backendUrl: string;
  childName: string;
  ephemeralPublicKey: string;
  expiresAt: number;
}

interface DevicePairingQRProps {
  familyId: string;
  childName: string;
  onExpiry?: () => void;
}

/**
 * Generates an ephemeral QR code for device pairing.
 *
 * The QR code contains:
 * - familyId: The family this child belongs to
 * - pairingNonce: One-time nonce for replay protection
 * - backendUrl: The API endpoint the child device should register with
 * - childName: Display name for the child
 * - ephemeralPublicKey: ECDH public key for key exchange
 * - expiresAt: Timestamp when the QR code expires (5 minutes)
 *
 * The ephemeral key pair is generated client-side using Web Crypto API.
 * The private key never leaves the parent's browser; only the public key
 * is included in the QR code for ECDH key agreement.
 */
export default function DevicePairingQR({ familyId, childName, onExpiry }: DevicePairingQRProps) {
  const [pairingData, setPairingData] = useState<PairingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generatePairingCode();
  }, [familyId, childName]);

  useEffect(() => {
    if (!pairingData) return;

    const timeUntilExpiry = (pairingData.expiresAt * 1000) - Date.now();
    if (timeUntilExpiry <= 0) {
      onExpiry?.();
      return;
    }

    const timer = setTimeout(() => {
      onExpiry?.();
    }, timeUntilExpiry);

    return () => clearTimeout(timer);
  }, [pairingData, onExpiry]);

  async function generatePairingCode() {
    try {
      setLoading(true);
      setError(null);

      // Generate ephemeral ECDH key pair for the pairing exchange
      const { publicKey } = await initiateKeyExchange();

      // Request a provisioning QR from the backend
      const response = await apiClient.post('/auth/provisioning-qr', {
        childName,
      });

      const { pairingNonce, backendUrl } = response.data.data;

      const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 minutes

      setPairingData({
        familyId,
        pairingNonce,
        backendUrl: backendUrl || window.location.origin,
        childName,
        ephemeralPublicKey: publicKey,
        expiresAt,
      });
    } catch (err) {
      console.error('Failed to generate pairing code:', err);
      setError('Failed to generate pairing code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
          <span className="text-gray-500">Generating pairing code...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <div className="w-64 h-64 bg-red-50 rounded-lg flex items-center justify-center">
          <span className="text-red-500 text-sm text-center px-4">{error}</span>
        </div>
        <button
          onClick={generatePairingCode}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!pairingData) return null;

  const qrValue = JSON.stringify({
    familyId: pairingData.familyId,
    pairingNonce: pairingData.pairingNonce,
    backendUrl: pairingData.backendUrl,
    childName: pairingData.childName,
    ephemeralPublicKey: pairingData.ephemeralPublicKey,
    expiresAt: pairingData.expiresAt,
  });

  const timeRemaining = Math.max(0, Math.floor((pairingData.expiresAt * 1000 - Date.now()) / 1000));

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h3 className="text-lg font-semibold text-gray-800">Pair Child Device</h3>
      <p className="text-sm text-gray-600 text-center max-w-xs">
        Scan this QR code with the Kavach app on your child&apos;s device to complete pairing.
      </p>

      <div className="p-4 bg-white rounded-xl shadow-lg">
        <QRCodeSVG
          value={qrValue}
          size={256}
          level="M"
          includeMargin={true}
        />
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-500">
          Expires in {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          One-time use only. Each scan generates a new code.
        </p>
      </div>

      <button
        onClick={generatePairingCode}
        className="px-4 py-2 text-sm text-blue-500 hover:text-blue-600 underline"
      >
        Generate new code
      </button>
    </div>
  );
}
