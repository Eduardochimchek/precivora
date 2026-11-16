export const MAX_IMAGE_INPUT = 12 * 1024 * 1024;

/** Reduz a foto do produto para no máximo 480 px e ~300 KB (data URL). */
export async function compressImage(file: File, maxSide = 480): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem');
  if (file.size > MAX_IMAGE_INPUT) throw new Error('Imagem muito grande (limite de 12 MB)');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Não foi possível ler esta imagem');
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL('image/webp', q);
    const out = url.startsWith('data:image/webp') ? url : canvas.toDataURL('image/jpeg', q);
    if (out.length < 300_000) return out;
  }
  throw new Error('Não foi possível reduzir a imagem o suficiente');
}
