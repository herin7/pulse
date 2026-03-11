import { useState, useEffect, useRef, useCallback } from 'react';
import useEmbeddings from './useEmbeddings';

function getUserId() {
  let id = localStorage.getItem('lc_user_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('lc_user_id', id);
  }
  return id;
}

export default function IngestFlow({ formData, onComplete }) {
  const { isReady, embed } = useEmbeddings();
  const [step, setStep] = useState('loading_model');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    const userId = getUserId();

    try {
      // Step A — Ingest
      setStep('Fetching GitHub data...');
      setProgress(5);

      const ingestRes = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...formData, userId }),
      });

      if (!ingestRes.ok) throw new Error('Ingest request failed');
      const { chunks, warnings } = await ingestRes.json();
      if (warnings?.length) {
        warnings.forEach((w) => console.warn('[Ingest]', w));
        setStep(warnings[0]);
        await new Promise((r) => setTimeout(r, 2500));
      }
      setProgress(15);

      // Step B — Generate embeddings in batches of 5
      const embeddedChunks = [];
      const total = chunks.length;

      for (let i = 0; i < total; i += 5) {
        const batch = chunks.slice(i, i + 5);
        const embeddings = await Promise.all(batch.map((c) => embed(c.text)));

        for (let j = 0; j < batch.length; j++) {
          embeddedChunks.push({
            text: batch[j].text,
            source: batch[j].source,
            chunkIndex: batch[j].index,
            embedding: embeddings[j],
          });
        }

        const done = Math.min(i + 5, total);
        setStep(`Generating embeddings (${done}/${total})...`);
        setProgress(15 + Math.round((done / total) * 65));
      }

      // Step C — Store
      setStep('Building your character card...');
      setProgress(85);

      const storeRes = await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chunks: embeddedChunks, userId }),
      });

      if (!storeRes.ok) throw new Error('Store request failed');
      const { characterCard } = await storeRes.json();
      setProgress(100);

      // Step D — Done
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
        {/* Hero area with progress overlay */}
        <div className="pulse-card-hero">
          {/* Corner dots */}
          <div className="pulse-corner-dot" style={{ top: 16, left: 16 }} />
          <div className="pulse-corner-dot" style={{ top: 16, right: 16 }} />
          <div className="pulse-corner-dot" style={{ bottom: 16, left: 16 }} />
          <div className="pulse-corner-dot" style={{ bottom: 16, right: 16 }} />

          <div className="pulse-hero-text">
            <div className="text-[3.5rem] font-serif italic leading-none">Building.</div>
            <div className="text-base font-sans font-light opacity-70 mt-3">Your profile is being created</div>
          </div>

          {/* Progress bar overlaid on hero */}
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

        {/* Content area */}
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
