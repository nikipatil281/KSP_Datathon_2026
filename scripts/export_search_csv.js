const fs = require('fs');
const path = require('path');

const tableColumns = {
  offenders: [
    'offender_id',
    'name',
    'alias',
    'age',
    'gender',
    'district_of_origin',
    'education',
    'occupation',
    'prior_convictions',
    'gang_affiliation',
    'status',
    'risk_score'
  ],
  crimes: [
    'crime_id',
    'district',
    'crime_type',
    'modus_operandi',
    'incident_date',
    'incident_year',
    'severity',
    'status',
    'fir_number',
    'offender_ids'
  ],
  crime_offenders: [
    'crime_offender_id',
    'crime_id',
    'offender_id',
    'role'
  ],
  victims: [
    'victim_id',
    'name',
    'age',
    'gender',
    'occupation',
    'district',
    'repeat_victim',
    'vulnerability_index'
  ],
  crime_victims: [
    'crime_victim_id',
    'crime_id',
    'victim_id',
    'role'
  ],
  associations: [
    'offender_id_a',
    'offender_id_b',
    'relationship_type',
    'strength'
  ]
};

const root = path.resolve(__dirname, '..');
const mockDir = path.join(root, 'client', 'src', 'mock-data');
const outDir = path.join(__dirname, 'search-data');
const booleanColumns = new Set(['repeat_victim', 'solved', 'aadhar_linked']);

function csvEscape(value, column) {
  if (value === null || value === undefined) return '';
  const text = booleanColumns.has(column)
    ? (value === true || value === 1 || value === '1' ? 'true' : 'false')
    : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

fs.mkdirSync(outDir, { recursive: true });

for (const [table, columns] of Object.entries(tableColumns)) {
  const rows = JSON.parse(fs.readFileSync(path.join(mockDir, `${table}.json`), 'utf8'));
  const lines = [
    columns.join(','),
    ...rows.map(row => columns.map(column => csvEscape(row[column], column)).join(','))
  ];
  const outPath = path.join(outDir, `${table}.csv`);
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
  console.log(`${path.relative(root, outPath)}: ${rows.length} rows`);
}
