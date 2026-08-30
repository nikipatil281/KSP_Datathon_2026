import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { AlertTriangle, TrendingUp, ShieldCheck, DollarSign, Loader2, UserRound, BadgeCheck } from 'lucide-react';
import { api } from '../api';

const COLORS = ['#20c7e8','#5aa8c0','#7c95ae','#8d89aa','#c29b68','#6f9c8f','#a0717f','#66758d','#b4a867','#4d8298'];
const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEAR_OPTIONS = ['all', 2020, 2021, 2022, 2023, 2024, 2025];

function KPICard({ label, value, sub, icon: Icon, color, pulse }) {
  return (
    <div className={`bg-slate-800 rounded-xl p-5 border ${pulse ? 'border-red-500/50' : 'border-slate-700'} relative overflow-hidden`}>
      {pulse && <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 animate-pulse" />}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</div>
          <div className="text-3xl font-semibold text-white">{value}</div>
          {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
        <div className={`w-10 h-10 rounded-lg border border-slate-600 bg-slate-900 flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

const DAYS_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function WordCloudCard({ title, subtitle, words, icon: Icon, color }) {
  const scaledWords = useMemo(() => {
    const values = (words || []).map(w => Number(w.value) || 0);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, max);
    return (words || []).map((word, index) => {
      const value = Number(word.value) || 0;
      const ratio = max === min ? 0.65 : (value - min) / (max - min);
      return {
        ...word,
        size: 13 + ratio * 22,
        weight: ratio > 0.72 ? 800 : ratio > 0.38 ? 700 : 600,
        color: COLORS[index % COLORS.length],
      };
    });
  }, [words]);

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 min-h-[260px]">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </div>

      {scaledWords.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-slate-500">
          No records available.
        </div>
      ) : (
        <div className="flex min-h-[170px] flex-wrap content-center items-center justify-center gap-x-3 gap-y-2 rounded-lg bg-slate-900/70 p-4">
          {scaledWords.map(word => (
            <span
              key={`${word.id}-${word.text}`}
              title={`${word.text}: ${word.value}`}
              className="leading-none transition-transform hover:scale-110"
              style={{
                color: word.color,
                fontSize: `${word.size}px`,
                fontWeight: word.weight,
              }}
            >
              {word.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CrimeTypeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload || {};
  const count = Number(row.count) || 0;
  const solved = Number(row.solved) || 0;
  const solveRate = count > 0 ? Math.round((solved / count) * 100) : 0;

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 shadow-panel">
      <div className="mb-2 text-sm font-semibold text-slate-100">{label}</div>
      <div className="space-y-1 text-xs">
        <div className="flex min-w-[150px] items-center justify-between gap-5 text-slate-300">
          <span>Incidents</span>
          <span className="font-semibold text-white">{count.toLocaleString()}</span>
        </div>
        <div className="flex min-w-[150px] items-center justify-between gap-5 text-slate-300">
          <span>Solved</span>
          <span className="font-semibold text-emerald-300">{solved.toLocaleString()}</span>
        </div>
        <div className="flex min-w-[150px] items-center justify-between gap-5 text-slate-300">
          <span>Solve Rate</span>
          <span className="font-semibold text-cyan-300">{solveRate}%</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ mode = 'crime' }) {
  const [data,  setData]  = useState(null);
  const [year,  setYear]  = useState(2024);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    api.summary(year)
      .then(setData)
      .catch(e => setError(e.message));
  }, [year]);

  if (error) return (
    <div className="flex items-center justify-center h-full text-red-400">
      <AlertTriangle className="mr-2" /> {error}
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="animate-spin mr-2" /> Loading dashboard…
    </div>
  );

  const { summary, by_crime_type, by_district, by_hour, by_day_of_week, offender_wordcloud, officer_wordcloud, fir_patterns } = data;
  const yearLabel = summary.year_label || (year === 'all' ? '2020-2025' : year);
  const fir = fir_patterns || {};
  const firSummary = fir.summary || {};

  // Sort day-of-week
  const dowSorted = DAYS_ORDER.map(d => {
    const found = (by_day_of_week || []).find(r => r.day === d);
    return { day: d.slice(0,3), count: found ? found.count : 0 };
  });

  return (
    <div className="w-[calc(100vw-4rem)] min-w-0 max-w-full space-y-6 p-4 md:w-auto md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white md:text-2xl">
            {mode === 'fir' ? 'FIR Dashboard' : 'Crime Dashboard'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === 'fir'
              ? 'Police FIR ER-schema analytics across cases, officers, stations, courts, victims and accused.'
              : 'Karnataka State Police - SCRB Analytics Hub'}
          </p>
        </div>
        <div className="grid w-full grid-cols-4 gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1 xl:flex xl:w-auto">
          {YEAR_OPTIONS.map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                year === y ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >{y === 'all' ? 'All' : y}</button>
          ))}
        </div>
      </div>

      {mode === 'crime' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              label="Total Incidents"
              value={summary.total_crimes?.toLocaleString()}
              sub={year === 'all' ? 'Years 2020-2025' : `Year ${yearLabel}`}
              icon={AlertTriangle}
              color="text-red-400"
              pulse
            />
            <KPICard
              label="Solve Rate"
              value={`${summary.solve_rate}%`}
              sub={`${summary.solved_crimes?.toLocaleString()} solved`}
              icon={ShieldCheck}
              color="text-green-400"
            />
            <KPICard
              label="Avg Severity"
              value={(summary.avg_severity || 0).toFixed(2)}
              sub="Scale 1-5"
              icon={TrendingUp}
              color="text-amber-400"
            />
            <KPICard
              label="Property Loss"
              value={`₹${((summary.total_loss || 0)/1e7).toFixed(1)}Cr`}
              sub="Reported value"
              icon={DollarSign}
              color="text-blue-400"
            />
          </div>

      {/* Row 2: Crime type bar + District bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Incidents by Crime Type</h3>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={by_crime_type} layout="vertical" margin={{ left: 24, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
              <XAxis type="number" tick={{ fill:'#94a3b8', fontSize:11 }} />
              <YAxis dataKey="crime_type" type="category" width={145}
                     tick={{ fill:'#94a3b8', fontSize:11 }} />
              <Tooltip
                content={<CrimeTypeTooltip />}
                cursor={{ fill: '#363d52', opacity: 0.35 }}
              />
              <Bar dataKey="count" radius={[0,4,4,0]}>
                {by_crime_type.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Top Districts by Incidents</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={by_district}>
              <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
              <XAxis dataKey="district" tick={{ fill:'#94a3b8', fontSize:10 }} angle={-25} textAnchor="end" height={50} />
              <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} />
              <Tooltip
                contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }}
                labelStyle={{ color:'#dde1ec' }}
              />
              <Bar dataKey="count" fill="#20c7e8" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Hour heatmap + Day-of-week + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Crime by Hour */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Incidents by Hour of Day</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={by_hour}>
              <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
              <XAxis dataKey="hour" tick={{ fill:'#94a3b8', fontSize:10 }} />
              <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} />
              <Tooltip
                contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }}
                formatter={(v) => [v, 'Crimes']}
                labelFormatter={h => `${h}:00`}
              />
              <Bar dataKey="count" fill="#c29b68" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2 text-center">Peak hours: 22:00 – 02:00 & 14:00 – 18:00</p>
        </div>

        {/* Day of week */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Incidents by Day of Week</h3>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={dowSorted}>
              <PolarGrid stroke="#363d52" />
              <PolarAngleAxis dataKey="day" tick={{ fill:'#94a3b8', fontSize:11 }} />
              <Radar dataKey="count" stroke="#6f9c8f" fill="#6f9c8f" fillOpacity={0.28} isAnimationActive={false} />
              <Tooltip
                contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart crime types */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Crime Type Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={by_crime_type.slice(0,7)}
                dataKey="count" nameKey="crime_type"
                cx="50%" cy="50%" outerRadius={70}
                label={({ name, percent }) => `${name.split(' ')[0]} ${(percent*100).toFixed(0)}%`}
                labelLine={false}
                fontSize={10}
                isAnimationActive={false}
              >
                {by_crime_type.slice(0,7).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Word clouds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WordCloudCard
          title="Offenders"
          subtitle="Name size reflects linked crime count"
          words={offender_wordcloud}
          icon={UserRound}
          color="text-blue-400"
        />
        <WordCloudCard
          title="Officers"
          subtitle="Code size reflects closed cases"
          words={officer_wordcloud}
          icon={BadgeCheck}
          color="text-green-400"
        />
      </div>


        </>
      )}

      {mode === 'fir' && (
      <section className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 xl:col-span-2">
            <div className="text-xs uppercase tracking-wider text-slate-500">FIR cases</div>
            <div className="mt-2 text-3xl font-semibold text-white">{(firSummary.total_cases || 0).toLocaleString()}</div>
            <div className="mt-1 text-xs text-slate-400">CaseMaster records in selected year</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">Chargesheets</div>
            <div className="mt-2 text-2xl font-semibold text-cyan-300">{(firSummary.chargesheeted_cases || 0).toLocaleString()}</div>
            <div className="mt-1 text-xs text-slate-400">from ChargesheetDetails</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">Arrest events</div>
            <div className="mt-2 text-2xl font-semibold text-amber-300">{(firSummary.arrest_events || 0).toLocaleString()}</div>
            <div className="mt-1 text-xs text-slate-400">from ArrestSurrender</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">Avg CS days</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-300">{firSummary.avg_days_to_chargesheet || 0}</div>
            <div className="mt-1 text-xs text-slate-400">registration to csdate</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">Multi-accused</div>
            <div className="mt-2 text-2xl font-semibold text-red-300">{(firSummary.multi_accused_cases || 0).toLocaleString()}</div>
            <div className="mt-1 text-xs text-slate-400">cases with 2+ accused</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-300">Case Lifecycle Status</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={fir.status_flow || []} layout="vertical" margin={{ left: 18, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
                <XAxis type="number" tick={{ fill:'#94a3b8', fontSize:11 }} />
                <YAxis dataKey="status" type="category" width={118} tick={{ fill:'#94a3b8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }} labelStyle={{ color:'#dde1ec' }} />
                <Bar dataKey="count" fill="#20c7e8" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-300">FIR Category Mix</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={fir.category_mix || []} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={82} labelLine={false} label={({ category, percent }) => `${category} ${(percent*100).toFixed(0)}%`} fontSize={10} isAnimationActive={false}>
                  {(fir.category_mix || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-300">Registrations, Arrests, Chargesheets</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={fir.monthly_registrations || []} margin={{ left: 0, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
                <XAxis dataKey="month" tick={{ fill:'#94a3b8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} />
                <Tooltip contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }} labelStyle={{ color:'#dde1ec' }} />
                <Legend wrapperStyle={{ color:'#94a3b8', fontSize:11 }} />
                <Line type="monotone" dataKey="registered" stroke="#20c7e8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="arrests" stroke="#c29b68" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="chargesheeted" stroke="#6f9c8f" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-300">Gravity by Crime Head</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fir.gravity_by_head || []} layout="vertical" margin={{ left: 28, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
                <XAxis type="number" tick={{ fill:'#94a3b8', fontSize:11 }} />
                <YAxis dataKey="crime_head" type="category" width={150} tick={{ fill:'#94a3b8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }} />
                <Legend wrapperStyle={{ color:'#94a3b8', fontSize:11 }} />
                <Bar dataKey="Heinous" stackId="a" fill="#a0717f" radius={[0,0,0,0]} />
                <Bar dataKey="Non-Heinous" stackId="a" fill="#5aa8c0" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-300">Legal Section Pressure</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fir.legal_sections || []} layout="vertical" margin={{ left: 14, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
                <XAxis type="number" tick={{ fill:'#94a3b8', fontSize:11 }} />
                <YAxis dataKey="label" type="category" width={82} tick={{ fill:'#94a3b8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }} labelStyle={{ color:'#dde1ec' }} />
                <Legend wrapperStyle={{ color:'#94a3b8', fontSize:11 }} />
                <Bar dataKey="cases" fill="#20c7e8" radius={[0,4,4,0]} />
                <Bar dataKey="chargesheeted" fill="#6f9c8f" radius={[0,4,4,0]} />
                <Bar dataKey="arrest_events" fill="#c29b68" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-300">Station Workload Intersections</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fir.station_pressure || []} margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
                <XAxis dataKey="station" tick={{ fill:'#94a3b8', fontSize:9 }} angle={-30} textAnchor="end" height={70} />
                <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }} />
                <Legend wrapperStyle={{ color:'#94a3b8', fontSize:11 }} />
                <Bar dataKey="registered" fill="#20c7e8" radius={[3,3,0,0]} />
                <Bar dataKey="pending" fill="#a0717f" radius={[3,3,0,0]} />
                <Bar dataKey="chargesheeted" fill="#6f9c8f" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-300">Officer Load: Cases, Arrests, CS</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fir.officer_load || []} margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
                <XAxis dataKey="officer" tick={{ fill:'#94a3b8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }} />
                <Legend wrapperStyle={{ color:'#94a3b8', fontSize:11 }} />
                <Bar dataKey="registered" fill="#20c7e8" radius={[3,3,0,0]} />
                <Bar dataKey="arrests" fill="#c29b68" radius={[3,3,0,0]} />
                <Bar dataKey="chargesheets" fill="#6f9c8f" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-300">Victim and Accused Density</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fir.victim_accused_mix || []} margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
                <XAxis dataKey="crime_head" tick={{ fill:'#94a3b8', fontSize:9 }} angle={-28} textAnchor="end" height={70} />
                <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }} />
                <Legend wrapperStyle={{ color:'#94a3b8', fontSize:11 }} />
                <Bar dataKey="avg_victims" fill="#5aa8c0" radius={[3,3,0,0]} />
                <Bar dataKey="avg_accused" fill="#c29b68" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-300">Court Pipeline: Volume vs Chargesheet Latency</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={fir.court_pipeline || []} margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
              <XAxis dataKey="court" tick={{ fill:'#94a3b8', fontSize:10 }} angle={-20} textAnchor="end" height={64} />
              <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} />
              <Tooltip contentStyle={{ background:'#191c2b', border:'1px solid #505a72', borderRadius:6 }} />
              <Legend wrapperStyle={{ color:'#94a3b8', fontSize:11 }} />
              <Bar dataKey="cases" fill="#20c7e8" radius={[3,3,0,0]} />
              <Bar dataKey="chargesheets" fill="#6f9c8f" radius={[3,3,0,0]} />
              <Bar dataKey="avg_days_to_chargesheet" fill="#8d89aa" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      )}
    </div>
  );
}
