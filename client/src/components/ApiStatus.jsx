import { useEffect, useState } from 'react';
import { apiBaseUrl, apiUrl } from '../utils/api.mjs';
import './ApiStatus.css';

export default function ApiStatus({ onReady }) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    if (!apiBaseUrl) return;
    const controller = new AbortController();
    const timers = new Set();
    let retryReads = attempt > 0;
    const later = (callback, ms) => {
      const timer = setTimeout(() => { timers.delete(timer); callback(); }, ms);
      timers.add(timer);
      return timer;
    };
    setStatus(attempt > 0 ? 'starting' : 'checking');
    later(() => { retryReads = true; setStatus('starting'); }, 1200);
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
          if (!controller.signal.aborted) {
            setStatus('ready');
            if (retryReads) onReady?.();
          }
          return;
        }
      } catch {
        // A sleeping service may time out or return a loading page before JSON.
      }
      if (controller.signal.aborted) return;
      retryReads = true;
      if (Date.now() >= deadline) setStatus('offline');
      else later(check, 2000);
    }
    void check();
    return () => {
      controller.abort();
      for (const timer of timers) clearTimeout(timer);
    };
  }, [attempt, onReady]);
  if (!apiBaseUrl || status === 'checking' || status === 'ready') return null;
  return <output className="api-status" aria-live="polite">
    <span className="api-status__text">
      <strong>{status === 'starting' ? 'TravelMate is waking up.' : 'The demo is taking longer than expected.'}</strong>
      <span>{status === 'starting'
        ? 'This demo uses free hosting and usually wakes up in about a minute. Keep this page open; we’ll connect automatically.'
        : 'We couldn’t connect after 90 seconds. Select Try again and allow another minute. If it still won’t connect, please try again later.'}</span>
    </span>
    <button type="button" disabled={status === 'starting'} onClick={() => {
      setStatus('starting');
      setAttempt(value => value + 1);
    }}>{status === 'starting' ? 'Connecting…' : 'Try again'}</button>
  </output>;
}
