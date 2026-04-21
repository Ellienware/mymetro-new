// utils/qrCode.ts
import * as crypto from 'expo-crypto';

export const generateQRCode = (): string => {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.getRandomValues(new Uint8Array(4));
  const randomStr = Array.from(randomBytes)
    .map((byte) => byte.toString(36).padStart(2, '0'))
    .join('');
  return `TK${timestamp}${randomStr}`.toUpperCase();
};