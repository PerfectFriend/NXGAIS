/**
 * NeXXus Protocol - Real QR Code Generation & Verification Engine
 * Specification v2.0
 * 
 * Provides authentic ISO/IEC 18004 compliant QR code generation:
 * - High-density 2D matrix generation with Reed-Solomon error correction (Levels L, M, Q, H)
 * - Scalable vector SVG & raster PNG Data URL rendering
 * - Multi-protocol URL encoding:
 *   - nexxus://contact?addr=...&onion=...&name=...
 *   - Sovereign Tor v3 hidden service endpoints
 *   - BIP-39 seed emergency export envelopes
 * - Direct image export and download capabilities
 */

import QRCode from 'qrcode';

export interface QrRenderOptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  width?: number;
  darkColor?: string;
  lightColor?: string;
}

const DEFAULT_OPTIONS: QrRenderOptions = {
  errorCorrectionLevel: 'M',
  margin: 2,
  width: 320,
  darkColor: '#090d16',
  lightColor: '#ffffff',
};

/**
 * Generates an authentic Data URL (PNG image) from arbitrary text or contact URI.
 */
export async function generateQrDataUrl(
  text: string,
  options: QrRenderOptions = {}
): Promise<string> {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: merged.errorCorrectionLevel,
    margin: merged.margin,
    width: merged.width,
    color: {
      dark: merged.darkColor,
      light: merged.lightColor,
    },
  });
}

/**
 * Generates pure SVG string for high-DPI crisp rendering on any screen size.
 */
export async function generateQrSvgString(
  text: string,
  options: QrRenderOptions = {}
): Promise<string> {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: merged.errorCorrectionLevel,
    margin: merged.margin,
    width: merged.width,
    color: {
      dark: merged.darkColor,
      light: merged.lightColor,
    },
  });
}

/**
 * Encodes standard NeXXus sovereign contact payload into a canonical URI.
 */
export function formatContactQrUri(params: {
  accountAddress: string;
  onionAddress: string;
  nodeName: string;
  masterPublicKey?: string;
}): string {
  const query = new URLSearchParams({
    addr: params.accountAddress,
    onion: params.onionAddress,
    name: params.nodeName,
  });
  if (params.masterPublicKey) {
    query.set('pk', params.masterPublicKey);
  }
  return `nexxus://contact?${query.toString()}`;
}

/**
 * Triggers browser download of generated QR code image as PNG.
 */
export async function downloadQrCodePng(
  text: string,
  filename: string = 'nexxus-qr-card.png',
  options: QrRenderOptions = {}
): Promise<void> {
  const dataUrl = await generateQrDataUrl(text, { ...options, width: 640 });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
