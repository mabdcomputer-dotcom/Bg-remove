import { removeBackground, preload, Config } from '@imgly/background-removal';
import { fastRemoveBackground } from './fastMatting';

export type RemovalEngine = 'ai' | 'fast';

export interface BgRemovalProgressCallback {
  (stage: string, percent: number): void;
}

export interface BgRemovalOptions {
  engine?: RemovalEngine;
  tolerance?: number;
  solidifySubject?: boolean;
  removeSecondaryObjects?: boolean;
  fillHoles?: boolean;
  refineHairAndEar?: boolean;
  edgeFinishingLevel?: 'soft' | 'crisp' | 'silky';
  originalImageSource?: File | Blob | string;
  onProgress?: BgRemovalProgressCallback;
}

const PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

/**
 * Preload the AI segmentation model into browser cache on app boot
 */
export function preloadModel(): void {
  try {
    preload({
      publicPath: PUBLIC_PATH,
      model: 'isnet_quint8',
      device: 'cpu',
      debug: false,
    }).catch((err) => {
      console.warn('Background model preload background note:', err);
    });
  } catch (e) {
    console.warn('Preload initialization warning:', e);
  }
}

/**
 * Professional Edge Finishing & Defringing Pass:
 * - Eliminates jagged, staircase, pixelated contours around ears, jawline, and shoulders via sub-pixel anti-aliasing.
 * - Restores organic hair wisps and delicate strands with smooth alpha transitions.
 * - Eradicates background color bleeding (green spill, bright glare, halos) by extending nearby solid subject
 *   color (hair/skin) into semi-transparent border pixels.
 */
