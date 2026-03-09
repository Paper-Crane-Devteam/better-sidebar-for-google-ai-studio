import { WatermarkEngine } from '@/shared/lib/utils/watermark-remover';
import { getPegasusStoreReady, usePegasusStore } from '@/shared/lib/pegasus-store';

const IMAGE_URL_PATTERN = /lh3\.googleusercontent\.com\/rd-gg(?:-dl)?\//;

let engineInstance: WatermarkEngine | null = null;

async function getEngine(): Promise<WatermarkEngine> {
  if (!engineInstance) {
    engineInstance = await WatermarkEngine.create();
  }
  return engineInstance;
}

async function processImg(img: HTMLImageElement): Promise<void> {
  const src = img.src;
  if (!IMAGE_URL_PATTERN.test(src)) return;
  // Avoid reprocessing
  if (img.dataset.bsProcessed) return;
  img.dataset.bsProcessed = 'pending';

  try {
    const shouldRemove = usePegasusStore.getState().enhancedFeatures.gemini.removeWatermark;
    if (!shouldRemove) {
      img.dataset.bsProcessed = 'skipped';
      return;
    }

    // Upscale: replace size suffix with full resolution
    const upscaledSrc = src.replace(/=s\d+(-[a-z]+)*$/, '=s0');

    const engine = await getEngine();
    const res = await fetch(upscaledSrc);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const processedBlob = await engine.process(blobUrl);
    URL.revokeObjectURL(blobUrl);

    const objectUrl = URL.createObjectURL(processedBlob);
    img.src = objectUrl;
    img.dataset.bsProcessed = 'done';
    img.dataset.bsOriginalSrc = src;
  } catch (e) {
    console.error('Better Sidebar (Gemini): Image processing failed', e);
    img.dataset.bsProcessed = 'error';
  }
}

export function startImageProcessor(): () => void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLImageElement) {
          processImg(node);
        } else if (node instanceof Element) {
          node.querySelectorAll<HTMLImageElement>('img').forEach(processImg);
        }
      }
      // Also catch src attribute changes on existing images
      if (
        mutation.type === 'attributes' &&
        mutation.attributeName === 'src' &&
        mutation.target instanceof HTMLImageElement
      ) {
        const img = mutation.target as HTMLImageElement;
        delete img.dataset.bsProcessed;
        processImg(img);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });

  // Process any images already in the DOM
  document.querySelectorAll<HTMLImageElement>('img').forEach(processImg);

  return () => observer.disconnect();
}

export async function initImageProcessor(): Promise<() => void> {
  await getPegasusStoreReady();
  return startImageProcessor();
}
