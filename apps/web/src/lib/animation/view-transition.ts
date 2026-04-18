'use client';

export function runViewTransition(update: () => void | Promise<void>) {
  const documentWithTransition = document as Document & {
    startViewTransition?: (callback: () => void | Promise<void>) => { finished?: Promise<void> };
  };

  if (typeof documentWithTransition.startViewTransition === 'function') {
    return documentWithTransition.startViewTransition(update);
  }

  void update();
  return null;
}

