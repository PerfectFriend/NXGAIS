/**
 * NeXXus Protocol - Universal Zero-Dependency Cross-Browser QR Decoder
 * Specification v2.0
 * 
 * Supports both:
 * 1. Hardware-accelerated native BarcodeDetector API (Chromium, Edge, Opera, Android WebView)
 * 2. Pure JavaScript jsQR canvas image scanner (Firefox, Safari, desktop fallback)
 */

import jsQR from 'jsqr';

export interface DecodedQrResult {
  data: string;
  source: 'native_barcode_detector' | 'canvas_jsqr';
}

/**
 * Scans a HTMLVideoElement or HTMLCanvasElement or ImageData for QR codes
 */
export async function decodeQrFromMedia(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<DecodedQrResult | null> {
  // 1. Try hardware-accelerated BarcodeDetector if available
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      const barcodes = await detector.detect(source);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return {
          data: barcodes[0].rawValue,
          source: 'native_barcode_detector',
        };
      }
    } catch {
      // Fallback to canvas jsQR
    }
  }

  // 2. Universal Canvas fallback using jsQR
  try {
    const canvas = document.createElement('canvas');
    const width = source instanceof HTMLVideoElement ? source.videoWidth : (source.width || 320);
    const height = source instanceof HTMLVideoElement ? source.videoHeight : (source.height || 240);

    if (width <= 0 || height <= 0) return null;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(source as any, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data) {
      return {
        data: code.data,
        source: 'canvas_jsqr',
      };
    }
  } catch {
    // ignore canvas error
  }

  return null;
}

/**
 * Decodes a QR code from a user-uploaded File (image/png, image/jpeg, etc.)
 */
export async function decodeQrFromFile(file: File): Promise<DecodedQrResult | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = async () => {
      try {
        const result = await decodeQrFromMedia(img);
        URL.revokeObjectURL(url);
        resolve(result);
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}
