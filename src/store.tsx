import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ERPState, Res } from './engine/types';
import { buildSeedState, resetMasters } from './engine/seed';
import { MATERIALS, PARTNERS } from './engine/config';

export interface Toast { id: number; msg: string; tone: 'ok' | 'bad' | 'warn' | 'info'; }

const LS_KEY = 'vulcan-erp-core-v6';

interface Persisted { s: ERPState; m: typeof MATERIALS; p: typeof PARTNERS; }

function loadInitial(): ERPState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Persisted;
      if (data.s && data.s.v === 6 && Array.isArray(data.m) && Array.isArray(data.p)) {
        MATERIALS.splice(0, MATERIALS.length, ...data.m);
        PARTNERS.splice(0, PARTNERS.length, ...data.p);
        return data.s;
      }
    }
  } catch {
    /* fall through to fresh seed */
  }
  return buildSeedState();
}

interface StoreCtx {
  state: ERPState;
  toasts: Toast[];
  run: (fn: (s: ERPState) => Res) => void;
  toast: (msg: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
  setUser: (id: string) => void;
  setCompanyFilter: (c: string) => void;
  reset: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ERPState>(loadInitial);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const toast = useCallback((msg: string, tone: Toast['tone'] = 'info') => {
    const id = idRef.current++;
    setToasts((t) => [...t.slice(-4), { id, msg, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6200);
  }, []);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const run = useCallback((fn: (s: ERPState) => Res) => {
    setState((prev) => {
      const res = fn(prev);
      if (res.msg) {
        const id = idRef.current++;
        setToasts((t) => [...t.slice(-4), { id, msg: res.msg, tone: res.tone }]);
        window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6200);
      }
      return res.s;
    });
  }, []);

  const setUser = useCallback((id: string) => setState((s) => ({ ...s, userId: id })), []);
  const setCompanyFilter = useCallback((c: string) => setState((s) => ({ ...s, companyFilter: c })), []);

  const reset = useCallback(() => {
    resetMasters();
    const fresh = buildSeedState();
    setState(fresh);
    localStorage.removeItem(LS_KEY);
    const id = idRef.current++;
    setToasts([{ id, msg: 'Demo reset — opening position rebuilt by replaying engine transactions.', tone: 'info' }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6200);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ s: state, m: MATERIALS, p: PARTNERS } satisfies Persisted));
      } catch {
        /* storage full / unavailable — non-fatal */
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [state]);

  const value = useMemo(
    () => ({ state, toasts, run, toast, dismiss, setUser, setCompanyFilter, reset }),
    [state, toasts, run, toast, dismiss, setUser, setCompanyFilter, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside provider');
  return v;
}

/* ---------------- navigation (app-level) ---------------- */

export type PageId =
  | 'cockpit' | 'launchpad' | 'gate' | 'gate6' | 'gate7' | 'gate8' | 'gate9' | 'gate10a' | 'gate10b' | 'gate10c' | 'structure' | 'masters' | 'procurement' | 'inventory'
  | 'plant' | 'quality' | 'simulator' | 'config' | 'audit';

interface NavCtx {
  page: PageId;
  go: (p: PageId) => void;
  focusDocId: string | null;
  focusDoc: (id: string | null, page?: PageId) => void;
}
const Nav = createContext<NavCtx | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageId>('cockpit');
  const [focusDocId, setFocusDocId] = useState<string | null>(null);
  const go = useCallback((p: PageId) => setPage(p), []);
  const focusDoc = useCallback((id: string | null, p?: PageId) => {
    setFocusDocId(id);
    if (p) setPage(p);
  }, []);
  const value = useMemo(() => ({ page, go, focusDocId, focusDoc }), [page, go, focusDocId, focusDoc]);
  return <Nav.Provider value={value}>{children}</Nav.Provider>;
}

export function useNav(): NavCtx {
  const v = useContext(Nav);
  if (!v) throw new Error('useNav outside provider');
  return v;
}
