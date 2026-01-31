import { useState, useEffect } from 'react';

export const useUrl = () => {
  const [url, setUrl] = useState<string>(globalThis.location?.href || '');
  const [path, setPath] = useState<string>(globalThis.location?.pathname || '');

  useEffect(() => {
    const checkUrl = () => {
      if (globalThis.location.href !== url) {
        setUrl(globalThis.location.href);
        setPath(globalThis.location.pathname);
      }
    };

    checkUrl();

    const handlePopState = () => checkUrl();
    // Intercept pushState/replaceState if possible, but polling is safer for external SPA frameworks
    // We can also listen to a custom event if we dispatch it from our navigate function
    globalThis.addEventListener('popstate', handlePopState);
    
    // Polling as backup for SPA changes that might not trigger popstate
    const interval = setInterval(checkUrl, 500);

    return () => {
      globalThis.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, [url]);

  return { url, path };
};
