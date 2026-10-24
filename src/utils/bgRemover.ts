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
  edgeFinishingLevel?: 'removebg_smooth' | 'soft' | 'crisp' | 'silky';
  removalStrength?: 'ultra' | 'strong' | 'balanced';
  edgeShift?: number;
  purgeWhiteHalo?: boolean;
  originalImageSource?: File | Blob | string;
  onProgress?: BgRemovalProgressCallback;
}

const PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

/**
 * Preload the AI segmentation model into browser cache on app boot
 * Uses high-precision isnet_fp16 model for sharpest, error-free segmentation
 */
export function preloadModel(): void {
  try {
    preload({
      publicPath: PUBLIC_PATH,
      model: 'isnet_fp16',
      device: 'cpu',
      debug: false,
    }).catch((err) => {
      console.warn('Background model preload note:', err);
    });
  } catch (e) {
    console.warn('Preload initialization warning:', e);
  }
}

/**
 * Remove.bg-Grade Hair & Ear Matting, White Halo Eradication & Color Decontamination:
 * - White & Light Background Halo Eradication: Completely purges bright calendar, wall, and poster bleeding
 *   from ear contours, hair edges, and body perimeters.
 * - Sub-pixel contour anti-aliasing: eliminates jagged, staircase pixelation around ears, neck, jawline, and shoulders.
 * - 100% Pure Foreground Color Decontamination: replaces contaminated boundary pixels with the true foreground pigment
 *   (dark hair, warm skin, or clothing) with ZERO residual white or gray bleed.
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
  level: 'removebg_smooth' | 'soft' | 'crisp' | 'silky' = 'removebg_smooth',
  origData?: Uint8ClampedArray | null,
  edgeShift: number = 0,
  purgeWhiteHalo: boolean = true
): void {
  // Snapshot of current alphas before finishing pass
  const alphaSnapshot = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    alphaSnapshot[i] = d[i * 4 + 3];
  }

  const startY = Math.max(1, objMinY - 8);
  const endY = Math.min(H - 2, objMaxY + 8);
  const startX = Math.max(1, objMinX - 8);
  const endX = Math.min(W - 2, objMaxX + 8);

  const sourceRGB = origData || d;

  // 1. Fast Distance-to-Background Transform (0 to 6 pixels outward into the subject)
  const distToBg = new Int8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    distToBg[i] = alphaSnapshot[i] < 15 ? 0 : -1;
  }

  // Queue initial boundary background pixels (dist 0 touching subject)
  let queue: number[] = [];
  for (let y = 1; y < H - 1; y++) {
    const rowOffset = y * W;
    for (let x = 1; x < W - 1; x++) {
      const idx = rowOffset + x;
      if (distToBg[idx] === 0) {
        if (
          distToBg[idx - 1] === -1 ||
          distToBg[idx + 1] === -1 ||
          distToBg[idx - W] === -1 ||
          distToBg[idx + W] === -1
        ) {
          queue.push(idx);
        }
      }
    }
  }

  // Propagate distance field up to 6 pixels
  const maxDist = 6;
  for (let dist = 1; dist <= maxDist && queue.length > 0; dist++) {
    const nextQueue: number[] = [];
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i];
      const cy = Math.floor(cur / W);
      const cx = cur % W;

      if (cx > 0 && distToBg[cur - 1] === -1) {
        distToBg[cur - 1] = dist;
        nextQueue.push(cur - 1);
      }
      if (cx < W - 1 && distToBg[cur + 1] === -1) {
        distToBg[cur + 1] = dist;
        nextQueue.push(cur + 1);
      }
      if (cy > 0 && distToBg[cur - W] === -1) {
        distToBg[cur - W] = dist;
        nextQueue.push(cur - W);
      }
      if (cy < H - 1 && distToBg[cur + W] === -1) {
        distToBg[cur + W] = dist;
        nextQueue.push(cur + W);
      }
    }
    queue = nextQueue;
  }

  // Mark all unreached interior subject pixels as deep core (dist = 7)
  for (let i = 0; i < W * H; i++) {
    if (distToBg[i] === -1) {
      distToBg[i] = 7;
    }
  }

  // 2. Background Color & Lightness Profiling
  let sumBgR = 0;
  let sumBgG = 0;
  let sumBgB = 0;
  let countBg = 0;
  const sampleHeadEnd = Math.min(H - 1, Math.round(objMinY + (objMaxY - objMinY) * 0.65));
  const stepY = Math.max(1, Math.floor((sampleHeadEnd - objMinY) / 50));

  for (let y = Math.max(0, objMinY - 20); y <= sampleHeadEnd; y += stepY) {
    const rowOffset = y * W;
    for (let x = 0; x < W; x += 3) {
      const idx = rowOffset + x;
      if (distToBg[idx] === 0) {
        const p4 = idx * 4;
        sumBgR += sourceRGB[p4];
        sumBgG += sourceRGB[p4 + 1];
        sumBgB += sourceRGB[p4 + 2];
        countBg++;
      }
    }
  }

  const globalBgR = countBg > 0 ? sumBgR / countBg : 235;
  const globalBgG = countBg > 0 ? sumBgG / countBg : 235;
  const globalBgB = countBg > 0 ? sumBgB / countBg : 235;
  const globalBgL = 0.299 * globalBgR + 0.587 * globalBgG + 0.114 * globalBgB;
  const isLightBackground = globalBgL >= 160 || (globalBgR > 180 && globalBgG > 180);

  // Dedicated buffer for refined alpha
  const refinedAlpha = new Uint8Array(alphaSnapshot);

  // 3. Boundary Defringe & White Halo Eradication Pass
  const searchR = 5;
  for (let y = startY; y <= endY; y++) {
    const rowOffset = y * W;

    for (let x = startX; x <= endX; x++) {
      const curIdx = rowOffset + x;
      const curDist = distToBg[curIdx];

      // Pure background or deep core
      if (curDist <= 0) {
        refinedAlpha[curIdx] = 0;
        continue;
      }
      if (curDist >= 5) {
        continue;
      }

      const curIdx4 = curIdx * 4;
      const pR = sourceRGB[curIdx4];
      const pG = sourceRGB[curIdx4 + 1];
      const pB = sourceRGB[curIdx4 + 2];
      const pL = 0.299 * pR + 0.587 * pG + 0.114 * pB;
      const pWarmth = pR - pB;

      // Sample local solid foreground pigment (dist >= 3 and solid alpha)
      let solidR = 0;
      let solidG = 0;
      let solidB = 0;
      let solidW = 0;

      let localBgR = 0;
      let localBgG = 0;
      let localBgB = 0;
      let localBgW = 0;

      for (let dy = -searchR; dy <= searchR; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        const nRow = ny * W;
        for (let dx = -searchR; dx <= searchR; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          const nIdx = nRow + nx;
          const nDist = distToBg[nIdx];
          const distSq = dx * dx + dy * dy;
          const w = 1.0 / (1.0 + Math.sqrt(distSq));

          if (nDist >= 3 && alphaSnapshot[nIdx] >= 200) {
            const p4 = nIdx * 4;
            solidR += sourceRGB[p4] * w;
            solidG += sourceRGB[p4 + 1] * w;
            solidB += sourceRGB[p4 + 2] * w;
            solidW += w;
          } else if (nDist === 0) {
            const p4 = nIdx * 4;
            localBgR += sourceRGB[p4] * w;
            localBgG += sourceRGB[p4 + 1] * w;
            localBgB += sourceRGB[p4 + 2] * w;
            localBgW += w;
          }
        }
      }

      if (solidW === 0) {
        // Disconnected speck near boundary with no solid core
        refinedAlpha[curIdx] = 0;
        continue;
      }

      const fR = solidR / solidW;
      const fG = solidG / solidW;
      const fB = solidB / solidW;
      const fL = 0.299 * fR + 0.587 * fG + 0.114 * fB;
      const fWarmth = fR - fB;

      const bgR = localBgW > 0 ? localBgR / localBgW : globalBgR;
      const bgG = localBgW > 0 ? localBgG / localBgW : globalBgG;
      const bgB = localBgW > 0 ? localBgB / localBgW : globalBgB;
      const bgL = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

      let isWhiteHalo = false;
      let shouldErode = false;

      // Evaluation A: Dark Hair Zone (fL <= 85)
      if (fL <= 85) {
        if (pL > fL + 20) {
          isWhiteHalo = true;
          // Residual white calendar/wall paper touching hair
          if (pL >= 140 || pL > 0.68 * bgL) {
            if (curDist <= 2) shouldErode = true;
          }
          if (pL >= 185 && curDist <= 3) {
            shouldErode = true;
          }
        }
      }
      // Evaluation B: Ears, Face & Skin Zone (fWarmth >= 20, fR > fB, fR >= 85)
      else if (fWarmth >= 20 && fR > fB && fR >= 85) {
        // White calendar paper, poster edge, or light background bleed
        const isSkinBleed =
          pL > fL + 22 ||
          (pL >= 180 && pWarmth < 25) ||
          pL >= 195;

        if (isSkinBleed) {
          isWhiteHalo = true;
          // Trim white edge border around ear
          if (curDist <= 2) shouldErode = true;
          // Purge white poster artifact (e.g. corner behind ear)
          if (curDist <= 3 && pL >= 205 && pWarmth < 22) {
            shouldErode = true;
          }
        }
      }
      // Evaluation C: General Subject Contour with Light Background
      else if (isLightBackground && purgeWhiteHalo) {
        if (pL > fL + 35) {
          isWhiteHalo = true;
          if (curDist <= 1 && (pL >= 180 || pL > bgL - 25)) {
            shouldErode = true;
          }
        }
      }

      // Manual / Configured Edge Shift (tighten edge if negative)
      if (edgeShift < 0 && curDist <= Math.abs(edgeShift)) {
        shouldErode = true;
      }

      if (shouldErode && purgeWhiteHalo) {
        refinedAlpha[curIdx] = 0;
        continue;
      }

      // 100% Foreground Color Decontamination (Pure Subject Pigment)
      d[curIdx4] = Math.round(fR);
      d[curIdx4 + 1] = Math.round(fG);
      d[curIdx4 + 2] = Math.round(fB);

      // Alpha transition calculation
      if (isWhiteHalo && fL <= 85) {
        // Hair strand continuous density
        const ratio = Math.max(0, Math.min(1, (bgL - pL) / Math.max(25, bgL - fL)));
        const targetA = Math.round(Math.min(alphaSnapshot[curIdx], ratio * 255));
        refinedAlpha[curIdx] = targetA < 14 ? 0 : targetA;
      } else if (isWhiteHalo) {
        // Soft anti-aliased ear edge
        refinedAlpha[curIdx] = Math.min(alphaSnapshot[curIdx], curDist === 3 ? 190 : 225);
      } else if (level === 'removebg_smooth') {
        const normA = alphaSnapshot[curIdx] / 255;
        refinedAlpha[curIdx] = Math.round(Math.pow(normA, 0.94) * 255);
      }
    }
  }

  // 4. Sub-pixel Contour Anti-Aliasing (Smooth Transition Without Stairs)
  for (let y = startY; y <= endY; y++) {
    const rowOffset = y * W;
    for (let x = startX; x <= endX; x++) {
      const idx = rowOffset + x;
      const curA = refinedAlpha[idx];
      const curDist = distToBg[idx];

      if (curA === 0 || curDist >= 4) continue;

      let sumNeighborA = 0;
      let totalWeight = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const nRow = (y + dy) * W;
        for (let dx = -1; dx <= 1; dx++) {
          const nA = refinedAlpha[nRow + (x + dx)];
          const distSq = dx * dx + dy * dy;
          const w = distSq === 0 ? 0.40 : distSq === 1 ? 0.11 : 0.04;
          sumNeighborA += nA * w;
          totalWeight += w;
        }
      }

      if (totalWeight > 0) {
        const smoothed = Math.round(sumNeighborA / totalWeight);
        // Only smooth boundary pixels to prevent interior blurring
        if (curDist <= 2) {
          refinedAlpha[idx] = Math.min(curA, Math.max(0, smoothed));
        }
      }
    }
  }

  // Write refined alphas back into RGBA buffer
  for (let y = startY; y <= endY; y++) {
    const rowOffset = y * W;
    for (let x = startX; x <= endX; x++) {
      d[(rowOffset + x) * 4 + 3] = refinedAlpha[rowOffset + x];
    }
  }
}

/**
 * Advanced Computer Vision Post-Processing:
 * 1. Isolates the PRIMARY / MAIN salient subject with full anatomical protection (arms, hands, legs, headwear are NEVER cut off).
 * 2. Detects and eliminates distant background clutter, floating corner artifacts, or isolated background objects.
 * 3. Clears background traps/openings between arm & waist or between legs, ensuring they are NEVER mistakenly filled with background color.
 * 4. Fills ONLY genuine internal glare holes inside clothing or solid bodies.
 * 5. Applies Ultra-Strong background alpha purge to eliminate faint shadows, wall textures, and background bleeds.
 * 6. Hair & Ear edge finishing pass with sub-pixel anti-aliasing and deep color defringing.
 */
