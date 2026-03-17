import { useCallback, useEffect, useRef, useState } from 'react';

export default function useAsyncFn(asyncFn) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const execute = useCallback(async (...args) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await asyncFn(...args);
      if (mountedRef.current) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
      }
      throw err;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [asyncFn]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { execute, data, isLoading, error, reset };
}
