import { useCallback, useEffect, useState } from 'react';

export type AppRoute =
  | { page: 'landing' }
  | { page: 'admin' }
  | { page: 'exam'; encodedConfig: string }
  | { page: 'not-found'; pathname: string };

export function matchRoute(pathname: string): AppRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (normalized === '/') {
    return { page: 'landing' };
  }

  if (normalized === '/admin') {
    return { page: 'admin' };
  }

  if (normalized.startsWith('/exam/')) {
    const encodedConfig = normalized.slice('/exam/'.length);
    if (encodedConfig.length > 0) {
      return { page: 'exam', encodedConfig };
    }
  }

  return { page: 'not-found', pathname };
}

export function useSpaRouter() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname) return;
    window.history.pushState({}, '', to);
    setPathname(to);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const route = matchRoute(pathname);

  return { route, pathname, navigate };
}
