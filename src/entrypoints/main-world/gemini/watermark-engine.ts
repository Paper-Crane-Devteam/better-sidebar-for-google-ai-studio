import { bg48Base64, bg96Base64 } from './watermark-assets';

const ALPHA_THRESHOLD = 0.002;
const MAX_ALPHA = 0.99;
const LOGO_VALUE = 255;

export function calculateAlphaMap(bgCaptureImageData: ImageData): Float32Array {
    const { width, height, data } = bgCaptureImageData;
    const alphaMap = new Float32Array(width * height);
    for (let i = 0; i < alphaMap.length; i++) {
        const idx = i * 4;
        // Normalize max channel to 0-1
        alphaMap[i] = Math.max(data[idx], data[idx + 1], data[idx + 2]) / 255.0;
    }
    return alphaMap;
}

export function removeWatermark(
    imageData: ImageData,
    alphaMap: Float32Array,
    position: { x: number; y: number; width: number; height: number }
) {
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
                // Reverse Alpha Blending Formula
                const original = (watermarked - alpha * LOGO_VALUE) / (1.0 - alpha);
                imageData.data[imgIdx + c] = Math.max(0, Math.min(255, Math.round(original)));
            }
        }
    }
}

export class WatermarkEngine {
    bg48: HTMLImageElement;
    bg96: HTMLImageElement;
    alphaMaps: Record<number, Float32Array> = {};

    constructor(bg48: HTMLImageElement, bg96: HTMLImageElement) {
        this.bg48 = bg48;
        this.bg96 = bg96;
    }

    static async create(): Promise<WatermarkEngine> {
        const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });

        try {
            const [bg48, bg96] = await Promise.all([
                loadImage(bg48Base64),
                loadImage(bg96Base64)
            ]);
            return new WatermarkEngine(bg48, bg96);
        } catch (e) {
            console.error("Failed to load watermark assets.", e);
            throw e;
        }
    }

    getWatermarkInfo(width: number, height: number) {
        const isLarge = width > 1024 && height > 1024;
        const size = isLarge ? 96 : 48;
        const margin = isLarge ? 64 : 32;
        
        return {
            size,
            x: Math.floor(width - margin - size),
            y: Math.floor(height - margin - size),
            width: size, 
            height: size
        };
    }

    async getAlphaMap(size: number): Promise<Float32Array> {
        if (this.alphaMaps[size]) return this.alphaMaps[size];
        
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        ctx.drawImage(size === 48 ? this.bg48 : this.bg96, 0, 0);
        
        const map = calculateAlphaMap(ctx.getImageData(0, 0, size, size));
        this.alphaMaps[size] = map;
        return map;
    }

    async process(blobUrl: string): Promise<Blob> {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            // allow cross-origin if needed
            i.crossOrigin = 'anonymous';
            i.onload = () => resolve(i); 
            i.onerror = reject;
            i.src = blobUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const config = this.getWatermarkInfo(canvas.width, canvas.height);
        
        const alphaMap = await this.getAlphaMap(config.size);
        removeWatermark(imageData, alphaMap, config);
        
        ctx.putImageData(imageData, 0, 0);
        
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error('Canvas toBlob failed'));
            }, 'image/png');
        });
        
        return blob;
    }
}
