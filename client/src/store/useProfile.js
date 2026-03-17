import { useCallback, useEffect, useMemo, useState } from 'react';

const profileCache = new Map();

function getAuthHeaders() {
  const token = localStorage.getItem('pulse_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildDefaultProfile(initialCharacterCard) {
  return {
    characterCard: initialCharacterCard || null,
    agentProfile: null,
    openLoops: [],
  };
}

function buildCacheKey(userId) {
  return userId || 'anonymous';
}

export default function useProfile({ userId, initialCharacterCard = null }) {
  const cacheKey = useMemo(() => buildCacheKey(userId), [userId]);
  const cached = profileCache.get(cacheKey);
  const [profile, setProfile] = useState(cached || buildDefaultProfile(initialCharacterCard));
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(Boolean(cached));

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const headers = getAuthHeaders();
    const requests = await Promise.allSettled([
      fetch('/api/auth/me', { headers, credentials: 'include' }),
      fetch('/api/agent-setup', { headers, credentials: 'include' }),
      fetch('/api/loops/overdue', { headers, credentials: 'include' }),
    ]);

    const errors = [];
    let characterCard = initialCharacterCard;
    let agentProfile = null;
    let openLoops = [];

    if (requests[0].status === 'fulfilled' && requests[0].value.ok) {
      const authData = await requests[0].value.json();
      characterCard = authData.characterCard || characterCard;
    } else if (requests[0].status === 'rejected') {
      errors.push('Failed to load user session');
    }

    if (requests[1].status === 'fulfilled' && requests[1].value.ok) {
      const setupData = await requests[1].value.json();
      agentProfile = setupData.profile || null;
    } else if (requests[1].status === 'rejected') {
      errors.push('Failed to load agent profile');
    }

    if (requests[2].status === 'fulfilled' && requests[2].value.ok) {
      const loopData = await requests[2].value.json();
      openLoops = Array.isArray(loopData.overdue) ? loopData.overdue : [];
    } else if (requests[2].status === 'rejected') {
      errors.push('Failed to load open loops');
    }

    const nextProfile = {
      characterCard: characterCard || null,
      agentProfile,
      openLoops,
    };

    setProfile(nextProfile);
    setIsLoading(false);
    setIsLoaded(true);
    profileCache.set(cacheKey, nextProfile);

    if (errors.length) {
      setError(new Error(errors.join('. ')));
    }

    return nextProfile;
  }, [cacheKey, initialCharacterCard]);

  useEffect(() => {
    if (cached) {
      setProfile(cached);
      setIsLoaded(true);
      setIsLoading(false);
      return;
    }

    refetch().catch(() => {});
  }, [cached, refetch]);

  return { profile, refetch, isLoading, error, isLoaded };
}
