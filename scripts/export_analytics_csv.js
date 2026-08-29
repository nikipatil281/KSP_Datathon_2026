const fs = require('fs');
const path = require('path');

const tables = [
  'districts',
  'police_stations',
  'crime_types',
  'modus_operandi',
  'location_types',
  'weapons',
  'case_statuses',
  'education_levels',
  'occupations',
  'gangs',
  'offender_statuses',
  'relationship_types',
  'offenders',
  'victims',
  'officers',
  'crimes',
  'crime_offenders',
  'crime_victims',
  'crime_officers',
  'associations',
  'monthly_stats'
];

const root = path.resolve(__dirname, '..');
const mockDir = path.join(root, 'client', 'src', 'mock-data');
const outDir = path.join(__dirname, 'analytics-data');

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

fs.mkdirSync(outDir, { recursive: true });

for (const table of tables) {
  const rows = JSON.parse(fs.readFileSync(path.join(mockDir, `${table}.json`), 'utf8'));
  const columns = Object.keys(rows[0] || {});
  const lines = [
    columns.join(','),
    ...rows.map(row => columns.map(column => csvEscape(row[column])).join(','))
  ];
  const outPath = path.join(outDir, `${table}.csv`);
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
  console.log(`${path.relative(root, outPath)}: ${rows.length} rows`);
}
