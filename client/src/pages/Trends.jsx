import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';
import { api } from '../api';

const COLORS = ['#20c7e8','#8fa8d8','#6f9c8f','#c29b68','#9d89ad','#c97880','#6f879c','#9ab6bc','#b4a867'];
const CRIME_TYPES = ['Theft','Robbery','Assault','Cybercrime','Drug Offence','Fraud','Murder','Kidnapping','Sexual Assault','Vandalism'];
const DISTRICTS   = ['Bengaluru Urban','Mysuru','Belagavi','Kalaburagi','Dharwad','Ballari','Shivamogga','Tumakuru','Dakshina Kannada','Hassan'];
const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildMonthlyTimeSeries(rows, selectedTypes) {
  // Build year-month x axis with one line per selected crime type
  const pivot = {};
  for (const r of rows) {
    const key = `${r.year}-${String(r.month).padStart(2,'0')}`;
    if (!pivot[key]) pivot[key] = { key };
    if (selectedTypes.includes(r.crime_type)) {
      pivot[key][r.crime_type] = (pivot[key][r.crime_type] || 0) + r.incident_count;
    }
  }
  return Object.values(pivot).sort((a,b) => a.key.localeCompare(b.key))
    .map(d => ({ ...d, label: d.key.replace('-','/')}));
}

function buildYearCompare(rows) {
  // Total per year per month (for area chart)
  const data = {};
  for (const r of rows) {
    const mk = MONTHS[r.month-1];
    if (!data[mk]) data[mk] = { month: mk };
    data[mk][r.year] = (data[mk][r.year] || 0) + r.incident_count;
  }
  return MONTHS.map(m => data[m] || { month: m });
}

export default function Trends() {
  const [rawData,   setRawData]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [district,  setDistrict]  = useState('');
  const [selTypes,  setSelTypes]  = useState(['Theft','Robbery','Assault']);

  const [detailTab, setDetailTab] = useState('yearly'); // yearly | solve

  useEffect(() => {
    setLoading(true);
    api.trends({ district: district || undefined })
      .then(setRawData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [district]);

  const timelineSeries = buildMonthlyTimeSeries(rawData, selTypes);
  const yearCompareSeries = buildYearCompare(rawData);

  // Solve-rate trend
  const solveByYear = {};
  for (const r of rawData) {
    if (!solveByYear[r.year]) solveByYear[r.year] = { year: r.year, total: 0, solved: 0 };
    solveByYear[r.year].total  += r.incident_count;
    solveByYear[r.year].solved += r.solved_count;
  }
  const solveTrend = Object.values(solveByYear)
    .sort((a,b)=>a.year-b.year)
    .map(r => ({ year: r.year, solve_rate: r.total>0 ? +(r.solved/r.total*100).toFixed(1):0, total: r.total }));

  const toggleType = t => setSelTypes(s =>
    s.includes(t) ? s.filter(x=>x!==t) : [...s, t]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-400" /> Crime Trends
        </h1>
        <div className="flex gap-2">
          <select value={district} onChange={e=>setDistrict(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 border border-slate-700">
            <option value="">All Karnataka</option>
            {DISTRICTS.map(d => <option key={d}>{d}</option>)}
          </select>
          {loading && <Loader2 size={16} className="animate-spin text-blue-400 mt-1" />}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {CRIME_TYPES.map((t,i) => (
            <button key={t} onClick={()=>toggleType(t)}
              className="px-3 py-1 text-xs rounded-full border transition-all font-medium"
              style={{
                background: selTypes.includes(t) ? '#105a6c' : 'transparent',
                borderColor: selTypes.includes(t) ? '#2ecce7' : '#505a72',
                color: selTypes.includes(t) ? '#eef0f6' : '#9aa4ba'
              }}
            >{t}</button>
          ))}
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Monthly Incidents Over Time</h3>
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={timelineSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
              <XAxis dataKey="label" tick={{fill:'#64748b',fontSize:9}} interval={5} />
              <YAxis tick={{fill:'#94a3b8',fontSize:11}} />
              <Tooltip
                contentStyle={{background:'#191c2b',border:'1px solid #505a72',borderRadius:6}}
                labelStyle={{color:'#dde1ec'}}
              />
              <Legend wrapperStyle={{fontSize:11}} />
              {selTypes.map((t,i) => (
                <Line key={t} type="monotone" dataKey={t} stroke={COLORS[i%COLORS.length]}
                  strokeWidth={2} dot={false} activeDot={{r:4}} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        {[['yearly','Year Comparison'],['solve','Solve Rate']].map(([v,l])=>(
          <button key={v} onClick={()=>setDetailTab(v)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${detailTab===v?'bg-blue-600 text-white':'text-slate-400 hover:text-white'}`}
          >{l}</button>
        ))}
      </div>

      {/* Year comparison */}
      {detailTab === 'yearly' && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Year-over-Year Comparison (Monthly)</h3>
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={yearCompareSeries}>
              <defs>
                {[2020,2021,2022,2023,2024,2025].map((y,i) => (
                  <linearGradient key={y} id={`grad${y}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS[i%COLORS.length]} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={COLORS[i%COLORS.length]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
              <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:11}} />
              <YAxis tick={{fill:'#94a3b8',fontSize:11}} />
              <Tooltip
                contentStyle={{background:'#191c2b',border:'1px solid #505a72',borderRadius:6}}
              />
              <Legend wrapperStyle={{fontSize:11}} />
              {[2020,2021,2022,2023,2024,2025].map((y,i)=>(
                <Area key={y} type="monotone" dataKey={y}
                  stroke={COLORS[i%COLORS.length]} fill={`url(#grad${y})`}
                  strokeWidth={2} dot={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Solve rate tab */}
      {detailTab === 'solve' && (
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Annual Solve Rate Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={solveTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
                <XAxis dataKey="year" tick={{fill:'#94a3b8',fontSize:11}} />
                <YAxis yAxisId="left"  tick={{fill:'#94a3b8',fontSize:11}} />
                <YAxis yAxisId="right" orientation="right" tick={{fill:'#94a3b8',fontSize:11}} unit="%" />
                <Tooltip
                  contentStyle={{background:'#191c2b',border:'1px solid #505a72',borderRadius:6}}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="total" fill="#20c7e8" radius={[3,3,0,0]} name="Total Crimes" />
                <Line yAxisId="right" type="monotone" dataKey="solve_rate" stroke="#58c095"
                  strokeWidth={3} dot={{r:4,fill:'#58c095'}} name="Solve %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
