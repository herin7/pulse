import { useState, useEffect, useRef, useCallback } from 'react';
import useEmbeddings from './useEmbeddings';

export default function IngestFlow({ formData, onComplete }) {
  const { isReady, embed } = useEmbeddings();
  const [step, setStep] = useState('loading_model');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    const token = localStorage.getItem('pulse_token');

    try {
      setStep('Fetching GitHub data...');
      setProgress(5);

      const ingestRes = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ ...formData }),
      });

      if (!ingestRes.ok) throw new Error('Ingest request failed');
      const { chunks, warnings } = await ingestRes.json();

      if (warnings && Array.isArray(warnings) && warnings.length) {
        warnings.forEach((warning) => console.warn('[Ingest]', warning));
        setStep(warnings[0]);
        await new Promise((resolve) => setTimeout(resolve, 2500));
      } else if (warnings && typeof warnings === 'string') {
        console.warn('[Ingest]', warnings);
        setStep(warnings);
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      setProgress(15);

      const embeddedChunks = [];
      const total = chunks.length;

      for (let index = 0; index < total; index += 5) {
        const batch = chunks.slice(index, index + 5);
        const embeddings = await Promise.all(batch.map((chunk) => embed(chunk.text)));

        for (let offset = 0; offset < batch.length; offset += 1) {
          embeddedChunks.push({
            text: batch[offset].text,
            source: batch[offset].source,
            chunkIndex: batch[offset].index,
            embedding: embeddings[offset],
          });
        }

        const done = Math.min(index + 5, total);
        setStep(`Generating embeddings (${done}/${total})...`);
        setProgress(15 + Math.round((done / total) * 65));
      }

      setStep('Building your character card...');
      setProgress(85);

      const storeRes = await fetch('/api/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ chunks: embeddedChunks }),
      });

      if (!storeRes.ok) throw new Error('Store request failed');
      const { characterCard } = await storeRes.json();
      setProgress(100);
      onComplete(characterCard);
    } catch (err) {
      console.error('IngestFlow error:', err);
      setError(err.message || 'Something went wrong');
    }
  }, [formData, embed, onComplete]);

  useEffect(() => {
    if (isReady && !started.current) {
      started.current = true;
      run();
    }
  }, [isReady, run]);

  const stepLabel = !isReady ? 'Loading embedding model...' : step;

  return (
    <div className="min-h-screen flex items-center justify-center pt-16">
      <div className="pulse-card flex flex-col">
        <div className="pulse-card-hero">
          <div className="pulse-corner-dot" style={{ top: 16, left: 16 }} />
          <div className="pulse-corner-dot" style={{ top: 16, right: 16 }} />
          <div className="pulse-corner-dot" style={{ bottom: 16, left: 16 }} />
          <div className="pulse-corner-dot" style={{ bottom: 16, right: 16 }} />

          <div className="pulse-hero-text">
            <div className="text-[3.5rem] font-serif italic leading-none">Building.</div>
            <div className="text-base font-sans font-light opacity-70 mt-3">Your profile is being created</div>
          </div>

          {!error && (
            <div className="absolute bottom-6 left-8 right-8">
              <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-white h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-8 flex-1 flex flex-col items-center justify-center">
          <p className="text-neutral-600 text-sm mb-4">{error ? '' : stepLabel}</p>

          {!error && (
            <div className="w-full max-w-sm">
              <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-neutral-800 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-neutral-400 text-xs mt-2 text-center">{progress}%</p>
            </div>
          )}

          {error && (
            <div className="text-center">
              <p className="text-red-500 text-sm mb-4">{error}</p>
              <button
                onClick={() => {
                  started.current = false;
                  setError(null);
                  setProgress(0);
                  run();
                }}
                className="px-5 py-2 rounded-full bg-white border border-neutral-300 text-neutral-700 text-sm hover:bg-neutral-50 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
