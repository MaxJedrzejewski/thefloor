/** Bigger than this and localStorage fills up after a handful of clues. */
export const MAX_IMAGE_BYTES = 400_000;
const MAX_EDGE_PX = 1400;

export interface ImageResult {
  dataUrl: string;
  error: string | null;
}

/** Read an image file into a data URL, downscaling anything oversized. */
export async function fileToDataUrl(file: File): Promise<ImageResult> {
  if (!file.type.startsWith('image/')) {
    return { dataUrl: '', error: 'That file is not an image.' };
  }

  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });

  if (raw.length <= MAX_IMAGE_BYTES) return { dataUrl: raw, error: null };

  const downscaled = await downscale(raw);
  if (downscaled && downscaled.length <= MAX_IMAGE_BYTES) {
    return { dataUrl: downscaled, error: null };
  }

  return {
    dataUrl: downscaled ?? raw,
    error: 'That image is large. It will still work, but a few like it may fill up local storage.',
  };
}

async function downscale(dataUrl: string): Promise<string | null> {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = dataUrl;
    });

    const scale = Math.min(1, MAX_EDGE_PX / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}
