import { parseStreamingResponse, extractWrbFrPayloads } from '../lib/response-parser';
import { WatermarkEngine } from '../watermark-engine';
import { usePegasusStore } from '@/shared/lib/pegasus-store';

let watermarkEngineInstance: WatermarkEngine | null = null;

export async function handleDownloadResponse(response: any, url: string) {
  if (response.status === 200) {
    const shouldRemoveWatermark = usePegasusStore.getState().enhancedFeatures.gemini.removeWatermark;
    if (!shouldRemoveWatermark) {
      return; 
    }

    let responseBody = response.response;
    if (typeof responseBody !== 'string') {
       try {
         responseBody = JSON.stringify(responseBody);
       } catch (e) {
         console.warn('Better Sidebar (Gemini): Could not stringify download body', e);
         return;
       }
    }

    try {
      const retChunks = parseStreamingResponse(responseBody);
      const chunks = retChunks.map(chunk => chunk[0]);
      
      if (chunks.length > 0) {
        const payloads = extractWrbFrPayloads(chunks);
        
        // c8o8Fe rpcid payload
        // payloads[0] is array of URL
        const imageUrl = payloads?.[0];
        
        if (typeof imageUrl === 'string') {
          console.log('Better Sidebar (Gemini): Intercepted download request:', imageUrl);

          // Clear response to prevent web app from downloading the original
          response.response = '';
          
          try {
            // Lazy load the engine
            if (!watermarkEngineInstance) {
              watermarkEngineInstance = await WatermarkEngine.create();
            }

            const res = await fetch(imageUrl);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            const processedBlob = await watermarkEngineInstance.process(blobUrl);

            // Trigger download of processed file
            const a = document.createElement('a');
            a.href = URL.createObjectURL(processedBlob);
            a.download = `Gemini_Image_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(a.href);
            URL.revokeObjectURL(blobUrl);

          } catch (processErr) {
            console.error('Better Sidebar (Gemini): Error processing watermark:', processErr);
            // Fallback: download original
            const a = document.createElement('a');
            a.href = imageUrl;
            a.download = `Gemini_Image_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }
      }
    } catch (e) {
      console.error('Better Sidebar (Gemini): Error handling download response', e);
    }
  }
}
