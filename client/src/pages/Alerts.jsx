import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bell, TrendingUp, Loader2 } from 'lucide-react';
import { api } from '../api';

const SEV_CONFIG = {
  CRITICAL: { bg: 'bg-red-950', border: 'border-red-500', text: 'text-red-400', badge: 'bg-red-500', pulse: 'pulse-red'   },
  HIGH:     { bg: 'bg-orange-950', border: 'border-orange-500', text: 'text-orange-400', badge: 'bg-orange-500', pulse: 'pulse-orange' },
  MEDIUM:   { bg: 'bg-yellow-950', border: 'border-yellow-600', text: 'text-yellow-400', badge: 'bg-yellow-600', pulse: '' },
};

function AlertCard({ a }) {
  const cfg = SEV_CONFIG[a.severity] || SEV_CONFIG.MEDIUM;
  return (
    <div className={`${cfg.bg} ${cfg.border} border rounded-xl p-4 relative overflow-hidden`}>
      {/* Severity badge */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`${cfg.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full ${cfg.pulse}`}>
            {a.severity}
          </span>
          <span className="text-white font-semibold text-sm">{a.crime_type}</span>
        </div>
        <TrendingUp size={16} className={cfg.text} />
      </div>

      <div className="text-slate-300 text-xs mb-3">
        <span className="font-medium text-white">{a.district}</span> — spike detected in last 60 days
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className={`text-lg font-bold ${cfg.text}`}>{a.recent_count}</div>
          <div className="text-slate-400">Recent (60d)</div>
        </div>
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-slate-300">{a.avg_monthly}</div>
          <div className="text-slate-400">Avg / month</div>
        </div>
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className={`text-lg font-bold ${cfg.text}`}>+{a.pct_above_avg}%</div>
          <div className="text-slate-400">Above avg</div>
        </div>
      </div>

      {/* Z-score bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Statistical deviation (z-score)</span>
          <span className={cfg.text}>{a.z_score}σ</span>
        </div>
        <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, a.z_score / 5 * 100)}%`,
              background: a.severity === 'CRITICAL' ? '#ef4444' : a.severity === 'HIGH' ? '#f97316' : '#eab308'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Alerts() {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');
  const [error,   setError]   = useState(null);

  useEffect(() => {
    api.alerts()
      .then(setAlerts)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);

  const counts = {
    CRITICAL: alerts.filter(a=>a.severity==='CRITICAL').length,
    HIGH:     alerts.filter(a=>a.severity==='HIGH').length,
    MEDIUM:   alerts.filter(a=>a.severity==='MEDIUM').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell size={20} className="text-red-400" /> Anomaly Alerts
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Statistical spike detection — crimes deviating &gt;1.5σ from historical baseline
          </p>
        </div>
        {loading && <Loader2 size={18} className="animate-spin text-blue-400" />}
      </div>

      {error && (
        <div className="bg-red-950 border border-red-700 rounded-lg p-4 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-4">
        {[['CRITICAL','text-red-400','border-red-700'],
          ['HIGH','text-orange-400','border-orange-700'],
          ['MEDIUM','text-yellow-400','border-yellow-700']].map(([sev,tc,bc]) => (
          <button key={sev} onClick={()=>setFilter(sev===filter?'all':sev)}
            className={`bg-slate-800 ${bc} border rounded-xl p-4 text-center transition-all ${sev===filter?'ring-2 ring-offset-1 ring-offset-slate-950 ring-current':''}`}>
            <div className={`text-3xl font-bold ${tc}`}>{counts[sev]}</div>
            <div className="text-xs text-slate-400 mt-1">{sev}</div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">
          Showing {filtered.length} of {alerts.length} alerts
        </div>
        <button onClick={()=>setFilter('all')}
          className="text-xs text-blue-400 hover:text-blue-300">Clear filter</button>
      </div>

      {/* Alert grid */}
      {!loading && filtered.length === 0 && (
        <div className="text-center text-slate-500 py-16">
          No alerts match the current filter.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((a, i) => <AlertCard key={i} a={a} />)}
      </div>
    </div>
  );
}