export function applyHairAndEarFinishing(
  d: Uint8ClampedArray,
  W: number,
  H: number,
  objMinX: number,
  objMaxX: number,
  objMinY: number,
  objMaxY: number,
  headBottomY: number,
  level: 'soft' | 'crisp' | 'silky' = 'crisp'
): void {
  // Snapshot of current alphas before finishing pass
  const alphaSnapshot = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    alphaSnapshot[i] = d[i * 4 + 3];
  }

  const startY = Math.max(1, objMinY - 6);
  const endY = Math.min(H - 2, objMaxY + 6);
  const startX = Math.max(1, objMinX - 6);
  const endX = Math.min(W - 2, objMaxX + 6);

  // Pass 1: Edge boundary alpha refinement and background noise eradication
  for (let y = startY; y <= endY; y++) {
    const isHeadArea = y <= headBottomY;
    const rowOffset = y * W;

    for (let x = startX; x <= endX; x++) {
      const curIdx = (rowOffset + x) * 4;
      const curA = alphaSnapshot[rowOffset + x];

      // Clean background speckles
      if (curA === 0) continue;

      if (curA < 18) {
        d[curIdx + 3] = 0;
        continue;
      }

      // Check neighborhood
      let solidNeighborCount = 0;
      let hasZeroNeighbor = false;

      for (let dy = -1; dy <= 1; dy++) {
        const nRow = (y + dy) * W;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nA = alphaSnapshot[nRow + (x + dx)];
          if (nA >= 210) solidNeighborCount++;
          if (nA === 0) hasZeroNeighbor = true;
        }
      }

      // Purge floating isolated noise in background
      if (solidNeighborCount === 0 && curA < 120) {
        d[curIdx + 3] = 0;
        continue;
      }

      // Ultra-Clear Crisp Edge Tuning ("ekdm clear"):
      if (curA < 255) {
        if (level === 'crisp') {
          // If pixel has strong subject presence or is surrounded by solid pixels -> 100% solid
          if (curA >= 45 || solidNeighborCount >= 3) {
            d[curIdx + 3] = 255;
          } else if (curA < 20) {
            d[curIdx + 3] = 0;
          } else {
            // Tight, razor-sharp 1-pixel anti-aliasing curve
            const t = (curA - 20) / (45 - 20);
            d[curIdx + 3] = Math.round(t * t * (3 - 2 * t) * 255);
          }
        } else if (level === 'soft') {
          if (curA >= 70 || solidNeighborCount >= 4) {
            d[curIdx + 3] = 255;
          } else if (curA < 18) {
            d[curIdx + 3] = 0;
          } else {
            const t = (curA - 18) / (70 - 18);
            d[curIdx + 3] = Math.round(t * t * (3 - 2 * t) * 255);
          }
        } else {
          // Silky: fine delicate hair wisps
          if (curA >= 90 || solidNeighborCount >= 5) {
            d[curIdx + 3] = 255;
          } else if (curA < 15) {
            d[curIdx + 3] = 0;
          }
        }
      }
    }
  }

  // Pass 2: Deep Color Defringing & Halo Decontamination
  // Replaces leftover background halo (green, white glare, shadows) with true subject colors
  const searchRadius = 2; // 5x5 inspection window
  for (let y = startY; y <= endY; y++) {
    const isHeadArea = y <= headBottomY;
    const rowOffset = y * W;

    for (let x = startX; x <= endX; x++) {
      const curIdx = (rowOffset + x) * 4;
      const finalA = d[curIdx + 3];

      if (finalA === 0) continue;

      // Check if this pixel is on the perimeter edge (either semi-transparent or touches transparency)
      const origA = alphaSnapshot[rowOffset + x];
      const isPerimeter = origA < 254;

      if (!isPerimeter) {
        // Quick boundary check for fully opaque pixels right next to background
        let touchesEmpty = false;
        for (let dy = -1; dy <= 1 && !touchesEmpty; dy++) {
          const nRow = (y + dy) * W;
          for (let dx = -1; dx <= 1; dx++) {
            if (alphaSnapshot[nRow + (x + dx)] === 0) {
              touchesEmpty = true;
              break;
            }
          }
        }
        if (!touchesEmpty) continue;
      }

      // Sample neighboring solid subject pixels for true pigment (hair, skin, cloth)
      let solidR = 0;
      let solidG = 0;
      let solidB = 0;
      let solidWeight = 0;

      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const nY = y + dy;
        if (nY < 0 || nY >= H) continue;
        const nRow = nY * W;

        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nX = x + dx;
          if (nX < 0 || nX >= W) continue;

          const nA = alphaSnapshot[nRow + nX];
          if (nA >= 215) {
            const nIdx = (nRow + nX) * 4;
            const distSq = dx * dx + dy * dy;
            const w = 1.0 / Math.sqrt(distSq);
            solidR += d[nIdx] * w;
            solidG += d[nIdx + 1] * w;
            solidB += d[nIdx + 2] * w;
            solidWeight += w;
          }
        }
      }

      if (solidWeight > 0) {
        const avgR = solidR / solidWeight;
        const avgG = solidG / solidWeight;
        const avgB = solidB / solidWeight;

        // Defringe strength: hair & ears get maximum defringe to completely eliminate background halos
        const defringeStrength = isHeadArea ? 0.85 : 0.65;
        d[curIdx] = Math.round(d[curIdx] * (1 - defringeStrength) + avgR * defringeStrength);
        d[curIdx + 1] = Math.round(d[curIdx + 1] * (1 - defringeStrength) + avgG * defringeStrength);
        d[curIdx + 2] = Math.round(d[curIdx + 2] * (1 - defringeStrength) + avgB * defringeStrength);
      }
    }
  }
}

/**
 * Advanced Computer Vision Post-Processing:
 * 1. Isolates the PRIMARY / MAIN salient subject.
 * 2. Detects and eliminates detached 2nd objects, secondary background people, or clutter.
 * 3. Fills internal holes inside clothing, torsos, arms, or faces using exterior flood-fill.
 * 4. Solidifies the main object's core with full 100% opacity while preserving anti-aliased natural edges.
 * 5. Hair & Ear edge finishing pass with sub-pixel anti-aliasing and color defringing.
 */
