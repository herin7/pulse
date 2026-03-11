import { pipeline } from '@huggingface/transformers';

let extractor = null;

self.onmessage = async (e) => {
  const { type, text, requestId } = e.data;

  if (type === 'load') {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    self.postMessage({ type: 'loaded' });
  }

  if (type === 'embed') {
    const output = await extractor([text], { pooling: 'mean', normalize: true });
    const vector = Array.from(output.tolist()[0]);
    self.postMessage({ type: 'embedding', vector, requestId });
  }
};
