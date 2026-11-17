import { Capacitor } from '@capacitor/core';

/** true quando roda dentro do app Android (Capacitor), false no navegador. */
export const isNative = Capacitor.isNativePlatform();
