import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer, ZAxis
} from 'recharts';
import { Shield, TrendingUp, Activity, GitBranch, Loader2 } from 'lucide-react';
import { api } from '../api';

const RISK_COLOR = score =>
  score >= 70 ? '#df4f61' : score >= 50 ? '#e58746' : score >= 35 ? '#d2a552' : '#58c095';

const RISK_BAND_COLOR = { HIGH:'#df4f61', MEDIUM:'#d2a552', LOW:'#58c095' };

function RiskGauge({ score }) {
  const angle = -135 + (score / 100) * 270;
  return (
    <div className="relative w-24 h-14 mx-auto">
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#363d52" strokeWidth="8" strokeLinecap="round"/>
        <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none"
          stroke={RISK_COLOR(score)} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${score * 1.26} 126`}
        />
        <line x1="50" y1="55" x2={50+35*Math.cos((angle-90)*Math.PI/180)}
          y2={55+35*Math.sin((angle-90)*Math.PI/180)}
          stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="50" cy="55" r="3" fill="white"/>
        <text x="50" y="42" textAnchor="middle" fontSize="12" fill={RISK_COLOR(score)} fontWeight="bold">{score}</text>
      </svg>
    </div>
  );
}

export default function Predictions() {
  const [risks,    setRisks]    = useState([]);
  const [hotzones, setHotzones] = useState([]);
  const [corrs,    setCorrs]    = useState(null);
  const [anomalies,setAnomalies]= useState([]);
  const [recid,    setRecid]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('risk');

  useEffect(() => {
    Promise.all([
      api.riskScores(2024).catch(()=>[]),
      api.hotzonePred().catch(()=>[]),
      api.correlations().catch(()=>null),
      api.anomalies().catch(()=>[]),
      api.recidivism().catch(()=>null),
    ]).then(([r, h, c, a, rec]) => {
      setRisks(r);
      setHotzones(h);
      setCorrs(c);
      setAnomalies(a);
      setRecid(rec);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="animate-spin mr-2" /> Loading predictions…
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield size={20} className="text-blue-400" /> Predictive Intelligence
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        {[['risk','Risk Scores'],['hotzones','Rising Trends'],['correlations','Correlations'],['anomalies','Anomalies'],['recidivism','Recidivism']].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab===v?'bg-blue-600 text-white':'text-slate-400 hover:text-white'}`}
          >{l}</button>
        ))}
      </div>

      {/* ── Risk Scores ─────────────────────────────────────────────────── */}
      {tab === 'risk' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">Composite risk index (0–100) based on crime rate, SEI, unemployment, severity, and unsolved cases.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {risks.map(d => (
              <div key={d.district} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="text-xs font-semibold text-white mb-2">{d.district}</div>
                <RiskGauge score={d.risk_score} />
                <div className="mt-2 text-center">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{background: RISK_BAND_COLOR[d.risk_band]+'33', color: RISK_BAND_COLOR[d.risk_band]}}>
                    {d.risk_band}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {[['Crime/100k', d.crime_rate_100k], ['Unsolved', `${(d.unsolved_rate*100).toFixed(0)}%`]].map(([l,v])=>(
                    <div key={l} className="flex justify-between text-xs">
                      <span className="text-slate-400">{l}</span>
                      <span className="text-slate-200">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rising Trends ────────────────────────────────────────────────── */}
      {tab === 'hotzones' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">Crime types trending upward by predicted next-month count. Recent average is shown in the tooltip and cards.</p>
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={hotzones.slice(0,15)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
                <XAxis type="number" tick={{fill:'#94a3b8',fontSize:10}} />
                <YAxis dataKey="crime_type" type="category" width={120}
                  tick={{fill:'#94a3b8',fontSize:10}}
                  tickFormatter={v => v.length>12?v.slice(0,12)+'…':v} />
                <Tooltip
                  contentStyle={{background:'#191c2b',border:'1px solid #505a72',borderRadius:6}}
                  formatter={(v,n,props) => [
                    v,
                    n === 'predicted_next_month'
                      ? `Predicted next month (recent avg ${props?.payload?.recent_avg ?? 'n/a'})`
                      : n
                  ]}
                />
                <Bar dataKey="predicted_next_month" fill="#df4f61" radius={[0,3,3,0]} name="Predicted next month">
                  {hotzones.slice(0,15).map((h,i) => (
                    <Cell key={`trend-cell-${i}`} fill={h.predicted_next_month > h.recent_avg ? '#df4f61' : '#5aa8c0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hotzones.slice(0,6).map((h,i) => (
              <div key={i} className={`bg-slate-800 rounded-lg p-4 border ${h.alert_level==='HIGH'?'border-red-600':'border-orange-600'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">{h.crime_type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${h.alert_level==='HIGH'?'bg-red-600':'bg-orange-600'} text-white`}>{h.alert_level}</span>
                </div>
                <div className="text-xs text-slate-400 mb-2">{h.district}</div>
                <div className="flex gap-4 text-xs">
                  <div><span className="text-slate-500">Trend:</span> <span className="text-red-400 font-bold">+{h.trend_pct_per_month}%/mo</span></div>
                  <div><span className="text-slate-500">Recent avg:</span> <span className="text-slate-200 font-bold">{h.recent_avg}</span></div>
                  <div><span className="text-slate-500">Next mo:</span> <span className="text-white font-bold">{h.predicted_next_month}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Correlations ─────────────────────────────────────────────────── */}
      {tab === 'correlations' && corrs && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">Pearson correlation between socio-economic factors and crime.</p>
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Factor Correlations</h3>
            <div className="space-y-3">
              {(corrs.correlations||[]).map(c => (
                <div key={c.factor} className="bg-slate-900 rounded-lg p-3">
                  <div className="text-xs font-semibold text-slate-300 mb-2 capitalize">{c.factor.replace(/_/g,' ')}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[['vs Crime Count', c.corr_with_crime_count], ['vs Avg Severity', c.corr_with_avg_severity]].map(([l,v])=>{
                      const pct = Math.abs(v) * 100;
                      const pos = v > 0;
                      return (
                        <div key={l}>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>{l}</span>
                            <span className={pos?'text-red-400':'text-green-400'}>{v > 0 ? '+' : ''}{v}</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${pct}%`, marginLeft: v < 0 ? `${100-pct}%` : 0,
                              background: pos ? '#df4f61' : '#58c095'
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scatter */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">SEI vs Crime Count (District Scatter)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
                <XAxis type="number" dataKey="socio_economic" name="SEI" tick={{fill:'#94a3b8',fontSize:10}} label={{value:'Socio-Economic Index',position:'bottom',fill:'#64748b',fontSize:10}} />
                <YAxis type="number" dataKey="total_crimes"   name="Crimes" tick={{fill:'#94a3b8',fontSize:10}} />
                <ZAxis range={[40,200]} />
                <Tooltip cursor={{strokeDasharray:'3 3'}}
                  contentStyle={{background:'#191c2b',border:'1px solid #505a72',borderRadius:6}}
                  formatter={(v,n,p) => [p.payload.district || v, n]}
                />
                <Scatter data={corrs.scatter_data||[]} fill="#20c7e8" fillOpacity={0.8} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Anomalies ────────────────────────────────────────────────────── */}
      {tab === 'anomalies' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">Monthly counts deviating &gt;2σ from historical mean.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-700">
                  {['District','Crime Type','Year','Month','Count','Mean','Z-score','Dir','Magnitude'].map(h=>(
                    <th key={h} className="pb-2 pr-4 text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anomalies.slice(0,30).map((a,i)=>(
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-800 transition-colors">
                    <td className="py-2 pr-4 text-white">{a.district}</td>
                    <td className="py-2 pr-4 text-slate-300">{a.crime_type}</td>
                    <td className="py-2 pr-4 text-slate-400">{a.year}</td>
                    <td className="py-2 pr-4 text-slate-400">{a.month}</td>
                    <td className="py-2 pr-4 font-bold text-white">{a.count}</td>
                    <td className="py-2 pr-4 text-slate-400">{a.mean}</td>
                    <td className={`py-2 pr-4 font-bold ${a.z_score>0?'text-red-400':'text-green-400'}`}>{a.z_score > 0 ? '+' : ''}{a.z_score}σ</td>
                    <td className="py-2 pr-4">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${a.direction==='SPIKE'?'bg-red-900 text-red-300':'bg-green-900 text-green-300'}`}>{a.direction}</span>
                    </td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${a.magnitude==='EXTREME'?'bg-red-600 text-white':a.magnitude==='HIGH'?'bg-orange-600 text-white':'bg-yellow-700 text-white'}`}>{a.magnitude}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recidivism ───────────────────────────────────────────────────── */}
      {tab === 'recidivism' && recid && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Conviction Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={Object.entries(recid.conviction_distribution).map(([k,v])=>({range:k,count:v}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
                  <XAxis dataKey="range" tick={{fill:'#94a3b8',fontSize:11}} label={{value:'Prior Convictions',position:'bottom',fill:'#64748b',fontSize:10}} />
                  <YAxis tick={{fill:'#94a3b8',fontSize:11}} />
                  <Tooltip contentStyle={{background:'#191c2b',border:'1px solid #505a72',borderRadius:6}} />
                  <Bar dataKey="count" fill="#20c7e8" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Gang Affiliation Breakdown</h3>
              <div className="space-y-2">
                {Object.entries(recid.gang_breakdown||{}).map(([g,n])=>(
                  <div key={g}>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>{g}</span><span className="font-bold">{n}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{width:`${n/recid.total_repeat_offenders*100}%`}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 text-sm font-semibold text-slate-300">
              Top Repeat Offenders
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-900">
                    {['Name','Alias','Convictions','Risk','Age','Status','Gang'].map(h=>(
                      <th key={h} className="px-4 py-2 text-left text-slate-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(recid.top_repeat_offenders||[]).map((o,i)=>(
                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-900">
                      <td className="px-4 py-2 text-white font-medium">{o.name}</td>
                      <td className="px-4 py-2 text-slate-400">{o.alias||'—'}</td>
                      <td className="px-4 py-2">
                        <span className="bg-red-900 text-red-300 px-2 py-0.5 rounded font-bold">{o.prior_convictions}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span style={{color: RISK_COLOR((o.risk_score||0)*100)}} className="font-bold">{((o.risk_score||0)*100).toFixed(0)}%</span>
                      </td>
                      <td className="px-4 py-2 text-slate-300">{o.age}</td>
                      <td className="px-4 py-2 text-slate-300">{o.status}</td>
                      <td className="px-4 py-2 text-slate-400">{o.gang_affiliation||'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
