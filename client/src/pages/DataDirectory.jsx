import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ChevronLeft, ChevronRight, Database, Loader2,
  Plus, RefreshCcw, Save, Search, Table2, X
} from 'lucide-react';
import { api } from '../api';

const PAGE_SIZE = 50;

const OFFICER_INITIAL = {
  initials: '',
  rank: 'Sub-Inspector',
  badge_number: '',
  station_id: '',
  district_id: '',
  specialization_crime_type_id: '',
  shift: 'Day',
  status: 'Active',
  years_of_service: 1,
  assigned_crime_ids: [],
};

const ASSIGNABLE_CASE_STATUSES = new Set(['Open', 'Under Investigation', 'Cold Case']);

const FIR_ER_TABLE_ORDER = [
  'case_master',
  'complainant_details',
  'act_section_association',
  'victim',
  'accused',
  'arrest_surrender',
  'act',
  'section',
  'crime_head_act_section',
  'crime_head',
  'crime_sub_head',
  'caste_master',
  'religion_master',
  'occupation_master',
  'case_status_master',
  'court',
  'district',
  'state',
  'unit',
  'unit_type',
  'rank',
  'designation',
  'employee',
  'case_category',
  'gravity_offence',
  'inv_occurance_time',
  'inv_arrestsurrenderaccused',
  'chargesheet_details',
];

const FILTERABLE_ALLOWLIST = new Set([
  'aadhar_linked',
  'assignment_status',
  'case_status_id',
  'category',
  'crime_type',
  'crime_type_id',
  'default_severity',
  'district',
  'district_id',
  'district_of_origin',
  'district_of_origin_id',
  'education',
  'education_id',
  'gender',
  'gang_affiliation',
  'gang_id',
  'incident_day_of_week',
  'incident_hour',
  'incident_month',
  'incident_year',
  'initials',
  'io_officer',
  'io_officer_id',
  'location_type',
  'location_type_id',
  'modus_operandi',
  'modus_operandi_id',
  'name',
  'occupation',
  'occupation_id',
  'offender_status_id',
  'rank',
  'relationship_type',
  'relationship_type_id',
  'repeat_victim',
  'role',
  'shift',
  'solved',
  'specialization',
  'specialization_crime_type_id',
  'station_id',
  'status',
  'status_name',
  'weapon_id',
  'weapon_name',
  'weapons_used',
]);

const FILTERABLE_DENYLIST = new Set([
  'age',
  'area_covered_sqkm',
  'area_sqkm',
  'assigned_date',
  'association_id',
  'badge_number',
  'crime_id',
  'crime_offender_id',
  'crime_officer_id',
  'crime_victim_id',
  'current_case_load',
  'days_to_solve',
  'fir_number',
  'first_seen_crime_id',
  'incident_date',
  'incident_time',
  'known_associates',
  'latitude',
  'literacy_rate',
  'longitude',
  'offender_id',
  'offender_id_a',
  'offender_id_b',
  'officer_code',
  'officer_count',
  'officer_id',
  'population',
  'prior_convictions',
  'property_loss_inr',
  'risk_score',
  'socio_economic_index',
  'solve_rate',
  'stat_id',
  'strength',
  'total_property_loss_inr',
  'unemployment_rate',
  'urbanization_index',
  'victim_id',
  'vulnerability_index',
  'years_of_service',
]);

function shouldShowColumnFilter(column, rows) {
  if (FILTERABLE_DENYLIST.has(column)) return false;
  if (column.includes('date') && !column.endsWith('_year')) return false;
  if (column.includes('time') && column !== 'incident_hour') return false;
  if (column.endsWith('_id') && !FILTERABLE_ALLOWLIST.has(column)) return false;
  if (!FILTERABLE_ALLOWLIST.has(column) && !column.endsWith('_year')) return false;

  const values = [...new Set(rows.map(row => row[column]).filter(value => value !== null && value !== undefined && value !== ''))];
  return values.length > 1 && values.length <= 150;
}

function sortFilterValues(values) {
  return values.sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });
}

function Cell({ value }) {
  const text = value === null || value === undefined || value === '' ? '-' : String(value);
  return (
    <td className="max-w-[260px] border-b border-slate-800 px-3 py-2 align-top text-xs text-slate-300">
      <div className="truncate" title={text}>{text}</div>
    </td>
  );
}

