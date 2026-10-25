/**
 * Ultra-Fast Portrait & Background Segmentation Engine
 * Runs in browser canvas memory using TypedArrays with cooperative yielding.
 * Guarantees zero UI freeze even for 8MP+ photos.
 */

export interface FastMattingOptions {
  tolerance?: number; // 0-100 (default ~36)
  feather?: number; // feather radius in pixels (default 2)
  onProgress?: (stage: string, pct: number) => void;
}

async function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.scheduler && typeof window.scheduler.yield === 'function') {
      // @ts-ignore
      window.scheduler.yield().then(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export async function fastRemoveBackground(
  imageSource: File | Blob | string | HTMLImageElement,
  options: FastMattingOptions = {}
): Promise<Blob> {
  const { tolerance = 36, feather = 2, onProgress } = options;

  if (onProgress) onProgress('ছবি লোড হচ্ছে...', 15);
  await yieldToMain();

  let img: HTMLImageElement;
  if (imageSource instanceof HTMLImageElement) {
    img = imageSource;
  } else {
    img = new Image();
    img.crossOrigin = 'anonymous';
    const srcUrl =
      typeof imageSource === 'string'
        ? imageSource
        : URL.createObjectURL(imageSource);

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image for fast matting'));
      img.src = srcUrl;
    });
  }

  if (onProgress) onProgress('ব্যাকগ্রাউন্ড ও প্রান্ত স্ক্যান হচ্ছে...', 35);
  await yieldToMain();

  const origWidth = img.naturalWidth || img.width;
  const origHeight = img.naturalHeight || img.height;

  // If image is larger than 1200px, downscale for the segmentation pass to prevent freeze
  const maxDim = 1200;
  const longestEdge = Math.max(origWidth, origHeight);
  const scale = longestEdge > maxDim ? maxDim / longestEdge : 1.0;
  const width = Math.round(origWidth * scale);
  const height = Math.round(origHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.drawImage(img, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Sample Background Boundary Colors
  const bgSamples: { r: number; g: number; b: number }[] = [];
  const stepX = Math.max(1, Math.floor(width / 40));
  const stepY = Math.max(1, Math.floor(height / 40));

  // Top border
  for (let x = 0; x < width; x += stepX) {
    for (let y = 0; y < Math.min(6, height); y++) {
      const idx = (y * width + x) * 4;
      bgSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
  }

  // Left & Right borders (upper 75%)
  const maxBorderY = Math.floor(height * 0.75);
  for (let y = 0; y < maxBorderY; y += stepY) {
    for (let x = 0; x < Math.min(6, width); x++) {
      const idx = (y * width + x) * 4;
      bgSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
    for (let x = Math.max(0, width - 6); x < width; x++) {
      const idx = (y * width + x) * 4;
      bgSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
  }

  let sumR = 0, sumG = 0, sumB = 0;
  for (const s of bgSamples) {
    sumR += s.r;
    sumG += s.g;
    sumB += s.b;
  }
  const meanR = sumR / bgSamples.length;
  const meanG = sumG / bgSamples.length;
  const meanB = sumB / bgSamples.length;

  const tolSq = tolerance * tolerance * 3.2;

  if (onProgress) onProgress('কাটআউট তৈরি হচ্ছে...', 65);
  await yieldToMain();

  // 2. BFS Flood Fill Mask
  const mask = new Uint8Array(width * height);
  const queue: number[] = [];

  const isBgColor = (r: number, g: number, b: number) => {
    const dr = r - meanR;
    const dg = g - meanG;
    const db = b - meanB;
    return dr * dr + dg * dg + db * db < tolSq;
  };

  for (let x = 0; x < width; x++) {
    const i = x * 4;
    if (isBgColor(data[i], data[i + 1], data[i + 2])) {
      mask[x] = 1;
      queue.push(x);
    }
  }

  for (let y = 1; y < maxBorderY; y++) {
    const leftIdx = (y * width) * 4;
    const rightIdx = (y * width + (width - 1)) * 4;
    const lPos = y * width;
    const rPos = y * width + (width - 1);

    if (isBgColor(data[leftIdx], data[leftIdx + 1], data[leftIdx + 2])) {
      mask[lPos] = 1;
      queue.push(lPos);
    }
    if (isBgColor(data[rightIdx], data[rightIdx + 1], data[rightIdx + 2])) {
      mask[rPos] = 1;
      queue.push(rPos);
    }
  }

  let head = 0;
  const maxHead = width * height;
  let lastYield = performance.now();

  while (head < queue.length && head < maxHead) {
    if (head % 4000 === 0 && performance.now() - lastYield > 10) {
      await yieldToMain();
      lastYield = performance.now();
    }

    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    const cIdx = curr * 4;
    const cr = data[cIdx];
    const cg = data[cIdx + 1];
    const cb = data[cIdx + 2];

    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx < width - 1 ? curr + 1 : -1,
      cy > 0 ? curr - width : -1,
      cy < height - 1 ? curr + width : -1,
    ];

    for (const n of neighbors) {
      if (n === -1 || mask[n] !== 0) continue;

      const nIdx = n * 4;
      const nr = data[nIdx];
      const ng = data[nIdx + 1];
      const nb = data[nIdx + 2];

      const dmr = nr - meanR;
      const dmg = ng - meanG;
      const dmb = nb - meanB;
      const distMeanSq = dmr * dmr + dmg * dmg + dmb * dmb;

      const dr = nr - cr;
      const dg = ng - cg;
      const db = nb - cb;
      const localDistSq = dr * dr + dg * dg + db * db;

      const nx = n % width;
      const ny = Math.floor(n / width);
      const isCenterPortrait =
        nx > width * 0.25 &&
        nx < width * 0.75 &&
        ny > height * 0.2 &&
        ny < height * 0.85;

      const effectiveTolSq = isCenterPortrait ? tolSq * 0.85 : tolSq * 1.15;

      if (distMeanSq < effectiveTolSq && localDistSq < 1200) {
        mask[n] = 1;
        queue.push(n);
      }
    }
  }

  if (onProgress) onProgress('প্রান্ত স্মুথ করা হচ্ছে...', 85);
  await yieldToMain();

  // 3. Apply Alpha Mask with Feathering
  for (let y = 0; y < height; y++) {
    if (y % 80 === 0 && performance.now() - lastYield > 10) {
      await yieldToMain();
      lastYield = performance.now();
    }

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;

      if (mask[idx] === 1) {
        let hasForegroundNeighbor = false;
        if (feather > 0) {
          for (let dy = -feather; dy <= feather && !hasForegroundNeighbor; dy++) {
            for (let dx = -feather; dx <= feather; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (mask[ny * width + nx] === 0) {
                  hasForegroundNeighbor = true;
                  break;
                }
              }
            }
          }
        }

        if (hasForegroundNeighbor) {
          data[pixelIdx + 3] = Math.round(data[pixelIdx + 3] * 0.25);
        } else {
          data[pixelIdx + 3] = 0;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // If scaled, restore to original dimensions
  if (scale < 1.0) {
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = origWidth;
    fullCanvas.height = origHeight;
    const fullCtx = fullCanvas.getContext('2d');
    if (fullCtx) {
      fullCtx.imageSmoothingEnabled = true;
      fullCtx.imageSmoothingQuality = 'high';
      fullCtx.drawImage(canvas, 0, 0, origWidth, origHeight);
      return new Promise<Blob>((resolve, reject) => {
        fullCanvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to export fast matting blob'));
          },
          'image/png'
        );
      });
    }
  }

  if (onProgress) onProgress('সম্পন্ন!', 100);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export fast matting blob'));
      },
      'image/png'
    );
  });
}