export async function isolateAndSolidifyMainObject(
  blob: Blob,
  originalSource?: File | Blob | string | null,
  configOptions?: {
    removeSecondaryObjects?: boolean;
    fillHoles?: boolean;
    refineHairAndEar?: boolean;
    edgeFinishingLevel?: 'soft' | 'crisp' | 'silky';
  }
): Promise<Blob> {
  const removeSecondary = configOptions?.removeSecondaryObjects !== false;
  const fillHoles = configOptions?.fillHoles !== false;
  const refineHairAndEar = configOptions?.refineHairAndEar !== false;
  const edgeFinishingLevel = configOptions?.edgeFinishingLevel || 'silky';

  return new Promise((resolve) => {
    const cutoutImg = new Image();
    const cutoutUrl = URL.createObjectURL(blob);

    cutoutImg.onload = async () => {
      try {
        const W = cutoutImg.naturalWidth || cutoutImg.width;
        const H = cutoutImg.naturalHeight || cutoutImg.height;

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          URL.revokeObjectURL(cutoutUrl);
          resolve(blob);
          return;
        }

        ctx.drawImage(cutoutImg, 0, 0);
        const imgData = ctx.getImageData(0, 0, W, H);
        const d = imgData.data;

        // Optionally load original image to restore RGB in filled holes
        let origData: Uint8ClampedArray | null = null;
        if (originalSource && fillHoles) {
          try {
            const origImg = new Image();
            let origUrl = '';
            if (typeof originalSource === 'string') {
              origUrl = originalSource;
            } else {
              origUrl = URL.createObjectURL(originalSource);
            }
            await new Promise<void>((res) => {
              origImg.onload = () => res();
              origImg.onerror = () => res();
              origImg.src = origUrl;
            });
            const origCanvas = document.createElement('canvas');
            origCanvas.width = W;
            origCanvas.height = H;
            const origCtx = origCanvas.getContext('2d', { willReadFrequently: true });
            if (origCtx) {
              origCtx.drawImage(origImg, 0, 0, W, H);
              origData = origCtx.getImageData(0, 0, W, H).data;
            }
            if (typeof originalSource !== 'string' && origUrl) {
              URL.revokeObjectURL(origUrl);
            }
          } catch (e) {
            // non-fatal
          }
        }

        // Downscaled grid for fast, accurate connected-component analysis
        const scale = Math.max(1, Math.min(4, Math.floor(Math.max(W, H) / 400)));
        const gw = Math.ceil(W / scale);
        const gh = Math.ceil(H / scale);

        const gridAlpha = new Uint8Array(gw * gh);
        for (let gy = 0; gy < gh; gy++) {
          const py = Math.min(H - 1, gy * scale);
          for (let gx = 0; gx < gw; gx++) {
            const px = Math.min(W - 1, gx * scale);
            const idx = (py * W + px) * 4;
            gridAlpha[gy * gw + gx] = d[idx + 3];
          }
        }

        // 1. Connected Component Labeling
        const labels = new Int32Array(gw * gh);
        let currentLabel = 0;

        interface CompData {
          id: number;
          size: number;
          minX: number;
          maxX: number;
          minY: number;
          maxY: number;
          sumX: number;
          sumY: number;
          score: number;
        }
        const components: CompData[] = [];

        for (let gy = 0; gy < gh; gy++) {
          for (let gx = 0; gx < gw; gx++) {
            const pos = gy * gw + gx;
            if (gridAlpha[pos] >= 35 && labels[pos] === 0) {
              currentLabel++;
              let size = 0;
              let minX = gx;
              let maxX = gx;
              let minY = gy;
              let maxY = gy;
              let sumX = 0;
              let sumY = 0;

              // BFS
              const queue: number[] = [pos];
              labels[pos] = currentLabel;

              while (queue.length > 0) {
                const cur = queue.pop()!;
                const cy = Math.floor(cur / gw);
                const cx = cur % gw;

                size++;
                sumX += cx;
                sumY += cy;
                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                if (cy > maxY) maxY = cy;

                // 4 neighbors
                const neighbors = [
                  cx > 0 ? cur - 1 : -1,
                  cx < gw - 1 ? cur + 1 : -1,
                  cy > 0 ? cur - gw : -1,
                  cy < gh - 1 ? cur + gw : -1,
                ];

                for (const n of neighbors) {
                  if (n >= 0 && labels[n] === 0 && gridAlpha[n] >= 35) {
                    labels[n] = currentLabel;
                    queue.push(n);
                  }
                }
              }

              // Compute saliency score: favor central, prominent, bottom-anchored subjects
              const centerX = sumX / size;
              const centerY = sumY / size;
              const distFromCenterX = Math.abs(centerX - gw / 2) / (gw / 2);
              const isAnchoredBottom = maxY >= gh - Math.max(3, Math.floor(gh * 0.05));
              const centerWeight = Math.max(0.2, 1 - distFromCenterX * 0.45);
              const bottomWeight = isAnchoredBottom ? 1.35 : 1.0;
              const score = size * centerWeight * bottomWeight;

              components.push({
                id: currentLabel,
                size,
                minX,
                maxX,
                minY,
                maxY,
                sumX,
                sumY,
                score,
              });
            }
          }
        }

        // Determine which components to keep
        const keepMask = new Uint8Array(gw * gh);
        let mainComp: CompData | null = null;
        const discardedCompIds = new Set<number>();

        if (components.length > 0) {
          // Sort descending by score -> 1st is the Main Object
          components.sort((a, b) => b.score - a.score);
          mainComp = components[0];

          // Components to approve
          const approvedCompIds = new Set<number>([mainComp.id]);

          if (removeSecondary) {
            // Filter out secondary objects / 2nd people in the background
            for (let i = 1; i < components.length; i++) {
              const comp = components[i];
              // Distance to main component
              const distX = Math.max(0, Math.max(comp.minX - mainComp.maxX, mainComp.minX - comp.maxX));
              const distY = Math.max(0, Math.max(comp.minY - mainComp.maxY, mainComp.minY - comp.maxY));
              const gap = Math.sqrt(distX * distX + distY * distY);

              // If detached and in background, remove!
              // Only keep if it is extremely close (e.g. arm or collar) and not an isolated background subject
              const isClose = gap <= Math.max(5, Math.floor(gw * 0.025));
              const isSignificant = comp.size >= mainComp.size * 0.02;
              const isSecondaryPersonOrBackground =
                gap > Math.max(4, Math.floor(gw * 0.02)) || comp.size > mainComp.size * 0.55;

              // If gap exists, it is a 2nd background object/person -> REMOVE
              if (isClose && isSignificant && !isSecondaryPersonOrBackground) {
                approvedCompIds.add(comp.id);
              }
            }
          } else {
            // Keep all components
            components.forEach((c) => approvedCompIds.add(c.id));
          }

          // Collect discarded secondary component IDs
          if (removeSecondary) {
            for (let i = 1; i < components.length; i++) {
              if (!approvedCompIds.has(components[i].id)) {
                discardedCompIds.add(components[i].id);
              }
            }
          }

          // Populate initial keepMask
          for (let i = 0; i < labels.length; i++) {
            if (labels[i] > 0 && approvedCompIds.has(labels[i])) {
              keepMask[i] = 1;
            }
          }

          // 2. Hole-Filling ("main object full hobe")
          if (fillHoles) {
            // Flood fill from exterior borders (where keepMask is 0)
            const reachable = new Uint8Array(gw * gh);
            const borderQueue: number[] = [];

            // Add all boundary cells with keepMask === 0
            for (let x = 0; x < gw; x++) {
              const top = x;
              const btm = (gh - 1) * gw + x;
              if (keepMask[top] === 0 && reachable[top] === 0) {
                reachable[top] = 1;
                borderQueue.push(top);
              }
              if (keepMask[btm] === 0 && reachable[btm] === 0) {
                reachable[btm] = 1;
                borderQueue.push(btm);
              }
            }
            for (let y = 0; y < gh; y++) {
              const lft = y * gw;
              const rgt = y * gw + (gw - 1);
              if (keepMask[lft] === 0 && reachable[lft] === 0) {
                reachable[lft] = 1;
                borderQueue.push(lft);
              }
              if (keepMask[rgt] === 0 && reachable[rgt] === 0) {
                reachable[rgt] = 1;
                borderQueue.push(rgt);
              }
            }

            // Propagate exterior background
            while (borderQueue.length > 0) {
              const cur = borderQueue.pop()!;
              const cy = Math.floor(cur / gw);
              const cx = cur % gw;

              const neighbors = [
                cx > 0 ? cur - 1 : -1,
                cx < gw - 1 ? cur + 1 : -1,
                cy > 0 ? cur - gw : -1,
                cy < gh - 1 ? cur + gw : -1,
              ];

              for (const n of neighbors) {
                if (n >= 0 && keepMask[n] === 0 && reachable[n] === 0) {
                  reachable[n] = 1;
                  borderQueue.push(n);
                }
              }
            }

            // Any cell not reachable from border is an INTERNAL HOLE inside the main object -> FILL IT!
            for (let i = 0; i < keepMask.length; i++) {
              if (keepMask[i] === 0 && reachable[i] === 0) {
                keepMask[i] = 2; // 2 indicates filled internal hole
              }
            }
          }
        }

        // Calculate bounding box and head/ear zone for hair/ear refinement
        const objMinX = mainComp ? Math.max(0, mainComp.minX * scale) : 0;
        const objMaxX = mainComp ? Math.min(W - 1, (mainComp.maxX + 1) * scale) : W - 1;
        const objMinY = mainComp ? Math.max(0, mainComp.minY * scale) : 0;
        const objMaxY = mainComp ? Math.min(H - 1, (mainComp.maxY + 1) * scale) : H - 1;
        const objH = Math.max(1, objMaxY - objMinY);
        const headBottomY = Math.round(objMinY + objH * 0.44);

        // 3. Apply back to high-resolution Image Data (Native 1:1 Pixel Processing)
        for (let y = 0; y < H; y++) {
          const gy = Math.min(gh - 1, Math.floor(y / scale));
          const rowOffset = gy * gw;
          const isHeadOrHair = y <= headBottomY;

          for (let x = 0; x < W; x++) {
            const gx = Math.min(gw - 1, Math.floor(x / scale));
            const gPos = rowOffset + gx;
            const maskVal = keepMask[gPos];
            const cellLabel = labels[gPos];
            const idx = (y * W + x) * 4;
            const originalAlpha = d[idx + 3];

            // A. Detached secondary background person or object -> remove completely
            if (cellLabel > 0 && discardedCompIds.has(cellLabel)) {
              d[idx + 3] = 0;
              continue;
            }

            // B. Internal hole inside clothing/body -> fill completely full & solid!
            if (maskVal === 2) {
              d[idx + 3] = 255;
              if (origData && originalAlpha < 30) {
                d[idx] = origData[idx];
                d[idx + 1] = origData[idx + 1];
                d[idx + 2] = origData[idx + 2];
              }
              continue;
            }

            // C. Native High-Resolution Alpha Refinement (No blocky clipping!)
            // Background noise purge
            if (originalAlpha < 18) {
              d[idx + 3] = 0;
            } else if (originalAlpha >= (isHeadOrHair ? 45 : 55)) {
              // 100% solid core for subject (clothing, body, hair, face)
              d[idx + 3] = 255;
            } else {
              // Sub-pixel smooth anti-aliased edge (not pixelated, not blurry)
              const low = 18;
              const high = isHeadOrHair ? 45 : 55;
              const t = (originalAlpha - low) / (high - low);
              d[idx + 3] = Math.round(t * t * (3 - 2 * t) * 255);
            }
          }
        }

        // 4. Hair, Ear & Edge Finishing Pass (Sub-Pixel Anti-Aliasing & Color Defringing)
        if (refineHairAndEar) {
          applyHairAndEarFinishing(
            d,
            W,
            H,
            objMinX,
            objMaxX,
            objMinY,
            objMaxY,
            headBottomY,
            edgeFinishingLevel
          );
        }

        ctx.putImageData(imgData, 0, 0);

        canvas.toBlob(
          (processedBlob) => {
            URL.revokeObjectURL(cutoutUrl);
            resolve(processedBlob || blob);
          },
          'image/png',
          1.0
        );
      } catch (err) {
        console.warn('Error during main object isolation & solidification:', err);
        URL.revokeObjectURL(cutoutUrl);
        resolve(blob);
      }
    };

    cutoutImg.onerror = () => {
      URL.revokeObjectURL(cutoutUrl);
      resolve(blob);
    };

    cutoutImg.src = cutoutUrl;
  });
}

