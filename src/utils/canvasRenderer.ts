import {
  BackgroundType,
  GradientPreset,
  SubjectAdjustments,
  CropPreset,
} from '../types';

export interface RenderCanvasOptions {
  canvas: HTMLCanvasElement;
  cutoutImg?: HTMLImageElement | null;
  originalImg?: HTMLImageElement | null;
  bgType: BackgroundType;
  solidColor: string;
  gradientPreset?: GradientPreset | null;
  customBgImg?: HTMLImageElement | null;
  blurAmount?: number; // e.g. 15
  adjustments: SubjectAdjustments;
  cropPreset: CropPreset;
  zoom?: number; // 1 to 2
  panX?: number; // offset in px
  panY?: number; // offset in px
}

/**
 * Calculates the bounding box coordinates for a given crop preset relative to image dimensions.
 */
export function calculateCropDimensions(
  imgWidth: number,
  imgHeight: number,
  cropPreset: CropPreset
): { x: number; y: number; width: number; height: number } {
  if (!cropPreset.ratio) {
    return { x: 0, y: 0, width: imgWidth, height: imgHeight };
  }

  const targetRatio = cropPreset.ratio;
  const currentRatio = imgWidth / imgHeight;

  let width = imgWidth;
  let height = imgHeight;

  if (currentRatio > targetRatio) {
    // Current is wider than target -> crop sides
    width = imgHeight * targetRatio;
  } else {
    // Current is taller than target -> crop top & bottom (or keep upper-middle for portrait)
    height = imgWidth / targetRatio;
  }

  // Center the crop box
  const x = Math.max(0, (imgWidth - width) / 2);
  // For portraits (passport), bias slightly higher towards head/face (e.g. 25% from top)
  const y = Math.max(0, (imgHeight - height) * 0.35);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Renders the composite result onto the target canvas at full resolution.
 */
export function renderCompositeToCanvas(options: RenderCanvasOptions): void {
  const {
    canvas,
    cutoutImg,
    originalImg,
    bgType,
    solidColor,
    gradientPreset,
    customBgImg,
    blurAmount = 20,
    adjustments,
    cropPreset,
    zoom = 1,
    panX = 0,
    panY = 0,
  } = options;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const subjectImg = cutoutImg || originalImg;
  if (!subjectImg) return;

  const originalWidth = subjectImg.naturalWidth || subjectImg.width || 800;
  const originalHeight = subjectImg.naturalHeight || subjectImg.height || 1000;

  if (originalWidth === 0 || originalHeight === 0) return;

  const crop = calculateCropDimensions(originalWidth, originalHeight, cropPreset);

  // Only re-dimension canvas if dimensions actually changed (avoids costly GPU context resets)
  if (canvas.width !== crop.width) {
    canvas.width = crop.width;
  }
  if (canvas.height !== crop.height) {
    canvas.height = crop.height;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // If cutout is not yet available (processing smoothly in background), render the original photo directly
  if (!cutoutImg && originalImg) {
    const z = Math.max(1, zoom);
    const zoomedCropW = crop.width / z;
    const zoomedCropH = crop.height / z;
    const srcX = Math.max(0, Math.min(originalWidth - zoomedCropW, crop.x - panX / z));
    const srcY = Math.max(0, Math.min(originalHeight - zoomedCropH, crop.y - panY / z));

    ctx.drawImage(
      originalImg,
      srcX,
      srcY,
      zoomedCropW,
      zoomedCropH,
      0,
      0,
      canvas.width,
      canvas.height
    );
    return;
  }

  // 1. Render Background Layer
  if (bgType === 'solid') {
    ctx.fillStyle = solidColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (bgType === 'gradient' && gradientPreset) {
    if (gradientPreset.canvasType === 'radial') {
      const centerX = canvas.width / 2;
      const centerY = canvas.height * 0.45;
      const radius = Math.max(canvas.width, canvas.height) * 0.75;
      const grad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius);
      gradientPreset.stops.forEach((s) => grad.addColorStop(s.offset, s.color));
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradientPreset.stops.forEach((s) => grad.addColorStop(s.offset, s.color));
      ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (bgType === 'blur' && originalImg) {
    // Draw original image with Gaussian blur
    ctx.save();
    ctx.filter = `blur(${blurAmount}px)`;
    // Scale slightly to hide blurred edges
    const scale = 1.08;
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    const drawX = (canvas.width - drawW) / 2;
    const drawY = (canvas.height - drawH) / 2;

    ctx.drawImage(
      originalImg,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      drawX,
      drawY,
      drawW,
      drawH
    );
    ctx.restore();

    // Subtle dark tint over blur for contrast
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (bgType === 'custom_image' && customBgImg) {
    // Cover the canvas with custom image
    const bgW = customBgImg.naturalWidth || customBgImg.width;
    const bgH = customBgImg.naturalHeight || customBgImg.height;
    const scale = Math.max(canvas.width / bgW, canvas.height / bgH);
    const w = bgW * scale;
    const h = bgH * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.drawImage(customBgImg, x, y, w, h);
  } else if (bgType === 'transparent') {
    // Transparent background - keep empty
  }

  // 2. Render Drop Shadow (if enabled and not transparent)
  ctx.save();
  if (adjustments.hasShadow && bgType !== 'transparent') {
    ctx.shadowColor = `rgba(0, 0, 0, ${adjustments.shadowOpacity || 0.4})`;
    ctx.shadowBlur = adjustments.shadowBlur || 24;
    ctx.shadowOffsetY = 12;
    ctx.shadowOffsetX = 0;
  }

  // 3. Render Cutout Subject Layer
  // Subject adjustments: brightness, contrast, saturate (no blur to ensure razor-sharp crisp cut)
  const bVal = 100 + adjustments.brightness;
  const cVal = 100 + adjustments.contrast;
  const sVal = 100 + adjustments.saturation;

  // Pure color/tonal filter - zero blur to keep hair, ears, and subject 100% crisp and unblurred
  ctx.filter = `brightness(${bVal}%) contrast(${cVal}%) saturate(${sVal}%)`;

  // Compute position with optional pan & zoom
  const z = Math.max(1, zoom);
  const zoomedCropW = crop.width / z;
  const zoomedCropH = crop.height / z;
  const srcX = Math.max(0, Math.min(originalWidth - zoomedCropW, crop.x - panX / z));
  const srcY = Math.max(0, Math.min(originalHeight - zoomedCropH, crop.y - panY / z));

  ctx.drawImage(
    cutoutImg,
    srcX,
    srcY,
    zoomedCropW,
    zoomedCropH,
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.restore();
}

/**
 * Downloads canvas as an image file at full resolution.
 * When saving as JPEG, transparent pixels are composited onto a clean white background
 * so that transparent cutouts never turn black.
 */
export function downloadCanvasImage(
  canvas: HTMLCanvasElement,
  filename: string,
  format: 'png' | 'jpeg' | 'webp' = 'jpeg',
  quality = 0.98,
  fallbackBgColor = '#ffffff'
): void {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const cleanBaseName = filename.replace(/\.[^/.]+$/, '');
  const downloadName = `${cleanBaseName}-studio-bg.${format === 'jpeg' ? 'jpg' : format}`;

  let targetCanvas: HTMLCanvasElement = canvas;

  if (format === 'jpeg') {
    // HTML5 Canvas directly to JPEG turns transparent pixels pitch black.
    // We compose onto a clean white background to guarantee a pristine, professional result.
    const jpgCanvas = document.createElement('canvas');
    jpgCanvas.width = canvas.width;
    jpgCanvas.height = canvas.height;
    const ctx = jpgCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = fallbackBgColor;
      ctx.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
      ctx.drawImage(canvas, 0, 0);
      targetCanvas = jpgCanvas;
    }
  }

  targetCanvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    mimeType,
    quality
  );
}
