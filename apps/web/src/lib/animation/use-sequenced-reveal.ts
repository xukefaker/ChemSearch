'use client';

import { useEffect } from 'react';
import { animate, stagger } from 'motion';
import { useAnimate } from 'motion/react-mini';

export function useSequencedReveal(deps: readonly unknown[], selector = '[data-reveal-item]') {
  const [scope] = useAnimate();

  useEffect(() => {
    const root = scope.current;
    if (!root) {
      return;
    }
    const nodes = root.querySelectorAll(selector);
    if (nodes.length === 0) {
      return;
    }

    animate(
      nodes,
      { opacity: [0, 1], y: [14, 0], scale: [0.985, 1] },
      {
        duration: 0.28,
        delay: stagger(0.05),
        ease: [0.22, 1, 0.36, 1],
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scope;
}
