import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BadgeCheck, BarChart3, Building2, FileWarning,
  Loader2, MapPin, Shield, UserRound, UsersRound
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { api } from '../api';

const COLORS = ['#20c7e8', '#5aa8c0', '#7c95ae', '#8d89aa', '#c29b68', '#6f9c8f', '#a0717f', '#66758d'];

const SECTIONS = [
  { key: 'crime', label: 'Crime', icon: FileWarning },
  { key: 'offender', label: 'Offender', icon: UserRound },
  { key: 'officer', label: 'Officer', icon: BadgeCheck },
  { key: 'victim', label: 'Victim', icon: UsersRound },
  { key: 'district', label: 'District', icon: MapPin },
  { key: 'station', label: 'Police Station', icon: Building2 },
];

const TABLES = [
  'crimes', 'crime_types', 'crime_offenders', 'offenders',
  'crime_officers', 'officers', 'crime_victims', 'victims',
  'districts', 'police_stations',
];

const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function parseIdList(value) {
  if (Array.isArray(value)) return value.map(num).filter(Boolean);
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map(num).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function groupCounts(rows, getKey) {
  const counts = {};
  rows.forEach(row => {
    const key = getKey(row);
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function money(value) {
  return `Rs ${((num(value) || 0) / 1e7).toFixed(1)}Cr`;
}

function StatCard({ label, value, sub, icon: Icon, color = 'text-blue-400' }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
          <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-700 ${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function SelectBox({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-slate-400">{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function MiniBar({ title, data, dataKey = 'count' }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-300">{title}</h3>
      {data.length === 0 ? (
        <div className="flex h-44 items-center justify-center text-sm text-slate-500">No data available.</div>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={data.slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#363d52" />
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={118} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#191c2b', border: '1px solid #505a72', borderRadius: 6 }} />
            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]}>
              {data.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function WordCloud({ title, words }) {
  const values = words.map(w => w.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, max);
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-300">{title}</h3>
      <div className="flex min-h-[190px] flex-wrap content-center items-center justify-center gap-x-3 gap-y-2 rounded-lg bg-slate-900/70 p-4">
        {words.length === 0 ? (
          <span className="text-sm text-slate-500">No linked records.</span>
        ) : words.slice(0, 35).map((word, index) => {
          const ratio = max === min ? 0.6 : (word.value - min) / (max - min);
          return (
            <span
              key={`${word.text}-${index}`}
              title={`${word.text}: ${word.value}`}
              className="leading-none"
              style={{
                color: COLORS[index % COLORS.length],
                fontSize: `${13 + ratio * 22}px`,
                fontWeight: ratio > 0.65 ? 800 : 650,
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SummaryGrid({ rows }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {rows.map(row => <StatCard key={row.label} {...row} />)}
    </div>
  );
}

export default function DataCards() {
  const [active, setActive] = useState('crime');
  const [selected, setSelected] = useState({});
  const [tables, setTables] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all(TABLES.map(name => api.getDataTable(name).then(table => [name, table.rows || []])))
      .then(entries => setTables(Object.fromEntries(entries)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const model = useMemo(() => {
    if (!tables) return null;
    const crimes = tables.crimes || [];
    const offenders = tables.offenders || [];
    const officers = tables.officers || [];
    const victims = tables.victims || [];
    const districts = tables.districts || [];
    const stations = tables.police_stations || [];
    const crimeOffenders = tables.crime_offenders || [];
    const crimeOfficers = tables.crime_officers || [];
    const crimeVictims = tables.crime_victims || [];

    const crimesById = new Map(crimes.map(c => [String(c.crime_id), c]));
    const offendersById = new Map(offenders.map(o => [String(o.offender_id), o]));
    const officersById = new Map(officers.map(o => [String(o.officer_id), o]));
    const victimsById = new Map(victims.map(v => [String(v.victim_id), v]));
    const districtsById = new Map(districts.map(d => [String(d.district_id), d]));
    const stationsById = new Map(stations.map(s => [String(s.station_id), s]));

    return {
      crimes, offenders, officers, victims, districts, stations,
      crimeOffenders, crimeOfficers, crimeVictims,
      crimesById, offendersById, officersById, victimsById, districtsById, stationsById,
    };
  }, [tables]);

  const options = useMemo(() => {
    if (!model) return [];
    if (active === 'crime') {
      return [...new Set(model.crimes.map(c => c.crime_type))]
        .sort()
        .map(type => ({ value: type, label: type }));
    }
    if (active === 'offender') {
      return model.offenders
        .slice()
        .sort((a, b) => num(b.prior_convictions) - num(a.prior_convictions))
        .slice(0, 120)
        .map(o => ({ value: String(o.offender_id), label: `${o.name} (${o.alias || 'no alias'})` }));
    }
    if (active === 'officer') {
      return model.officers
        .slice()
        .sort((a, b) => num(b.current_case_load) - num(a.current_case_load))
        .map(o => ({ value: String(o.officer_id), label: `${o.officer_code} - ${o.rank}` }));
    }
    if (active === 'victim') {
      return model.victims
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .slice(0, 150)
        .map(v => ({ value: String(v.victim_id), label: v.name }));
    }
    if (active === 'district') {
      return model.districts.map(d => ({ value: String(d.district_id), label: d.name }));
    }
    return model.stations.map(s => ({ value: String(s.station_id), label: s.name }));
  }, [active, model]);

  useEffect(() => {
    if (!options.length) return;
    setSelected(current => current[active] ? current : { ...current, [active]: options[0].value });
  }, [active, options]);

  const selectedValue = selected[active] || options[0]?.value || '';
  const card = useMemo(() => {
    if (!model || !selectedValue) return null;
    const closed = c => String(c.status || '').startsWith('Closed') || num(c.solved) === 1;
    const statsFor = rows => ({
      total: rows.length,
      solved: rows.filter(closed).length,
      solveRate: rows.length ? Math.round(rows.filter(closed).length / rows.length * 100) : 0,
      avgSeverity: rows.length ? rows.reduce((sum, c) => sum + num(c.severity), 0) / rows.length : 0,
      loss: rows.reduce((sum, c) => sum + num(c.property_loss_inr), 0),
    });

    if (active === 'crime') {
      const rows = model.crimes.filter(c => c.crime_type === selectedValue);
      const stats = statsFor(rows);
      const offenderCounts = {};
      rows.forEach(c => parseIdList(c.offender_ids).forEach(id => {
        const offender = model.offendersById.get(String(id));
        if (!offender) return;
        offenderCounts[offender.name] = (offenderCounts[offender.name] || 0) + 1;
      }));
      return {
        title: selectedValue,
        eyebrow: 'Crime type datacard',
        stats: [
          { label: 'Total Incidents', value: stats.total.toLocaleString(), icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Solve Rate', value: `${stats.solveRate}%`, sub: `${stats.solved} closed/solved`, icon: Shield, color: 'text-green-400' },
          { label: 'Avg Severity', value: stats.avgSeverity.toFixed(2), sub: 'Scale 1-5', icon: BarChart3, color: 'text-orange-400' },
          { label: 'Property Loss', value: money(stats.loss), icon: FileWarning, color: 'text-purple-400' },
        ],
        charts: [
          { kind: 'word', title: 'Prominent Offenders', data: Object.entries(offenderCounts).map(([text, value]) => ({ text, value })).sort((a, b) => b.value - a.value) },
          { kind: 'bar', title: 'Prominent Districts', data: groupCounts(rows, c => c.district) },
          { kind: 'bar', title: 'Modus Operandi', data: groupCounts(rows, c => c.modus_operandi) },
          { kind: 'bar', title: 'Case Status', data: groupCounts(rows, c => c.status) },
        ],
      };
    }

    if (active === 'offender') {
      const offender = model.offendersById.get(String(selectedValue));
      const linkedIds = new Set(model.crimeOffenders.filter(x => String(x.offender_id) === String(selectedValue)).map(x => String(x.crime_id)));
      model.crimes.forEach(c => parseIdList(c.offender_ids).forEach(id => {
        if (String(id) === String(selectedValue)) linkedIds.add(String(c.crime_id));
      }));
      const rows = [...linkedIds].map(id => model.crimesById.get(id)).filter(Boolean);
      const stats = statsFor(rows);
      return {
        title: offender?.name || 'Offender',
        eyebrow: offender?.alias ? `Alias ${offender.alias}` : 'Offender datacard',
        stats: [
          { label: 'Linked Crimes', value: stats.total.toLocaleString(), icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Prior Convictions', value: num(offender?.prior_convictions), icon: BadgeCheck, color: 'text-amber-400' },
          { label: 'Risk Score', value: num(offender?.risk_score).toFixed(2), sub: offender?.status, icon: UserRound, color: 'text-blue-400' },
          { label: 'Avg Severity', value: stats.avgSeverity.toFixed(2), icon: BarChart3, color: 'text-orange-400' },
        ],
        charts: [
          { kind: 'bar', title: 'Crime Mix', data: groupCounts(rows, c => c.crime_type) },
          { kind: 'bar', title: 'District Footprint', data: groupCounts(rows, c => c.district) },
          { kind: 'bar', title: 'Case Status', data: groupCounts(rows, c => c.status) },
        ],
      };
    }

    if (active === 'officer') {
      const officer = model.officersById.get(String(selectedValue));
      const linkedIds = new Set(model.crimeOfficers.filter(x => String(x.officer_id) === String(selectedValue)).map(x => String(x.crime_id)));
      model.crimes.forEach(c => {
        if (String(c.io_officer_id) === String(selectedValue)) linkedIds.add(String(c.crime_id));
      });
      const rows = [...linkedIds].map(id => model.crimesById.get(id)).filter(Boolean);
      const stats = statsFor(rows);
      return {
        title: officer?.officer_code || 'Officer',
        eyebrow: `${officer?.rank || ''} ${officer?.initials || ''}`.trim() || 'Officer datacard',
        stats: [
          { label: 'Assigned Cases', value: stats.total.toLocaleString(), icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Closed Cases', value: stats.solved.toLocaleString(), icon: Shield, color: 'text-green-400' },
          { label: 'Closure Rate', value: `${stats.solveRate}%`, icon: BadgeCheck, color: 'text-blue-400' },
          { label: 'Current Load', value: num(officer?.current_case_load), sub: officer?.specialization, icon: BarChart3, color: 'text-purple-400' },
        ],
        charts: [
          { kind: 'bar', title: 'Assigned Crime Types', data: groupCounts(rows, c => c.crime_type) },
          { kind: 'bar', title: 'Case Status', data: groupCounts(rows, c => c.status) },
          { kind: 'bar', title: 'Districts Covered', data: groupCounts(rows, c => c.district) },
        ],
      };
    }

    if (active === 'victim') {
      const victim = model.victimsById.get(String(selectedValue));
      const linkedIds = new Set(model.crimeVictims.filter(x => String(x.victim_id) === String(selectedValue)).map(x => String(x.crime_id)));
      model.crimes.forEach(c => parseIdList(c.victim_ids).forEach(id => {
        if (String(id) === String(selectedValue)) linkedIds.add(String(c.crime_id));
      }));
      const rows = [...linkedIds].map(id => model.crimesById.get(id)).filter(Boolean);
      const stats = statsFor(rows);
      return {
        title: victim?.name || 'Victim',
        eyebrow: `${victim?.gender || ''} - ${victim?.occupation || ''}`.trim(),
        stats: [
          { label: 'Linked Incidents', value: stats.total.toLocaleString(), icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Repeat Victim', value: String(victim?.repeat_victim) === 'true' || victim?.repeat_victim === true ? 'Yes' : 'No', icon: UsersRound, color: 'text-blue-400' },
          { label: 'Vulnerability', value: num(victim?.vulnerability_index).toFixed(2), icon: Shield, color: 'text-amber-400' },
          { label: 'Avg Severity', value: stats.avgSeverity.toFixed(2), icon: BarChart3, color: 'text-orange-400' },
        ],
        charts: [
          { kind: 'bar', title: 'Crime Types', data: groupCounts(rows, c => c.crime_type) },
          { kind: 'bar', title: 'Districts', data: groupCounts(rows, c => c.district) },
          { kind: 'bar', title: 'Case Status', data: groupCounts(rows, c => c.status) },
        ],
      };
    }

    if (active === 'district') {
      const district = model.districtsById.get(String(selectedValue));
      const rows = model.crimes.filter(c => String(c.district_id) === String(selectedValue) || c.district === district?.name);
      const stations = model.stations.filter(s => String(s.district_id) === String(selectedValue));
      const stats = statsFor(rows);
      return {
        title: district?.name || 'District',
        eyebrow: 'District operations datacard',
        stats: [
          { label: 'Total Incidents', value: stats.total.toLocaleString(), icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Solve Rate', value: `${stats.solveRate}%`, icon: Shield, color: 'text-green-400' },
          { label: 'Police Stations', value: stations.length, icon: Building2, color: 'text-blue-400' },
          { label: 'Property Loss', value: money(stats.loss), icon: FileWarning, color: 'text-purple-400' },
        ],
        charts: [
          { kind: 'bar', title: 'Crime Mix', data: groupCounts(rows, c => c.crime_type) },
          { kind: 'bar', title: 'Station Load', data: groupCounts(rows, c => model.stationsById.get(String(c.station_id))?.name || c.station_id) },
          { kind: 'bar', title: 'Case Status', data: groupCounts(rows, c => c.status) },
        ],
      };
    }

    const station = model.stationsById.get(String(selectedValue));
    const rows = model.crimes.filter(c => String(c.station_id) === String(selectedValue));
    const officers = model.officers.filter(o => String(o.station_id) === String(selectedValue));
    const stats = statsFor(rows);
    return {
      title: station?.name || 'Police Station',
      eyebrow: model.districtsById.get(String(station?.district_id))?.name || 'Police station datacard',
      stats: [
        { label: 'Total Incidents', value: stats.total.toLocaleString(), icon: AlertTriangle, color: 'text-red-400' },
        { label: 'Solve Rate', value: `${stats.solveRate}%`, icon: Shield, color: 'text-green-400' },
        { label: 'Assigned Officers', value: officers.length, icon: BadgeCheck, color: 'text-blue-400' },
        { label: 'Avg Severity', value: stats.avgSeverity.toFixed(2), icon: BarChart3, color: 'text-orange-400' },
      ],
      charts: [
        { kind: 'bar', title: 'Crime Mix', data: groupCounts(rows, c => c.crime_type) },
        { kind: 'bar', title: 'Officer Case Load', data: officers.map(o => ({ name: o.officer_code || o.initials, count: num(o.current_case_load) })).sort((a, b) => b.count - a.count) },
        { kind: 'bar', title: 'Case Status', data: groupCounts(rows, c => c.status) },
      ],
    };
  }, [active, model, selectedValue]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        <AlertTriangle className="mr-2" /> {error}
      </div>
    );
  }

  if (loading || !model || !card) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="mr-2 animate-spin" /> Loading datacards...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen">
      <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 p-4">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-400" />
          <div>
            <h1 className="text-sm font-bold text-white">DataCards</h1>
            <p className="text-xs text-slate-500">Operational lenses</p>
          </div>
        </div>
        <div className="space-y-1">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                active === key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{card.eyebrow}</p>
            <h2 className="mt-1 text-2xl font-bold text-white">{card.title}</h2>
          </div>
          <div className="w-full max-w-sm">
            <SelectBox
              label={`Select ${SECTIONS.find(s => s.key === active)?.label}`}
              value={selectedValue}
              onChange={value => setSelected(current => ({ ...current, [active]: value }))}
              options={options}
            />
          </div>
        </div>

        <div className="space-y-5">
          <SummaryGrid rows={card.stats} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {card.charts.map((chart, index) => chart.kind === 'word'
              ? <WordCloud key={chart.title} title={chart.title} words={chart.data} />
              : <MiniBar key={chart.title} title={chart.title} data={chart.data} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
