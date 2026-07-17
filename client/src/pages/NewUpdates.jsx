import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Bell, Clock, FileWarning,
  Loader2, ShieldCheck, UserPlus
} from 'lucide-react';
import { api } from '../api';

const TYPE_CONFIG = {
  officer: {
    label: 'Officers',
    icon: ShieldCheck,
    dot: 'bg-emerald-400',
    border: 'border-emerald-700/60',
    iconBg: 'bg-emerald-950 text-emerald-300',
  },
  crime: {
    label: 'Crimes',
    icon: FileWarning,
    dot: 'bg-amber-400',
    border: 'border-amber-700/60',
    iconBg: 'bg-amber-950 text-amber-300',
  },
  offender: {
    label: 'Offenders',
    icon: UserPlus,
    dot: 'bg-blue-400',
    border: 'border-blue-700/60',
    iconBg: 'bg-blue-950 text-blue-300',
  },
};

const PRIORITY_CLASS = {
  High: 'bg-red-950 text-red-300 border-red-800',
  Watch: 'bg-amber-950 text-amber-300 border-amber-800',
  Normal: 'bg-slate-800 text-slate-300 border-slate-700',
};

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function UpdateRow({ update }) {
  const cfg = TYPE_CONFIG[update.type] || TYPE_CONFIG.crime;
  const Icon = cfg.icon;

  return (
    <article className={`rounded-lg border ${cfg.border} bg-slate-900/80 px-4 py-3`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${cfg.iconBg}`}>
          <Icon size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            <h2 className="text-sm font-semibold text-white">{update.title}</h2>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${PRIORITY_CLASS[update.priority] || PRIORITY_CLASS.Normal}`}>
              {update.priority || 'Normal'}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-300">{update.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock size={13} /> {formatDate(update.occurred_at)}
            </span>
            {update.district && <span>{update.district}</span>}
            {update.subject && <span className="text-slate-400">{update.subject}</span>}
            {update.meta?.fir_number && <span>{update.meta.fir_number}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function NewUpdates() {
  const [updates, setUpdates] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.updates()
      .then(setUpdates)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => updates.reduce((acc, update) => {
    acc[update.type] = (acc[update.type] || 0) + 1;
    return acc;
  }, {}), [updates]);

  const visibleUpdates = filter === 'all'
    ? updates
    : updates.filter(update => update.type === filter);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Bell size={20} className="text-blue-400" /> New Updates
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Live roster, offender, and case activity
          </p>
        </div>
        {loading && <Loader2 size={18} className="animate-spin text-blue-400" />}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-700 bg-red-950 p-4 text-sm text-red-300">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg border p-3 text-left transition-colors ${filter === 'all' ? 'border-blue-500 bg-blue-950/60' : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}
        >
          <div className="flex items-center justify-between">
            <Activity size={17} className="text-blue-300" />
            <span className="text-lg font-bold text-white">{updates.length}</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">All</div>
        </button>

        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`rounded-lg border p-3 text-left transition-colors ${filter === type ? 'border-blue-500 bg-blue-950/60' : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}
            >
              <div className="flex items-center justify-between">
                <Icon size={17} className="text-slate-300" />
                <span className="text-lg font-bold text-white">{counts[type] || 0}</span>
              </div>
              <div className="mt-2 text-xs text-slate-400">{cfg.label}</div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Showing {visibleUpdates.length} of {updates.length}</span>
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} className="text-blue-400 hover:text-blue-300">
            Clear filter
          </button>
        )}
      </div>

      {!loading && visibleUpdates.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-500">
          No updates available.
        </div>
      )}

      <div className="space-y-3">
        {visibleUpdates.map(update => (
          <UpdateRow key={update.id} update={update} />
        ))}
      </div>
    </div>
  );
}
