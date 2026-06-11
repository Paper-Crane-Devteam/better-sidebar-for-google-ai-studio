import { bg48DataUrl, bg96DataUrl, bg100DataUrl } from './imageFile';

/**
 * Watermark Removal Engine
 * Ported from 'gemini-watermark-remover-chrome-main/content.js'
 * Rewritten as typed TypeScript module.
 */

// ============= Constants =============
const ALPHA_THRESHOLD = 0.002;
const MAX_ALPHA = 0.99;
const LOGO_VALUE = 255;

// ============= Types =============
interface WatermarkPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
}

// ============= Alpha Map Calculator =============
function calculateAlphaMap(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData;
  const alphaMap = new Float32Array(width * height);
  for (let i = 0; i < alphaMap.length; i++) {
    const idx = i * 4;
    alphaMap[i] = Math.max(data[idx], data[idx + 1], data[idx + 2]) / 255.0;
  }
  return alphaMap;
}

// ============= Reverse Alpha Blending =============
function removeWatermark(
  imageData: ImageData,
  alphaMap: Float32Array,
  position: WatermarkPosition,
): void {
  const { x, y, width, height } = position;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const imgIdx = ((y + row) * imageData.width + (x + col)) * 4;
      const alphaIdx = row * width + col;

      let alpha = alphaMap[alphaIdx];
      if (alpha < ALPHA_THRESHOLD) continue;
      alpha = Math.min(alpha, MAX_ALPHA);

      for (let c = 0; c < 3; c++) {
        const watermarked = imageData.data[imgIdx + c];
        const original = (watermarked - alpha * LOGO_VALUE) / (1.0 - alpha);
        imageData.data[imgIdx + c] = Math.max(0, Math.min(255, Math.round(original)));
      }
    }
  }
}

// ============= Watermark Config Detection =============

/** Candidate margin configs for free vs pro accounts */
interface MarginConfig {
  margin: number;
}

function getWatermarkCandidates(width: number, height: number): { size: number; candidates: MarginConfig[] } {
  const isXLarge = width > 2048 || height > 2048;
  const isLarge = width > 1024 && height > 1024;

  if (isXLarge) {
    return { size: 100, candidates: [{ margin: 63 }, { margin: 188 }] };
  } else if (isLarge) {
    return { size: 96, candidates: [{ margin: 64 }, { margin: 140 }] };
  } else {
    return { size: 48, candidates: [{ margin: 32 }, { margin: 95 }] };
  }
}

/**
 * Score how well the watermark template matches at a given position.
 * Higher score = more likely the watermark is there.
 * We check if pixels under non-transparent parts of the template
 * look like they've been alpha-blended with white (LOGO_VALUE=255).
 */
function scorePosition(
  imageData: ImageData,
  alphaMap: Float32Array,
  position: WatermarkPosition,
): number {
  const { x, y, width, height } = position;
  let totalScore = 0;
  let count = 0;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const alphaIdx = row * width + col;
      const alpha = alphaMap[alphaIdx];
      if (alpha < ALPHA_THRESHOLD) continue;

      const imgIdx = ((y + row) * imageData.width + (x + col)) * 4;
      const r = imageData.data[imgIdx];
      const g = imageData.data[imgIdx + 1];
      const b = imageData.data[imgIdx + 2];

      // If watermark is here, pixels should be brighter than surroundings
      // proportional to alpha. Check how close to expected blended value.
      const brightness = (r + g + b) / 3;
      // Watermark blends toward white, so higher alpha → brighter pixel
      const expectedMinBrightness = alpha * LOGO_VALUE * 0.5;
      if (brightness >= expectedMinBrightness) {
        totalScore += alpha;
      }
      count++;
    }
  }

  return count > 0 ? totalScore / count : 0;
}

function detectWatermarkPosition(
  imageData: ImageData,
  alphaMap: Float32Array,
  width: number,
  height: number,
): WatermarkPosition {
  const { size, candidates } = getWatermarkCandidates(width, height);

  let bestPosition: WatermarkPosition | null = null;
  let bestScore = -1;

  for (const { margin } of candidates) {
    const pos: WatermarkPosition = {
      size,
      x: Math.floor(width - margin - size),
      y: Math.floor(height - margin - size),
      width: size,
      height: size,
    };

    // Bounds check
    if (pos.x < 0 || pos.y < 0) continue;

    const score = scorePosition(imageData, alphaMap, pos);
    if (score > bestScore) {
      bestScore = score;
      bestPosition = pos;
    }
  }

  // Fallback: if detection fails, use free account position (closer to edge)
  if (!bestPosition) {
    const fallbackMargin = candidates[0].margin;
    bestPosition = {
      size,
      x: Math.floor(width - fallbackMargin - size),
      y: Math.floor(height - fallbackMargin - size),
      width: size,
      height: size,
    };
  }

  return bestPosition;
}

// ============= Image Loader =============
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ============= Watermark Engine =============
export class WatermarkEngine {
  private bgImages: Record<number, HTMLImageElement> = {};
  private alphaMaps: Record<number, Float32Array> = {};

  private constructor(images: Record<number, HTMLImageElement>) {
    this.bgImages = images;
  }

  static async create(): Promise<WatermarkEngine> {
    try {
      const [bg48, bg96, bg100] = await Promise.all([
        loadImage(bg48DataUrl),
        loadImage(bg96DataUrl),
        loadImage(bg100DataUrl),
      ]);
      return new WatermarkEngine({ 48: bg48, 96: bg96, 100: bg100 });
    } catch (e) {
      console.error('Failed to load watermark assets.', e);
      throw e;
    }
  }

  private async getAlphaMap(size: number): Promise<Float32Array> {
    if (this.alphaMaps[size]) return this.alphaMaps[size];

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Use native template if available, otherwise pick closest and scale
    const srcImg = this.bgImages[size]
      ?? this.bgImages[size <= 48 ? 48 : size <= 96 ? 96 : 100];
    ctx.drawImage(srcImg, 0, 0, size, size);
    const map = calculateAlphaMap(ctx.getImageData(0, 0, size, size));
    this.alphaMaps[size] = map;
    return map;
  }

  async process(blobUrl: string): Promise<Blob> {
    const img = await loadImage(blobUrl);

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Determine watermark size from image dimensions, then detect exact position
    const { size } = getWatermarkCandidates(canvas.width, canvas.height);
    const alphaMap = await this.getAlphaMap(size);
    const config = detectWatermarkPosition(imageData, alphaMap, canvas.width, canvas.height);

    removeWatermark(imageData, alphaMap, config);
    ctx.putImageData(imageData, 0, 0);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/png');
    });
  }
}
