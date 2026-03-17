import { useCallback, useMemo, useState } from 'react';

const SOURCE_KEYS = ['github', 'linkedin', 'selfReport'];
const SOURCE_TO_INGEST_KEY = {
  github: 'github',
  linkedin: 'linkedin',
  selfReport: 'ai_self_report',
};

function createInitialStatuses() {
  return {
    github: 'idle',
    linkedin: 'idle',
    selfReport: 'idle',
  };
}

function normalizeInitialStatuses(initialStatuses) {
  const defaults = createInitialStatuses();
  if (!initialStatuses || typeof initialStatuses !== 'object') return defaults;

  return {
    github: initialStatuses.github === 'skipped' ? 'skipped' : 'idle',
    linkedin: initialStatuses.linkedin === 'skipped' ? 'skipped' : 'idle',
    selfReport: initialStatuses.selfReport === 'skipped' ? 'skipped' : 'idle',
  };
}

function createInitialErrors() {
  return {
    github: null,
    linkedin: null,
    selfReport: null,
  };
}

function getAuthHeaders() {
  const token = localStorage.getItem('pulse_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function buildSourcePayload(source, formData) {
  return {
    githubUsername: source === 'github' ? (formData?.githubUsername || '') : '',
    linkedinPaste: source === 'linkedin' ? (formData?.linkedinPaste || '') : '',
    llmDump: source === 'selfReport' ? (formData?.llmDump || '') : '',
  };
}

function hasInput(source, formData) {
  if (source === 'github') return Boolean(formData?.githubUsername?.trim());
  if (source === 'linkedin') return Boolean(formData?.linkedinPaste?.trim());
  return Boolean(formData?.llmDump?.trim());
}

function parseSourceFailure(source, payload) {
  if (!payload?.warnings) return null;
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [payload.warnings];
  const text = warnings.join(' ').toLowerCase();
  if (source === 'github' && text.includes('github')) return warnings[0];
  return null;
}

export default function useIngest(initialStatuses) {
  const [statuses, setStatuses] = useState({
    ...normalizeInitialStatuses(initialStatuses),
  });
  const [errors, setErrors] = useState(createInitialErrors());

  const setSourceStatus = useCallback((source, status, error = null) => {
    setStatuses((prev) => ({ ...prev, [source]: status }));
    setErrors((prev) => ({ ...prev, [source]: error }));
  }, []);

  const ingestSource = useCallback(async (source, formData) => {
    if (!SOURCE_KEYS.includes(source)) {
      throw new Error(`Unknown source: ${source}`);
    }

    if (!hasInput(source, formData)) {
      setSourceStatus(source, 'skipped', null);
      return { status: 'skipped', source };
    }

    setSourceStatus(source, 'loading', null);

    const res = await fetch('/api/ingest', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(buildSourcePayload(source, formData)),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = payload?.error || `Failed to ingest ${source}`;
      setSourceStatus(source, 'failed', error);
      throw new Error(error);
    }

    const ingestSourceKey = SOURCE_TO_INGEST_KEY[source];
    const sourceChunks = (payload?.chunks || []).filter((chunk) => chunk.source === ingestSourceKey);
    const warning = parseSourceFailure(source, payload);
    if (!sourceChunks.length || warning) {
      const error = warning || `No ${source} data found`;
      setSourceStatus(source, 'failed', error);
      throw new Error(error);
    }

    setSourceStatus(source, 'success', null);
    return { status: 'success', source, chunks: sourceChunks };
  }, [setSourceStatus]);

  const skipSource = useCallback((source) => {
    setSourceStatus(source, 'skipped', null);
  }, [setSourceStatus]);

  const refetchSource = useCallback(async (source, formData) => ingestSource(source, formData), [ingestSource]);

  const proceedWithSkipped = useCallback(async (formData) => {
    const normalized = { ...statuses };
    SOURCE_KEYS.forEach((source) => {
      if (!hasInput(source, formData) && normalized[source] === 'idle') {
        normalized[source] = 'skipped';
      }
    });

    const allFailed = SOURCE_KEYS.every((source) => normalized[source] === 'failed');
    if (allFailed) {
      throw new Error('All three sources failed. Retry one source or skip one to proceed.');
    }

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
  }, [statuses]);

  const hasAnySuccess = useMemo(
    () => SOURCE_KEYS.some((source) => statuses[source] === 'success' || statuses[source] === 'skipped'),
    [statuses],
  );

  return {
    statuses,
    errors,
    ingestSource,
    skipSource,
    refetchSource,
    proceedWithSkipped,
    hasAnySuccess,
  };
}
