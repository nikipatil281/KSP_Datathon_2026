import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Loader2, LogOut, ShieldCheck, UserRound } from 'lucide-react';

const AUTH_REQUIRED = import.meta.env.VITE_REQUIRE_CATALYST_AUTH === 'true';
const AuthContext = createContext({ user: null, officer: null, authRequired: AUTH_REQUIRED });

function getRedirectUrl() {
  const appPath = window.location.pathname.startsWith('/app') ? '/app/index.html' : '/';
  return `${window.location.origin}${appPath}`;
}

function getCatalystAuth() {
  return window.catalyst?.auth;
}

function normalizeOfficer(user) {
  if (!user) return null;
  const id = user.user_id || user.zaid || user.ZUID || user.email_id || user.email || 'demo-officer';
  const email = user.email_id || user.email || '';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
    || user.display_name
    || user.name
    || email
    || 'Signed in officer';

  return { id: String(id), email, name, raw: user };
}

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthGate({ children }) {
  const [checking, setChecking] = useState(AUTH_REQUIRED);
  const [sdkReady, setSdkReady] = useState(!AUTH_REQUIRED);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!AUTH_REQUIRED) return undefined;

    let cancelled = false;
    let attempts = 0;

    const checkAuth = () => {
      const auth = getCatalystAuth();
      attempts += 1;

      if (!auth?.isUserAuthenticated) {
        if (attempts < 40) {
          window.setTimeout(checkAuth, 200);
          return;
        }
        if (!cancelled) {
          setChecking(false);
          setSdkReady(false);
          setError('Catalyst Web SDK is not available yet. Open this app from Catalyst Web Client Hosting after enabling Authentication.');
        }
        return;
      }

      setSdkReady(true);
      auth.isUserAuthenticated()
        .then(response => {
          if (!cancelled) {
            setUser(response?.content || null);
            setError('');
          }
        })
        .catch(() => {
          if (!cancelled) setUser(null);
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    };

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!AUTH_REQUIRED || checking || user || !sdkReady) return;
    const auth = getCatalystAuth();
    if (auth?.signIn) {
      auth.signIn('catalyst-login-box', { service_url: getRedirectUrl() });
    }
  }, [checking, sdkReady, user]);

  const officer = useMemo(() => normalizeOfficer(user), [user]);

  if (!AUTH_REQUIRED) {
    return (
      <AuthContext.Provider value={{ user: null, officer: null, authRequired: false }}>
        {children}
      </AuthContext.Provider>
    );
  }

  const logout = () => {
    const auth = getCatalystAuth();
    if (auth?.signOut) {
      auth.signOut(getRedirectUrl());
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
          <Loader2 size={16} className="animate-spin text-blue-400" />
          Checking Catalyst authentication...
        </div>
      </div>
    );
  }

  if (!sdkReady || error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
          <ShieldCheck size={28} className="mx-auto text-blue-400" />
          <h1 className="mt-4 text-lg font-semibold text-white">Catalyst Authentication Setup Needed</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{error}</p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            After enabling Embedded Authentication in the Catalyst console, redeploy and open the hosted Web Client URL.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center overflow-y-auto bg-slate-950 p-6">
        <div className="grid w-full max-w-6xl rounded-lg border border-slate-800 bg-slate-900 shadow-2xl lg:min-h-[760px] lg:grid-cols-[0.8fr_1.2fr]">
          <div className="border-b border-slate-800 bg-slate-950 p-8 lg:border-b-0 lg:border-r">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-900">
              <ShieldCheck size={20} className="text-blue-400" />
            </div>
            <h1 className="mt-5 text-2xl font-bold text-white">KSP Intelligence</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Sign in with Catalyst Authentication to access dashboards, FIR workflows, search, maps, and predictive intelligence.
            </p>
            <div className="mt-6 rounded-md border border-blue-900 bg-blue-950/40 p-3 text-xs leading-relaxed text-blue-200">
              Authentication is handled by Zoho Catalyst. User accounts and roles are managed from the Catalyst console.
            </div>
          </div>
          <div className="min-h-[760px] overflow-auto bg-slate-900 p-6">
            <div id="catalyst-login-box" className="min-h-[700px] rounded-lg border border-slate-800 bg-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, officer, authRequired: true }}>
      {children}
      <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-300 shadow-xl backdrop-blur">
        <UserRound size={14} className="text-blue-400" />
        <span className="max-w-[180px] truncate">{officer?.email || officer?.name || 'Signed in'}</span>
        <button
          type="button"
          onClick={logout}
          className="ml-1 flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:border-blue-500 hover:text-white"
        >
          <LogOut size={12} />
          Logout
        </button>
      </div>
    </AuthContext.Provider>
  );
}
