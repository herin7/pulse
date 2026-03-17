import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useIngest from './store/useIngest';

const SOURCE_ITEMS = [
  { key: 'selfReport', label: 'Self report', hint: 'Your AI self-summary + notes' },
  { key: 'linkedin', label: 'LinkedIn', hint: 'Career context and work history' },
  { key: 'github', label: 'GitHub', hint: 'Repos, languages, and shipping signal' },
  { key: 'notion', label: 'Notion', hint: 'Founder docs, notes, and workspace context' },
];
const REQUIRED_SOURCE_KEYS = ['selfReport', 'linkedin', 'github'];

function SourceStatusCard({
  item,
  status,
  error,
  isDeferred,
  onRetry,
  onSkip,
  onAddLater,
}) {
  const badgeClass = status === 'success'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'failed'
      ? 'bg-red-100 text-red-700'
      : status === 'loading'
        ? 'bg-blue-100 text-blue-700'
        : status === 'skipped'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-neutral-100 text-neutral-600';

  const label = status === 'skipped' && isDeferred ? 'deferred' : status;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">{item.label}</p>
          <p className="mt-1 text-xs text-neutral-500">{item.hint}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgeClass}`}>
          {label}
        </span>
      </div>

      {status === 'loading' && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-neutral-700" />
        </div>
      )}

      {status === 'failed' && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700">{error || 'Failed to process this source.'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={onRetry}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              Retry
            </button>
            <button
              onClick={onSkip}
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
            >
              Skip for now
            </button>
            <button
              onClick={onAddLater}
              className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 transition-colors hover:bg-sky-100"
            >
              Add later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IngestFlow({ formData, onComplete }) {
  const startedRef = useRef(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [fatalError, setFatalError] = useState(null);
  const [deferredMap, setDeferredMap] = useState({});
  const { statuses, errors, ingestSource, skipSource, refetchSource, proceedWithSkipped, hasAnySuccess } = useIngest(formData?.sourcePreferences);

  const runSource = useCallback(async (source) => {
    try {
      await ingestSource(source, formData);
    } catch {}
  }, [formData, ingestSource]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      for (const item of SOURCE_ITEMS) {
        await runSource(item.key);
      }
    };

    run().catch(() => {});
  }, [runSource]);

  const progress = useMemo(() => {
    const values = SOURCE_ITEMS.map(({ key }) => {
      const status = statuses[key];
      if (status === 'loading') return 0.5;
      if (status === 'idle') return 0;
      return 1;
    });
    return Math.round((values.reduce((sum, value) => sum + value, 0) / SOURCE_ITEMS.length) * 100);
  }, [statuses]);

  const allFailed = useMemo(
    () => REQUIRED_SOURCE_KEYS.every((key) => statuses[key] === 'failed'),
    [statuses],
  );

  const handleRetry = useCallback(async (source) => {
    setDeferredMap((prev) => ({ ...prev, [source]: false }));
    try {
      await refetchSource(source, formData);
    } catch {}
  }, [formData, refetchSource]);

  const handleSkipForNow = useCallback((source) => {
    setDeferredMap((prev) => ({ ...prev, [source]: false }));
    skipSource(source);
  }, [skipSource]);

  const handleAddLater = useCallback((source) => {
    setDeferredMap((prev) => ({ ...prev, [source]: true }));
    skipSource(source);
  }, [skipSource]);

  const handleContinue = useCallback(async () => {
    setFatalError(null);
    setIsFinalizing(true);
    try {
      const characterCard = await proceedWithSkipped(formData);
      onComplete(characterCard);
    } catch (err) {
      setFatalError(err.message || 'Could not complete onboarding');
    } finally {
      setIsFinalizing(false);
    }
  }, [formData, onComplete, proceedWithSkipped]);

  const canContinue = hasAnySuccess && !allFailed && !isFinalizing;

  return (
    <div className="min-h-screen flex items-center justify-center pt-16">
      <div className="pulse-card flex flex-col">
        <div className="pulse-card-hero">
          <div className="pulse-corner-dot" style={{ top: 16, left: 16 }} />
          <div className="pulse-corner-dot" style={{ top: 16, right: 16 }} />
          <div className="pulse-corner-dot" style={{ bottom: 16, left: 16 }} />
          <div className="pulse-corner-dot" style={{ bottom: 16, right: 16 }} />

          <div className="pulse-hero-text">
            <div className="text-[3.2rem] font-serif italic leading-none">Syncing.</div>
            <div className="text-base font-sans font-light opacity-80 mt-3">Source-by-source resilient ingest</div>
          </div>

          <div className="absolute bottom-6 left-8 right-8">
            <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-8 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-600">
              Failed sources can be retried, skipped, or deferred. Chat only blocks if GitHub, LinkedIn, and self report all fail.
            </p>
            <span className="text-xs text-neutral-400">{progress}%</span>
          </div>

          <div className="space-y-3">
            {SOURCE_ITEMS.map((item) => (
              <SourceStatusCard
                key={item.key}
                item={item}
                status={statuses[item.key]}
                error={errors[item.key]}
                isDeferred={Boolean(deferredMap[item.key])}
                onRetry={() => handleRetry(item.key)}
                onSkip={() => handleSkipForNow(item.key)}
                onAddLater={() => handleAddLater(item.key)}
              />
            ))}
          </div>

          {allFailed && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              GitHub, LinkedIn, and self report all failed together. Retry at least one source or skip one to continue.
            </div>
          )}

          {fatalError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {fatalError}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleContinue}
              disabled={!canContinue}
              className="px-6 py-2.5 rounded-full bg-white border border-neutral-300 text-neutral-800 font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors text-sm"
            >
              {isFinalizing ? 'Building profile...' : 'Continue to chat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