/**
 * Legacy alias for backwards compatibility
 */
export async function solidifyCutout(blob: Blob): Promise<Blob> {
  return isolateAndSolidifyMainObject(blob);
}

/**
 * Removes background solidly keeping only the main object,
 * using the State-of-the-Art IS-Net Neural Model.
 */
export async function removeImageBackground(
  imageSource: File | Blob | string,
  options?: BgRemovalOptions | BgRemovalProgressCallback
): Promise<Blob> {
  // Normalize options - default to AI engine for real, accurate segmentation
  let engine: RemovalEngine = 'ai';
  let tolerance = 36;
  let solidify = true;
  let removeSecondaryObjects = true;
  let fillHoles = true;
  let refineHairAndEar = true;
  let edgeFinishingLevel: 'soft' | 'crisp' | 'silky' = 'crisp';
  let onProgress: BgRemovalProgressCallback | undefined;

  if (typeof options === 'function') {
    onProgress = options;
  } else if (options) {
    if (options.engine) engine = options.engine;
    if (options.tolerance !== undefined) tolerance = options.tolerance;
    if (options.solidifySubject !== undefined) solidify = options.solidifySubject;
    if (options.removeSecondaryObjects !== undefined) removeSecondaryObjects = options.removeSecondaryObjects;
    if (options.fillHoles !== undefined) fillHoles = options.fillHoles;
    if (options.refineHairAndEar !== undefined) refineHairAndEar = options.refineHairAndEar;
    if (options.edgeFinishingLevel) edgeFinishingLevel = options.edgeFinishingLevel;
    if (options.onProgress) onProgress = options.onProgress;
  }

  // 1. Precision AI Deep Neural Segmentation (DEFAULT)
  if (engine === 'ai') {
    if (onProgress) onProgress('এআই মডেল প্রস্তুত হচ্ছে...', 10);

    const config: Config = {
      publicPath: PUBLIC_PATH,
      model: 'isnet_quint8',
      device: 'cpu',
      rescale: true,
      proxyToWorker: false,
      debug: false,
      output: {
        format: 'image/png',
        quality: 1.0,
      },
      progress: (key: string, current: number, total: number) => {
        if (!onProgress) return;
        let stageName = 'প্রসেসিং হচ্ছে...';
        let pct = 30;

        if (key.includes('fetch') || key.includes('download')) {
          const dlPct = total > 0 ? Math.round((current / total) * 100) : 40;
          stageName = `এআই মডেল লোড হচ্ছে... (${dlPct}%)`;
          pct = Math.min(65, Math.max(10, Math.round(dlPct * 0.65)));
        } else if (key.includes('compute') || key.includes('inference')) {
          stageName = 'মূল অবজেক্ট আলাদা করা হচ্ছে...';
          pct = 75;
        } else {
          stageName = 'প্রান্ত ও কাটআউট নিখুঁত করা হচ্ছে...';
          pct = 88;
        }
        onProgress(stageName, pct);
      },
    };

    try {
      if (onProgress) onProgress('মূল অবজেক্ট স্ক্যান ও ব্যাকগ্রাউন্ড রিমুভ হচ্ছে...', 35);
      const rawBlob = await removeBackground(imageSource, config);

      if (onProgress) onProgress('চুল, কান ও সাইডের এজ ফিনিশিং নিখুঁত করা হচ্ছে...', 93);
      const finalBlob = solidify
        ? await isolateAndSolidifyMainObject(rawBlob, imageSource, {
            removeSecondaryObjects,
            fillHoles,
            refineHairAndEar,
            edgeFinishingLevel,
          })
        : rawBlob;

      if (onProgress) onProgress('সম্পন্ন! নিখুঁত ফিনিশিং প্রস্তুত।', 100);
      return finalBlob;
    } catch (aiError) {
      console.warn('AI neural removal encountered an issue, running local matting fallback:', aiError);
      if (onProgress) onProgress('বিকল্প ইঞ্জিনে ব্যাকগ্রাউন্ড আলাদা হচ্ছে...', 50);

      const fallbackBlob = await fastRemoveBackground(imageSource, {
        tolerance,
        feather: 2,
        onProgress: (stage, pct) => {
          if (onProgress) onProgress(stage, pct);
        },
      });

      const processedFallback = solidify
        ? await isolateAndSolidifyMainObject(fallbackBlob, imageSource, {
            removeSecondaryObjects,
            fillHoles,
            refineHairAndEar,
            edgeFinishingLevel,
          })
        : fallbackBlob;

      if (onProgress) onProgress('সম্পন্ন!', 100);
      return processedFallback;
    }
  }

  // 2. Fast heuristic matting engine (only when explicitly requested)
  if (onProgress) onProgress('ইনস্ট্যান্ট ম্যাটিং প্রসেসিং হচ্ছে...', 25);
  const blob = await fastRemoveBackground(imageSource, {
    tolerance,
    feather: 2,
    onProgress: (stage, pct) => {
      if (onProgress) onProgress(stage, pct);
    },
  });

  const finalBlob = solidify
    ? await isolateAndSolidifyMainObject(blob, imageSource, {
        removeSecondaryObjects,
        fillHoles,
        refineHairAndEar,
        edgeFinishingLevel,
      })
    : blob;
  if (onProgress) onProgress('সম্পন্ন!', 100);
  return finalBlob;
}

