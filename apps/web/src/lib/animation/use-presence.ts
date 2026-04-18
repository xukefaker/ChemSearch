'use client';

import { useEffect, useState } from 'react';

export type PresencePhase = 'entering' | 'entered' | 'exiting';

export function usePresence(open: boolean, durationMs = 220) {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<PresencePhase>(open ? 'entered' : 'exiting');

  useEffect(() => {
    let frameId: number | null = null;
    let timeoutId: number | null = null;

    if (open) {
      setMounted(true);
      setPhase('entering');
      frameId = window.requestAnimationFrame(() => {
        setPhase('entered');
      });
    } else if (mounted) {
      setPhase('exiting');
      timeoutId = window.setTimeout(() => {
        setMounted(false);
      }, durationMs);
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [durationMs, mounted, open]);

  return { mounted, phase };
}

