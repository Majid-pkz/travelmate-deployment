import { useEffect, useState } from 'react';
import { apiBaseUrl, apiUrl } from '../utils/api.mjs';
import './ApiStatus.css';

export default function ApiStatus() {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    if (!apiBaseUrl) return;
    const controller = new AbortController();
    const timers = new Set();
    const later = (callback, ms) => {
      const timer = setTimeout(() => { timers.delete(timer); callback(); }, ms);
      timers.add(timer);
      return timer;
    };
    setStatus('checking');
    later(() => setStatus('starting'), 1200);
    const deadline = Date.now() + 90_000;
    async function check() {
      if (controller.signal.aborted) return;
      try {
        const response = await fetch(apiUrl('/api/health'), {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(Math.min(10_000, Math.max(1, deadline - Date.now())))]),
        });
        if (response.ok && (await response.json()).status === 'ok') {
          for (const timer of timers) clearTimeout(timer);
          timers.clear();
          if (!controller.signal.aborted) setStatus('ready');
          return;
        }
      } catch {
        // A sleeping service may time out or return a loading page before JSON.
      }
      if (controller.signal.aborted) return;
      if (Date.now() >= deadline) setStatus('offline');
      else later(check, 2000);
    }
    void check();
    return () => {
      controller.abort();
      for (const timer of timers) clearTimeout(timer);
    };
  }, [attempt]);
  if (!apiBaseUrl || status === 'checking' || status === 'ready') return null;
  return <output className="api-status" aria-live="polite">
    {status === 'starting'
      ? 'Live features are starting. Please allow up to a minute for accounts and trips to become available.'
      : <>Live features are temporarily unavailable. <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></>}
  </output>;
}
