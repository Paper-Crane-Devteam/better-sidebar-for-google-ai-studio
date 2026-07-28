/**
 * useElapsedTime — seconds since `startedAt`, ticking while `active`.
 * Returns null when there is no start time.
 */

import { useEffect, useState } from 'react';

export function useElapsedTime(startedAt: number | null, active: boolean): number | null {
  const [elapsed, setElapsed] = useState<number | null>(
    startedAt ? Math.floor((Date.now() - startedAt) / 1000) : null,
  );

  useEffect(() => {
    if (startedAt === null) {
      setElapsed(null);
      return;
    }

    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();

    if (!active) return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt, active]);

  return elapsed;
}