export async function isolateAndSolidifyMainObject(
  blob: Blob,
  originalSource?: File | Blob | string | null,
  configOptions?: {
    removeSecondaryObjects?: boolean;
    fillHoles?: boolean;
    refineHairAndEar?: boolean;
    edgeFinishingLevel?: 'removebg_smooth' | 'soft' | 'crisp' | 'silky';
    removalStrength?: 'ultra' | 'strong' | 'balanced';
    edgeShift?: number;
    purgeWhiteHalo?: boolean;
  }
): Promise<Blob> {
  const removeSecondary = configOptions?.removeSecondaryObjects !== false;
  const fillHoles = configOptions?.fillHoles !== false;
  const refineHairAndEar = configOptions?.refineHairAndEar !== false;
  const edgeFinishingLevel = configOptions?.edgeFinishingLevel || 'removebg_smooth';
  const removalStrength = configOptions?.removalStrength || 'ultra';
  const edgeShift = configOptions?.edgeShift ?? 0;
  const purgeWhiteHalo = configOptions?.purgeWhiteHalo !== false;

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

        // Optionally load original image to sample colors and restore RGB in filled holes
        let origData: Uint8ClampedArray | null = null;
        if (originalSource) {
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

        // Sample exterior background color along the 4 borders for smart loop/gap differentiation
        let borderBgR = 240, borderBgG = 240, borderBgB = 240;
        let borderBgCount = 0;
        let sumBgR = 0, sumBgG = 0, sumBgB = 0;

        if (origData) {
          const stepX = Math.max(1, Math.floor(W / 50));
          const stepY = Math.max(1, Math.floor(H / 50));
          // Top and bottom borders
          for (let x = 0; x < W; x += stepX) {
            for (let y of [0, 1, H - 2, H - 1]) {
              const idx = (y * W + x) * 4;
              if (d[idx + 3] < 50) {
                sumBgR += origData[idx];
                sumBgG += origData[idx + 1];
                sumBgB += origData[idx + 2];
                borderBgCount++;
              }
            }
          }
          // Left and right borders
          for (let y = 0; y < H; y += stepY) {
            for (let x of [0, 1, W - 2, W - 1]) {
              const idx = (y * W + x) * 4;
              if (d[idx + 3] < 50) {
                sumBgR += origData[idx];
                sumBgG += origData[idx + 1];
                sumBgB += origData[idx + 2];
                borderBgCount++;
              }
            }
          }
          if (borderBgCount > 0) {
            borderBgR = sumBgR / borderBgCount;
            borderBgG = sumBgG / borderBgCount;
            borderBgB = sumBgB / borderBgCount;
          }
        }

        // Downscaled grid for fast, accurate connected-component analysis
        const scale = Math.max(1, Math.min(3, Math.floor(Math.max(W, H) / 500)));
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
            if (gridAlpha[pos] >= 30 && labels[pos] === 0) {
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
                  if (n >= 0 && labels[n] === 0 && gridAlpha[n] >= 30) {
                    labels[n] = currentLabel;
                    queue.push(n);
                  }
                }
              }

              // Compute saliency score
              const centerX = sumX / size;
              const centerY = sumY / size;
              const distFromCenterX = Math.abs(centerX - gw / 2) / (gw / 2);
              const isAnchoredBottom = maxY >= gh - Math.max(3, Math.floor(gh * 0.05));
              const centerWeight = Math.max(0.25, 1 - distFromCenterX * 0.40);
              const bottomWeight = isAnchoredBottom ? 1.30 : 1.0;
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

        // Determine which components to keep with SMART ANATOMICAL PROTECTION
        const keepMask = new Uint8Array(gw * gh);
        let mainComp: CompData | null = null;
        const discardedCompIds = new Set<number>();

        if (components.length > 0) {
          // Sort descending by score -> 1st is the Main Object
          components.sort((a, b) => b.score - a.score);
          mainComp = components[0];

          const approvedCompIds = new Set<number>([mainComp.id]);

          if (removeSecondary) {
            for (let i = 1; i < components.length; i++) {
              const comp = components[i];

              // Horizontal & vertical gaps
              const distX = Math.max(0, Math.max(comp.minX - mainComp.maxX, mainComp.minX - comp.maxX));
              const distY = Math.max(0, Math.max(comp.minY - mainComp.maxY, mainComp.minY - comp.maxY));
              const gap = Math.sqrt(distX * distX + distY * distY);

              // 1. Arm, hand, elbow protection: horizontally beside torso and vertically overlapping
              const hasVerticalOverlap = !(comp.maxY < mainComp.minY || comp.minY > mainComp.maxY);
              const isArmOrHand = hasVerticalOverlap && distX <= Math.max(35, Math.floor(gw * 0.35));

              // 2. Leg / foot protection: below main body and within torso horizontal span
              const isLegOrFoot = comp.minY >= mainComp.minY && distX <= Math.max(25, Math.floor(gw * 0.25));

              // 3. Headwear, hair bun, hat protection: above main body and centered
              const isHairOrHeadwear = comp.maxY <= mainComp.minY + Math.floor(gh * 0.20) && distX <= Math.max(20, Math.floor(gw * 0.20));

              // 4. Close accessories, tie, collar, glasses
              const isCloseAccessory = gap <= Math.max(16, Math.floor(gw * 0.10));

              // 5. Couple / Partner / Child protection in group photo
              const isCoSubject = comp.size >= mainComp.size * 0.20 && gap <= Math.max(40, Math.floor(gw * 0.30));

              if (isArmOrHand || isLegOrFoot || isHairOrHeadwear || isCloseAccessory || isCoSubject) {
                approvedCompIds.add(comp.id);
              } else {
                // Distant background object / clutter / speck -> remove safely
                discardedCompIds.add(comp.id);
              }
            }
          } else {
            // Keep all components
            components.forEach((c) => approvedCompIds.add(c.id));
          }

          // Populate initial keepMask
          for (let i = 0; i < labels.length; i++) {
            if (labels[i] > 0 && approvedCompIds.has(labels[i])) {
              keepMask[i] = 1;
            }
          }

          // 2. Smart Hole-Filling (Eliminates Glare Holes while PROTECTING Arm/Waist and Leg Background Traps)
          if (fillHoles) {
            // Flood fill from all exterior borders (where keepMask is 0)
            const reachable = new Uint8Array(gw * gh);
            const borderQueue: number[] = [];

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

            // Find connected unreached regions (potential holes vs arm/leg background openings)
            const holeLabels = new Int32Array(gw * gh);
            let holeId = 0;
            interface HoleData {
              id: number;
              size: number;
              pixels: number[];
            }
            const holes: HoleData[] = [];

            for (let i = 0; i < keepMask.length; i++) {
              if (keepMask[i] === 0 && reachable[i] === 0 && holeLabels[i] === 0) {
                holeId++;
                const holePixels: number[] = [i];
                holeLabels[i] = holeId;
                const hq: number[] = [i];

                while (hq.length > 0) {
                  const cur = hq.pop()!;
                  const cy = Math.floor(cur / gw);
                  const cx = cur % gw;

                  const neighbors = [
                    cx > 0 ? cur - 1 : -1,
                    cx < gw - 1 ? cur + 1 : -1,
                    cy > 0 ? cur - gw : -1,
                    cy < gh - 1 ? cur + gw : -1,
                  ];

                  for (const n of neighbors) {
                    if (n >= 0 && keepMask[n] === 0 && reachable[n] === 0 && holeLabels[n] === 0) {
                      holeLabels[n] = holeId;
                      holePixels.push(n);
                      hq.push(n);
                    }
                  }
                }

                holes.push({
                  id: holeId,
                  size: holePixels.length,
                  pixels: holePixels,
                });
              }
            }

            // Evaluate each hole:
            // If it matches original background color OR is a large opening (like arm-waist loop or leg gap), DO NOT FILL!
            // Only fill genuine small transparent glare holes inside solid clothing.
            const maxHoleSizeAllowed = Math.max(30, Math.floor((mainComp?.size || 1000) * 0.05));

            for (const h of holes) {
              let isBackgroundOpening = false;

              // Large regions are arm-waist or leg background gaps -> Keep 100% transparent!
              if (h.size > maxHoleSizeAllowed) {
                isBackgroundOpening = true;
              } else if (origData && borderBgCount > 0) {
                // Check average color of this region
                let rSum = 0, gSum = 0, bSum = 0;
                for (const p of h.pixels) {
                  const py = Math.min(H - 1, Math.floor(p / gw) * scale);
                  const px = Math.min(W - 1, (p % gw) * scale);
                  const oIdx = (py * W + px) * 4;
                  rSum += origData[oIdx];
                  gSum += origData[oIdx + 1];
                  bSum += origData[oIdx + 2];
                }
                const avgR = rSum / h.size;
                const avgG = gSum / h.size;
                const avgB = bSum / h.size;

                const colorDist = Math.sqrt(
                  (avgR - borderBgR) ** 2 +
                  (avgG - borderBgG) ** 2 +
                  (avgB - borderBgB) ** 2
                );

                // Matches background palette -> It is an arm/leg gap, DO NOT FILL!
                if (colorDist < 45) {
                  isBackgroundOpening = true;
                }
              }

              if (!isBackgroundOpening) {
                for (const p of h.pixels) {
                  keepMask[p] = 2; // 2 indicates verified internal glare hole
                }
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

        // Alpha Cutoff & Solidification thresholds based on removalStrength and finishing level
        // Remove.bg style preserves continuous alpha for fine hair strands and smooth contours
        const isSmoothMatte = edgeFinishingLevel === 'removebg_smooth' || edgeFinishingLevel === 'silky';
        
        let bgCutoff = isSmoothMatte ? 8 : 18;
        let solidThreshold = isSmoothMatte ? 240 : 210;

        if (removalStrength === 'ultra') {
          // In ultra strength, discard distant faint noise without clipping hair strands
          bgCutoff = isSmoothMatte ? 10 : 24;
        } else if (removalStrength === 'strong') {
          bgCutoff = isSmoothMatte ? 8 : 18;
        } else if (removalStrength === 'balanced') {
          bgCutoff = isSmoothMatte ? 6 : 14;
        }

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

            // A. Detached secondary background person or clutter -> remove completely
            if (cellLabel > 0 && discardedCompIds.has(cellLabel)) {
              d[idx + 3] = 0;
              continue;
            }

            // B. Internal glare hole inside clothing/body -> fill completely full & solid!
            if (maskVal === 2) {
              d[idx + 3] = 255;
              if (origData && originalAlpha < 30) {
                d[idx] = origData[idx];
                d[idx + 1] = origData[idx + 1];
                d[idx + 2] = origData[idx + 2];
              }
              continue;
            }

            // C. Smooth Matting & Solid Core Retention (Remove.bg Style)
            if (originalAlpha < bgCutoff) {
              // Wipe distant background noise & faint shadows
              d[idx + 3] = 0;
            } else if (originalAlpha >= solidThreshold) {
              // 100% solid core for subject body, clothing, face
              d[idx + 3] = 255;
            } else {
              // Continuous smooth transition for hair strands, ear curves, and body contour
              if (isSmoothMatte) {
                const norm = (originalAlpha - bgCutoff) / (solidThreshold - bgCutoff);
                d[idx + 3] = Math.round(Math.pow(norm, isHeadOrHair ? 0.94 : 1.0) * 255);
              } else {
                const t = (originalAlpha - bgCutoff) / (solidThreshold - bgCutoff);
                d[idx + 3] = Math.round(t * t * (3 - 2 * t) * 255);
              }
            }
          }
        }

        // 4. Hair, Ear & Edge Finishing Pass (Sub-Pixel Anti-Aliasing, White Halo Purge & Color Defringing)
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
            edgeFinishingLevel,
            origData,
            edgeShift,
            purgeWhiteHalo
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
  let edgeFinishingLevel: 'removebg_smooth' | 'soft' | 'crisp' | 'silky' = 'removebg_smooth';
  let removalStrength: 'ultra' | 'strong' | 'balanced' = 'ultra';
  let edgeShift = 0;
  let purgeWhiteHalo = true;
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
    if (options.removalStrength) removalStrength = options.removalStrength;
    if (options.edgeShift !== undefined) edgeShift = options.edgeShift;
    if (options.purgeWhiteHalo !== undefined) purgeWhiteHalo = options.purgeWhiteHalo;
    if (options.onProgress) onProgress = options.onProgress;
  }

  // 1. Precision AI Deep Neural Segmentation (DEFAULT)
  if (engine === 'ai') {
    if (onProgress) onProgress('উচ্চক্ষমতাসম্পন্ন এআই মডেল প্রস্তুত হচ্ছে...', 10);

    const config: Config = {
      publicPath: PUBLIC_PATH,
      model: 'isnet_fp16',
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
          stageName = 'মূল অবজেক্ট আলাদা ও ব্যাকগ্রাউন্ড স্ক্যান হচ্ছে...';
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
            removalStrength,
            edgeShift,
            purgeWhiteHalo,
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
            removalStrength,
            edgeShift,
            purgeWhiteHalo,
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
        removalStrength,
        edgeShift,
        purgeWhiteHalo,
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
  level: 'removebg_smooth' | 'soft' | 'crisp' | 'silky' = 'removebg_smooth',
  edgeShift: number = 0,
  purgeWhiteHalo: boolean = true,
  originalSource?: Blob | string | null
): Promise<Blob> {
  return new Promise(async (resolve) => {
    let origData: Uint8ClampedArray | null = null;
    if (originalSource) {
      try {
        const origImg = new Image();
        const origUrl = typeof originalSource === 'string' ? originalSource : URL.createObjectURL(originalSource);
        await new Promise<void>((r) => {
          origImg.onload = () => r();
          origImg.onerror = () => r();
          origImg.src = origUrl;
        });
        const oCanvas = document.createElement('canvas');
        oCanvas.width = origImg.naturalWidth || origImg.width;
        oCanvas.height = origImg.naturalHeight || origImg.height;
        const oCtx = oCanvas.getContext('2d', { willReadFrequently: true });
        if (oCtx && oCanvas.width > 0 && oCanvas.height > 0) {
          oCtx.drawImage(origImg, 0, 0);
          origData = oCtx.getImageData(0, 0, oCanvas.width, oCanvas.height).data;
        }
        if (typeof originalSource !== 'string') URL.revokeObjectURL(origUrl);
      } catch (e) {
        // non-fatal
      }
    }

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
        applyHairAndEarFinishing(
          d,
          W,
          H,
          minX,
          maxX,
          minY,
          maxY,
          headBottomY,
          level,
          origData,
          edgeShift,
          purgeWhiteHalo
        );
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