/**
 * Interactive utility to re-apply hair and ear edge finishing directly to an existing cutout Blob.
 */
export async function refineCutoutEdges(
  cutoutSource: Blob | string,
  level: 'soft' | 'crisp' | 'silky' = 'silky'
): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = typeof cutoutSource === 'string' ? cutoutSource : URL.createObjectURL(cutoutSource);

    img.onload = () => {
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        if (typeof cutoutSource !== 'string') URL.revokeObjectURL(url);
        resolve(cutoutSource as Blob);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, W, H);
      const d = imgData.data;

      // Find bounding box of cutout subject
      let minX = W;
      let maxX = 0;
      let minY = H;
      let maxY = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (d[(y * W + x) * 4 + 3] > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (minX < maxX && minY < maxY) {
        const headBottomY = Math.round(minY + (maxY - minY) * 0.44);
        applyHairAndEarFinishing(d, W, H, minX, maxX, minY, maxY, headBottomY, level);
        ctx.putImageData(imgData, 0, 0);
      }

      canvas.toBlob((b) => {
        if (typeof cutoutSource !== 'string') URL.revokeObjectURL(url);
        resolve(b || (cutoutSource as Blob));
      }, 'image/png');
    };

    img.onerror = () => {
      if (typeof cutoutSource !== 'string') URL.revokeObjectURL(url);
      resolve(cutoutSource as Blob);
    };

    img.src = url;
  });
}
