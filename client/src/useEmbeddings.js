import { useEffect, useRef, useState, useCallback } from 'react';

export default function useEmbeddings() {
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const idCounter = useRef(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const worker = new Worker(
      new URL('./embeddings.worker.js', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, vector, requestId } = e.data;

      if (type === 'loaded') {
        setIsReady(true);
        return;
      }

      if (type === 'embedding') {
        const resolve = pendingRef.current.get(requestId);
        if (resolve) {
          pendingRef.current.delete(requestId);
          resolve(vector);
        }
      }
    };

    worker.postMessage({ type: 'load' });

    return () => worker.terminate();
  }, []);

  const embed = useCallback((text) => {
    return new Promise((resolve) => {
      const requestId = idCounter.current++;
      pendingRef.current.set(requestId, resolve);
      workerRef.current.postMessage({ type: 'embed', text, requestId });
    });
  }, []);

  return { isReady, embed };
}