function TableNavList({ tables, selected, onSelect }) {
  return (
    <div className="space-y-1">
      {tables.map(t => (
        <button
          key={t.name}
          onClick={() => onSelect(t.name)}
          className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
            selected === t.name ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm">{t.file_name}</span>
            <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">{t.row_count}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function OfficerForm({ onSubmit, onCancel, stations, districts, crimeTypes, cases, saving }) {
  const [form, setForm] = useState(OFFICER_INITIAL);

  const update = (key, value) => {
    if (key === 'station_id') {
      const station = stations.find(s => String(s.station_id) === String(value));
      setForm(current => ({
        ...current,
        station_id: value,
        district_id: station?.district_id || current.district_id,
      }));
      return;
    }
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    onSubmit(form).then(() => setForm(OFFICER_INITIAL));
  };

  const stationCases = useMemo(() => {
    return cases
      .filter(c => !form.station_id || String(c.station_id) === String(form.station_id))
      .filter(c => ASSIGNABLE_CASE_STATUSES.has(c.status))
      .sort((a, b) => String(b.incident_date).localeCompare(String(a.incident_date)));
  }, [cases, form.station_id]);

  const toggleCase = crimeId => {
    setForm(current => {
      const exists = current.assigned_crime_ids.includes(crimeId);
      return {
        ...current,
        assigned_crime_ids: exists
          ? current.assigned_crime_ids.filter(id => id !== crimeId)
          : [...current.assigned_crime_ids, crimeId],
      };
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-blue-800 bg-blue-950/50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Plus size={16} className="text-blue-300" /> Add Officer
        </h2>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <label className="text-xs text-slate-400">
          Initials
          <input
            required
            value={form.initials}
            onChange={e => update('initials', e.target.value.toUpperCase())}
            placeholder="E.g. DT"
            maxLength={4}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="text-xs text-slate-400">
          Rank
          <select value={form.rank} onChange={e => update('rank', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            {['Inspector','Sub-Inspector','Assistant Sub-Inspector','Head Constable','Constable'].map(v => <option key={v}>{v}</option>)}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Badge Number
          <input
            value={form.badge_number}
            onChange={e => update('badge_number', e.target.value)}
            placeholder="Auto if blank"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="text-xs text-slate-400">
          Station
          <select required value={form.station_id} onChange={e => update('station_id', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            <option value="">Select station</option>
            {stations.map(s => <option key={s.station_id} value={s.station_id}>{s.name}</option>)}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          District
          <select required value={form.district_id} onChange={e => update('district_id', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            <option value="">Select district</option>
            {districts.map(d => <option key={d.district_id} value={d.district_id}>{d.name}</option>)}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Specialization
          <select required value={form.specialization_crime_type_id} onChange={e => update('specialization_crime_type_id', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            <option value="">Select crime type</option>
            {crimeTypes.map(t => <option key={t.crime_type_id} value={t.crime_type_id}>{t.crime_type}</option>)}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Shift
          <select value={form.shift} onChange={e => update('shift', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            {['Day','Evening','Night','Rotating'].map(v => <option key={v}>{v}</option>)}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Status
          <select value={form.status} onChange={e => update('status', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            {['Active','On Leave','Inactive'].map(v => <option key={v}>{v}</option>)}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Years of Service
          <input
            required
            type="number"
            min="0"
            max="40"
            value={form.years_of_service}
            onChange={e => update('years_of_service', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Assign Existing Cases</div>
            <div className="text-xs text-slate-500">Choose Open, Under Investigation, or Cold Case records. Multiple cases can be assigned.</div>
          </div>
          <div className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">
            {form.assigned_crime_ids.length} selected
          </div>
        </div>

        <div className="max-h-56 overflow-auto rounded-lg border border-slate-800">
          {stationCases.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Select a station to see assignable cases.</div>
          ) : stationCases.map(c => {
            const checked = form.assigned_crime_ids.includes(c.crime_id);
            return (
              <label key={c.crime_id} className={`flex cursor-pointer items-start gap-3 border-b border-slate-800 px-3 py-2 last:border-b-0 ${checked ? 'bg-blue-950/60' : 'hover:bg-slate-900'}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCase(c.crime_id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-white">{c.fir_number}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{c.status}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{c.crime_type}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-400">
                    {c.district} · {c.incident_date} · {c.modus_operandi}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          Current case load is system-managed and will start at the number of selected assigned cases.
        </div>
        <button disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Officer
        </button>
      </div>
    </form>
  );
}

export default function DataDirectory() {
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState('case_master');
  const [table, setTable] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOfficerForm, setShowOfficerForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});

  const loadTables = () => api.listDataTables().then(setTables);

  const loadTable = tableName => {
    setLoading(true);
    setError(null);
    return api.getDataTable(tableName)
      .then(data => {
        setTable(data);
        setPage(0);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTables().catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    setColumnFilters({});
    setQuery('');
    loadTable(selected);
  }, [selected]);

  const tableMap = useMemo(() => Object.fromEntries(tables.map(t => [t.name, t])), [tables]);
  const dataTables = useMemo(() => {
    const byName = new Map(tables.map(t => [t.name, t]));
    return FIR_ER_TABLE_ORDER.map(name => ({
      name,
      file_name: `${name}.csv`,
      row_count: byName.get(name)?.row_count || 0,
      column_count: byName.get(name)?.column_count || 0,
    }));
  }, [tables]);

  const rows = table?.rows || [];
  const columns = table?.columns || [];
  const filterableColumns = useMemo(() => {
    return columns
      .filter(col => shouldShowColumnFilter(col, rows))
      .map(col => ({
        column: col,
        values: sortFilterValues([...new Set(rows.map(row => row[col]).filter(value => value !== null && value !== undefined && value !== ''))]),
      }));
  }, [columns, rows]);

  const activeFilterCount = Object.values(columnFilters).filter(Boolean).length;

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(row => {
      const matchesSearch = !q || columns.some(col => String(row[col] ?? '').toLowerCase().includes(q));
      if (!matchesSearch) return false;
      return Object.entries(columnFilters).every(([col, value]) => {
        if (!value) return true;
        return String(row[col] ?? '') === String(value);
      });
    });
  }, [rows, columns, query, columnFilters]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = filteredRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const handleAddOfficer = async officer => {
    setSaving(true);
    try {
      await api.addOfficer(officer);
      await loadTables();
      await loadTable('officers');
      setSelected('officers');
      setShowOfficerForm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <aside className="flex w-72 min-h-0 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Database size={18} className="text-blue-400" />
          <div>
            <h1 className="text-sm font-bold text-white">Data Directory</h1>
            <p className="text-xs text-slate-500">Police FIR ER tables only</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            FIR ER Tables
          </div>
          <TableNavList tables={dataTables} selected={selected} onSelect={setSelected} />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-6">
        <div className="mb-5 flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <Table2 size={20} className="text-blue-400" /> {table?.file_name || `${selected}.csv`}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {filteredRows.length.toLocaleString()} rows · {columns.length} columns
              {query && ` · filtered from ${(tableMap[selected]?.row_count || rows.length).toLocaleString()}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selected === 'officers' && (
              <button
                onClick={() => setShowOfficerForm(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                <Plus size={15} /> Add Officer
              </button>
            )}
            <button onClick={() => loadTable(selected)} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
              <RefreshCcw size={15} /> Refresh
            </button>
          </div>
        </div>

        <DirectoryLoadedForm
          show={showOfficerForm && selected === 'officers'}
          saving={saving}
          onSubmit={handleAddOfficer}
          onCancel={() => setShowOfficerForm(false)}
        />

        <div className="mb-3 flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search this table..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
              className="rounded border border-slate-700 p-1.5 hover:bg-slate-800 disabled:opacity-40">
              <ChevronLeft size={14} />
            </button>
            <span>Page {page + 1} of {pageCount}</span>
            <button disabled={page + 1 >= pageCount} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              className="rounded border border-slate-700 p-1.5 hover:bg-slate-800 disabled:opacity-40">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {filterableColumns.length > 0 && (
          <div className="mb-3 flex-shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Data Filters {activeFilterCount > 0 ? `(${activeFilterCount} active)` : ''}
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setColumnFilters({})}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-5">
              {filterableColumns.map(({ column, values }) => (
                <label key={column} className="min-w-0 text-xs text-slate-400">
                  <span className="block truncate">{column}</span>
                  <select
                    value={columnFilters[column] || ''}
                    onChange={e => {
                      const value = e.target.value;
                      setPage(0);
                      setColumnFilters(current => {
                        const next = { ...current };
                        if (value) next[column] = value;
                        else delete next[column];
                        return next;
                      });
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                  >
                    <option value="">All</option>
                    {values.map(value => (
                      <option key={`${column}-${value}`} value={value}>{String(value)}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-700 bg-red-950 p-3 text-sm text-red-300">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-slate-400">
              <Loader2 className="mr-2 animate-spin" size={18} /> Loading table...
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-800">
                  <tr>
                    {columns.map(col => (
                      <th key={col} className="whitespace-nowrap border-b border-slate-700 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => (
                    <tr key={`${selected}-${page}-${index}`} className="hover:bg-slate-800/60">
                      {columns.map(col => <Cell key={col} value={row[col]} />)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleRows.length === 0 && (
                <div className="py-16 text-center text-sm text-slate-500">No rows match the current search.</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DirectoryLoadedForm({ show, saving, onSubmit, onCancel }) {
  const [stations, setStations] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [crimeTypes, setCrimeTypes] = useState([]);
  const [cases, setCases] = useState([]);

  useEffect(() => {
    if (!show) return;
    Promise.all([
      api.getDataTable('police_stations'),
      api.getDataTable('districts'),
      api.getDataTable('crime_types'),
      api.getDataTable('crimes'),
    ]).then(([stationTable, districtTable, crimeTypeTable, crimeTable]) => {
      setStations(stationTable.rows || []);
      setDistricts(districtTable.rows || []);
      setCrimeTypes(crimeTypeTable.rows || []);
      setCases(crimeTable.rows || []);
    });
  }, [show]);

  if (!show) return null;

  return (
    <div className="mb-5 flex-shrink-0">
      <OfficerForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        stations={stations}
        districts={districts}
        crimeTypes={crimeTypes}
        cases={cases}
        saving={saving}
      />
    </div>
  );
}
