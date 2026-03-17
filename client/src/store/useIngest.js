import { useCallback, useEffect, useMemo, useState } from 'react';

const SOURCE_KEYS = ['github', 'linkedin', 'selfReport', 'notion'];
const BLOCKING_SOURCE_KEYS = ['github', 'linkedin', 'selfReport'];
const SOURCE_TO_INGEST_KEY = {
  github: 'github',
  linkedin: 'linkedin',
  notion: 'notion',
  selfReport: 'ai_self_report',
};

function createInitialStatuses() {
  return { github: 'idle', linkedin: 'idle', notion: 'idle', selfReport: 'idle' };
}

function normalizeInitialStatuses(initialStatuses) {
  const defaults = createInitialStatuses();
  if (!initialStatuses || typeof initialStatuses !== 'object') return defaults;
  return {
    github: initialStatuses.github === 'skipped' ? 'skipped' : 'idle',
    linkedin: initialStatuses.linkedin === 'skipped' ? 'skipped' : 'idle',
    notion: defaults.notion,
    selfReport: initialStatuses.selfReport === 'skipped' ? 'skipped' : 'idle',
  };
}

function createInitialErrors() {
  return { github: null, linkedin: null, notion: null, selfReport: null };
}

function createInitialDetails() {
  return {
    github: { chunkCount: 0 },
    linkedin: { chunkCount: 0 },
    notion: { chunkCount: 0, pagesIndexed: 0 },
    selfReport: { chunkCount: 0 },
  };
}

function getStorageKey() {
  const userId = localStorage.getItem('lc_user_id') || 'anonymous';
  return `pulse_ingest_${userId}`;
}

function getAuthHeaders() {
  const token = localStorage.getItem('pulse_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function buildSourcePayload(source, formData) {
  return {
    source,
    githubUsername: source === 'github' ? (formData?.githubUsername || '') : '',
    linkedinPaste: source === 'linkedin' ? (formData?.linkedinPaste || '') : '',
    llmDump: source === 'selfReport' ? (formData?.llmDump || '') : '',
  };
}

function hasInput(source, formData) {
  if (source === 'github') return Boolean(formData?.githubUsername?.trim());
  if (source === 'linkedin') return Boolean(formData?.linkedinPaste?.trim());
  if (source === 'selfReport') return Boolean(formData?.llmDump?.trim());
  return true;
}

function mapDetails(source, payload) {
  return {
    chunkCount: Array.isArray(payload?.chunks) ? payload.chunks.length : 0,
    pagesIndexed: source === 'notion' ? Number(payload?.pagesIndexed || 0) : 0,
  };
}

export default function useIngest(initialStatuses) {
  const [statuses, setStatuses] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(getStorageKey()) || '{}');
      return { ...normalizeInitialStatuses(initialStatuses), ...(saved.statuses || {}) };
    } catch {
      return { ...normalizeInitialStatuses(initialStatuses) };
    }
  });
  const [errors, setErrors] = useState(createInitialErrors());
  const [details, setDetails] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(getStorageKey()) || '{}');
      return { ...createInitialDetails(), ...(saved.details || {}) };
    } catch {
      return createInitialDetails();
    }
  });

  useEffect(() => {
    sessionStorage.setItem(getStorageKey(), JSON.stringify({ details, statuses }));
  }, [details, statuses]);

  const setSourceState = useCallback((source, status, error = null, extra = {}) => {
    setStatuses((prev) => ({ ...prev, [source]: status }));
    setErrors((prev) => ({ ...prev, [source]: error }));
    setDetails((prev) => ({ ...prev, [source]: { ...prev[source], ...extra } }));
  }, []);

  const ingestSource = useCallback(async (source, formData) => {
    if (!SOURCE_KEYS.includes(source)) throw new Error(`Unknown source: ${source}`);
    if (!hasInput(source, formData)) {
      setSourceState(source, 'skipped', null, { chunkCount: 0, pagesIndexed: 0 });
      return { source, status: 'skipped' };
    }

    setSourceState(source, 'loading', null);
    const res = await fetch('/api/ingest/source', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(buildSourcePayload(source, formData)),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = payload?.error || `Failed to ingest ${source}`;
      setSourceState(source, 'failed', error);
      throw new Error(error);
    }

    const status = payload?.status || 'success';
    const sourceKey = SOURCE_TO_INGEST_KEY[source];
    const sourceChunks = (payload?.chunks || []).filter((chunk) => chunk.source === sourceKey);
    const extra = mapDetails(source, payload);

    if (status === 'success') {
      setSourceState(source, 'success', null, extra);
      return { chunks: sourceChunks, source, status: 'success' };
    }

    if (status === 'empty' || status === 'not_configured' || status === 'skipped') {
      setSourceState(source, status, null, extra);
      return { chunks: sourceChunks, source, status };
    }

    const error = Array.isArray(payload?.warnings) && payload.warnings[0] ? payload.warnings[0] : `Failed to ingest ${source}`;
    setSourceState(source, 'failed', error, extra);
    throw new Error(error);
  }, [setSourceState]);

  const skipSource = useCallback((source) => {
    setSourceState(source, 'skipped', null, { chunkCount: 0, pagesIndexed: 0 });
  }, [setSourceState]);

  const refetchSource = useCallback(async (source, formData) => ingestSource(source, formData), [ingestSource]);

  const proceedWithSkipped = useCallback(async (formData) => {
    const normalized = { ...statuses };
    BLOCKING_SOURCE_KEYS.forEach((source) => {
      if (!hasInput(source, formData) && normalized[source] === 'idle') normalized[source] = 'skipped';
    });

    const allFailed = BLOCKING_SOURCE_KEYS.every((source) => normalized[source] === 'failed');
    if (allFailed) throw new Error('All three sources failed. Retry one source or skip one to proceed.');

    const ingestPayload = {
      githubUsername: normalized.github === 'skipped' ? '' : (formData?.githubUsername || ''),
      linkedinPaste: normalized.linkedin === 'skipped' ? '' : (formData?.linkedinPaste || ''),
      llmDump: normalized.selfReport === 'skipped' ? '' : (formData?.llmDump || ''),
    };
    const ingestRes = await fetch('/api/ingest', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(ingestPayload),
    });
    const ingestData = await ingestRes.json().catch(() => ({}));

    if (!ingestRes.ok || !Array.isArray(ingestData.chunks) || !ingestData.chunks.length) {
      throw new Error(ingestData?.error || 'Unable to continue. No data available for profile build.');
    }

    if (ingestData?.sources && typeof ingestData.sources === 'object') {
      Object.entries(ingestData.sources).forEach(([source, status]) => {
        const extra = source === 'notion' ? { pagesIndexed: Number(ingestData?.pagesIndexed?.notion || 0) } : {};
        setSourceState(source, status, null, extra);
      });
    }

    const storeRes = await fetch('/api/store', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ chunks: ingestData.chunks }),
    });
    const storeData = await storeRes.json().catch(() => ({}));

    if (!storeRes.ok || !storeData.characterCard) {
      throw new Error(storeData?.error || 'Failed to build character profile');
    }

    return storeData.characterCard;
  }, [setSourceState, statuses]);

  const hasAnySuccess = useMemo(
    () => BLOCKING_SOURCE_KEYS.some((source) => statuses[source] === 'success' || statuses[source] === 'skipped'),
    [statuses],
  );

  return {
    details,
    errors,
    hasAnySuccess,
    ingestSource,
    proceedWithSkipped,
    refetchSource,
    skipSource,
    statuses,
  };
}
