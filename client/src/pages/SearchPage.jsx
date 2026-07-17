import React, { useState } from 'react';
import { Search, FileText, User, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api';

const SEV_COLOR = { 1:'#58c095', 2:'#6f9c8f', 3:'#d2a552', 4:'#e58746', 5:'#df4f61' };

export default function SearchPage() {
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleSearch = async e => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setError(null); setResults(null);
    api.search(q.trim())
      .then(setResults)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-white flex items-center gap-2">
        <Search size={20} className="text-blue-400" /> Search
      </h1>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Search by FIR number, crime type, offender name, alias…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button type="submit" disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search
        </button>
      </form>

      {error && (
        <div className="bg-red-950 border border-red-700 rounded-lg p-3 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {results && (
        <div className="space-y-6">
          {/* Crimes */}
          {results.crimes?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <FileText size={14} className="text-blue-400" />
                Crime Records ({results.crimes.length})
              </h2>
              <div className="space-y-2">
                {results.crimes.map(c => (
                  <div key={c.crime_id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-600 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">{c.fir_number}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{c.crime_type} · {c.district} · {c.incident_date}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{c.status}</span>
                        <span className="w-2 h-2 rounded-full" style={{background: c.status?.includes('Closed')?'#58c095':'#d2a552'}} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offenders */}
          {results.offenders?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <User size={14} className="text-purple-400" />
                Offender Records ({results.offenders.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.offenders.map(o => (
                  <div key={o.offender_id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-purple-600 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">{o.name}</div>
                        {o.alias && <div className="text-xs text-slate-400">aka "{o.alias}"</div>}
                        <div className="text-xs text-slate-500 mt-1">{o.gang_affiliation || 'No gang affiliation'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">{o.status}</div>
                        <div className="text-xs font-bold mt-1" style={{color: o.risk_score>=0.7?'#df4f61':o.risk_score>=0.4?'#d2a552':'#58c095'}}>
                          Risk: {((o.risk_score||0)*100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.crimes?.length === 0 && results.offenders?.length === 0 && (
            <div className="text-center text-slate-500 py-12">
              No results found for "{q}"
            </div>
          )}
        </div>
      )}

      {!results && !loading && (
        <div className="text-center text-slate-600 py-16">
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <div>Search by FIR number, crime type, offender name or alias</div>
        </div>
      )}
    </div>
  );
}
