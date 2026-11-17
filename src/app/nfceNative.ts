import { registerPlugin } from '@capacitor/core';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

interface NfceBrowserPlugin {
  open(opts: { url: string; key?: string }): Promise<{ html: string }>;
}

const NfceBrowser = registerPlugin<NfceBrowserPlugin>('NfceBrowser');

export class ScanCancelled extends Error {}

async function scanFormats(formats: BarcodeFormat[]): Promise<string> {
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (!available) {
    await BarcodeScanner.installGoogleBarcodeScannerModule();
    throw new Error('O leitor de códigos está sendo baixado pelo Google Play. Tente de novo em alguns segundos.');
  }
  try {
    const { barcodes } = await BarcodeScanner.scan({ formats });
    const raw = barcodes[0]?.rawValue;
    if (!raw) throw new ScanCancelled();
    return raw;
  } catch (err) {
    if (err instanceof ScanCancelled || /cancel/i.test((err as Error)?.message ?? '')) throw new ScanCancelled();
    throw err;
  }
}

/** Lê o QR Code do cupom com o leitor do Google (sem pedir permissão de câmera ao app). */
export const scanReceiptQr = () => scanFormats([BarcodeFormat.QrCode]);

/** Lê o código de barras da embalagem (EAN-13, EAN-8, UPC). */
export const scanProductBarcode = async () =>
  (await scanFormats([BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA])).replace(/\D/g, '');

/** Abre a consulta na Fazenda dentro do app e devolve a página da nota quando ela aparece. */
export async function fetchReceiptPage(url: string, key?: string): Promise<string> {
  try {
    const { html } = await NfceBrowser.open({ url, key });
    return html;
  } catch (err) {
    if (/cancel/i.test((err as Error)?.message ?? '')) throw new ScanCancelled();
    throw err;
  }
}
