/**
 * KSP Crime Analytics - Main API Function
 * Catalyst Advanced I/O Function (Node.js)
 * Deploy as: crime-api  (type: Advanced I/O)
 *
 * Routes:
 *  GET /crimes          - list/filter crimes
 *  GET /crimes/:id      - single crime detail
 *  GET /districts       - all districts with stats
 *  GET /hotspots        - spatiotemporal hotspot clusters
 *  GET /network         - criminal association graph
 *  GET /trends          - monthly time-series trends
 *  GET /alerts          - anomaly / spike alerts
 *  GET /updates         - recent roster/offender/case activity
 *  GET /offenders/:id   - offender profile
 *  GET /officers        - officers by station/district
 *  GET /search          - full-text search
 *  GET /stats/summary   - high-level KPIs
 */

const catalyst = require('zcatalyst-sdk-node');

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
function ok(res, data, status = 200) {
    cors(res);
    res.status(status).json({ success: true, data });
}
function fail(res, msg, status = 500) {
    cors(res);
    res.status(status).json({ success: false, error: msg });
}
async function zcql(app, sql) {
    return (await app.datastore().executeQuery(sql)) || [];
}
function safe(v) { return String(v || '').replace(/'/g, "''"); }
function parseIdList(value) {
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed.map(id => parseInt(id)).filter(Boolean) : [];
    } catch {
        return [];
    }
}

const DATA_DIRECTORY_TABLES = [
    'associations',
    'case_statuses',
    'crime_offenders',
    'crime_officers',
    'crime_types',
    'crime_victims',
    'crimes',
    'districts',
    'education_levels',
    'gangs',
    'location_types',
    'modus_operandi',
    'monthly_stats',
    'occupations',
    'offender_statuses',
    'offenders',
    'officers',
    'police_stations',
    'relationship_types',
    'victims',
    'weapons',
];

const DATA_DIRECTORY_COLUMNS = {
    associations: ['association_id','offender_id_a','offender_id_b','relationship_type','relationship_type_id','strength','first_seen_crime_id'],
    case_statuses: ['case_status_id','status_name'],
    crime_offenders: ['crime_offender_id','crime_id','offender_id','role'],
    crime_officers: ['crime_officer_id','crime_id','officer_id','role','assigned_date','assignment_status'],
    crime_types: ['crime_type_id','crime_type','default_severity','category'],
    crime_victims: ['crime_victim_id','crime_id','victim_id','role'],
    crimes: ['crime_id','station_id','district','district_id','crime_type','crime_type_id','modus_operandi','modus_operandi_id','incident_date','incident_time','incident_year','incident_month','incident_day_of_week','incident_hour','latitude','longitude','location_type','location_type_id','severity','weapons_used','weapon_id','property_loss_inr','status','case_status_id','fir_number','io_officer','io_officer_id','offender_ids','victim_ids','solved','days_to_solve'],
    districts: ['district_id','name','latitude','longitude','population','urbanization_index','socio_economic_index','area_sqkm','literacy_rate','unemployment_rate'],
    education_levels: ['education_id','education_level'],
    gangs: ['gang_id','gang_name'],
    location_types: ['location_type_id','location_type'],
    modus_operandi: ['modus_operandi_id','crime_type_id','modus_operandi'],
    monthly_stats: ['stat_id','district','district_id','incident_year','incident_month','crime_type','crime_type_id','incident_count','solved_count','total_property_loss_inr','solve_rate'],
    occupations: ['occupation_id','occupation_name'],
    offender_statuses: ['offender_status_id','status_name'],
    offenders: ['offender_id','name','alias','birth_year','age','gender','district_of_origin','district_of_origin_id','education','education_id','occupation','occupation_id','known_associates','prior_convictions','gang_affiliation','gang_id','status','offender_status_id','aadhar_linked','risk_score'],
    officers: ['officer_id','officer_code','initials','rank','badge_number','station_id','district_id','specialization_crime_type_id','specialization','shift','status','current_case_load','years_of_service'],
    police_stations: ['station_id','district_id','name','latitude','longitude','officer_count','area_covered_sqkm'],
    relationship_types: ['relationship_type_id','relationship_type'],
    victims: ['victim_id','name','age','gender','occupation','occupation_id','district','district_id','repeat_victim','vulnerability_index'],
    weapons: ['weapon_id','weapon_name'],
};

module.exports = async (context, req, res) => {
    if (req.method === 'OPTIONS') { cors(res); return res.status(200).end(); }

    const app  = catalyst.initialize(req);
    const path = req.path || '';
    const q    = req.query || {};

    try {

        /* ── GET /data-directory/tables ─────────────────────────────────── */
        if (req.method === 'GET' && path === '/data-directory/tables') {
            const rows = await Promise.all(DATA_DIRECTORY_TABLES.map(async table => {
                const [countRow] = await zcql(app, `SELECT COUNT(*) AS row_count FROM ${table}`);
                return {
                    name: table,
                    file_name: `${table}.csv`,
                    row_count: countRow?.row_count || 0,
                    column_count: DATA_DIRECTORY_COLUMNS[table]?.length || 0
                };
            }));
            return ok(res, rows);
        }

        /* ── GET /data-directory/tables/:table ───────────────────────────── */
        const dataTableM = path.match(/^\/data-directory\/tables\/([a-z_]+)$/);
        if (req.method === 'GET' && dataTableM) {
            const table = dataTableM[1];
            if (!DATA_DIRECTORY_TABLES.includes(table)) return fail(res, `Unknown table: ${table}`, 400);
            const limit = Math.min(parseInt(q.limit || 5000), 5000);
            const rows = await zcql(app, `SELECT * FROM ${table} LIMIT ${limit}`);
            return ok(res, {
                name: table,
                file_name: `${table}.csv`,
                columns: DATA_DIRECTORY_COLUMNS[table] || Object.keys(rows[0] || {}),
                rows,
            });
        }

        /* ── POST /officers ──────────────────────────────────────────────── */
        if (req.method === 'POST' && path === '/officers') {
            const body = req.body || {};
            const initials = safe(body.initials || '').toUpperCase();
            if (!initials || !body.rank || !body.station_id || !body.specialization_crime_type_id) {
                return fail(res, 'initials, rank, station_id, and specialization_crime_type_id are required', 400);
            }
            const [station] = await zcql(app, `SELECT district_id FROM police_stations WHERE station_id = ${parseInt(body.station_id)}`);
            const [crimeType] = await zcql(app, `SELECT crime_type FROM crime_types WHERE crime_type_id = ${parseInt(body.specialization_crime_type_id)}`);
            const [maxOfficer] = await zcql(app, 'SELECT MAX(officer_id) AS max_id FROM officers');
            const assignedCrimeIds = Array.isArray(body.assigned_crime_ids)
                ? body.assigned_crime_ids.map(id => parseInt(id)).filter(Boolean)
                : [];
            const nextId = parseInt(maxOfficer?.max_id || 0) + 1;
            const row = {
                officer_id: nextId,
                officer_code: body.officer_code || `OFF-${initials || nextId}`,
                initials,
                rank: safe(body.rank),
                badge_number: safe(body.badge_number || `KSP-${String(nextId).padStart(3, '0')}`),
                station_id: parseInt(body.station_id),
                district_id: parseInt(body.district_id || station?.district_id || 0),
                specialization_crime_type_id: parseInt(body.specialization_crime_type_id),
                specialization: crimeType?.crime_type || safe(body.specialization || ''),
                shift: safe(body.shift || 'Day'),
                status: safe(body.status || 'Active'),
                current_case_load: assignedCrimeIds.length,
                years_of_service: parseInt(body.years_of_service || 0),
            };
            await app.datastore().table('officers').insertRow(row);
            if (assignedCrimeIds.length) {
                const [maxAssignment] = await zcql(app, 'SELECT MAX(crime_officer_id) AS max_id FROM crime_officers');
                let nextAssignmentId = parseInt(maxAssignment?.max_id || 0) + 1;
                const today = new Date().toISOString().slice(0, 10);
                await app.datastore().table('crime_officers').insertRows(assignedCrimeIds.map(crimeId => ({
                    crime_officer_id: nextAssignmentId++,
                    crime_id: crimeId,
                    officer_id: nextId,
                    role: 'Investigating Officer',
                    assigned_date: today,
                    assignment_status: 'Active',
                })));
            }
            return ok(res, row, 201);
        }

        /* ── GET /updates ───────────────────────────────────────────────── */
        if (req.method === 'GET' && path === '/updates') {
            const recentCrimes = await zcql(app,
                `SELECT crime_id, district, crime_type, incident_date, incident_time,
                        severity, fir_number, offender_ids
                 FROM crimes ORDER BY incident_date DESC LIMIT 40`);
            const latestOfficers = await zcql(app,
                `SELECT officer_id, officer_code, initials, rank, district_id,
                        station_id, specialization, current_case_load
                 FROM officers ORDER BY officer_id DESC LIMIT 8`);
            const latestOffenders = await zcql(app,
                `SELECT offender_id, name, alias, district_of_origin, prior_convictions,
                        status, risk_score, gang_affiliation
                 FROM offenders ORDER BY offender_id DESC LIMIT 8`);

            const offenderIds = [...new Set(recentCrimes.flatMap(c => parseIdList(c.offender_ids)))];
            const crimeOffenders = offenderIds.length
                ? await zcql(app,
                    `SELECT offender_id, name, alias, status, prior_convictions
                     FROM offenders WHERE offender_id IN (${offenderIds.join(',')})`)
                : [];
            const offenderById = new Map(crimeOffenders.map(o => [String(o.offender_id), o]));

            const officerUpdates = latestOfficers.map((officer, index) => ({
                id: `officer-${officer.officer_id}`,
                type: 'officer',
                tone: 'success',
                title: `Welcome to the team, ${officer.officer_code || officer.initials}`,
                description: `${officer.rank} ${officer.initials} joined ${officer.specialization || 'general investigation'} duty with ${parseInt(officer.current_case_load || 0)} assigned cases.`,
                occurred_at: new Date(Date.now() - index * 3600000).toISOString(),
                district: '',
                subject: officer.officer_code || officer.initials,
                priority: 'Normal',
                meta: {
                    officer_id: officer.officer_id,
                    station_id: officer.station_id,
                    case_load: officer.current_case_load,
                },
            }));

            const crimeUpdates = recentCrimes.flatMap(crime => {
                const repeatOffender = parseIdList(crime.offender_ids)
                    .map(id => offenderById.get(String(id)))
                    .find(o => o && parseInt(o.prior_convictions || 0) > 0 && !['Convicted', 'Juvenile'].includes(o.status));
                if (!repeatOffender) return [];
                return [{
                    id: `repeat-crime-${crime.crime_id}-${repeatOffender.offender_id}`,
                    type: 'crime',
                    tone: parseInt(crime.severity || 0) >= 5 ? 'danger' : 'warning',
                    title: 'Repeat-offender activity detected',
                    description: `${repeatOffender.alias || repeatOffender.name} is linked to a new ${String(crime.crime_type || '').toLowerCase()} case in ${crime.district}. Current offender status: ${repeatOffender.status}.`,
                    occurred_at: `${crime.incident_date}T${crime.incident_time || '09:00:00'}`,
                    district: crime.district,
                    subject: repeatOffender.alias || repeatOffender.name,
                    priority: parseInt(crime.severity || 0) >= 5 ? 'High' : 'Watch',
                    meta: {
                        crime_id: crime.crime_id,
                        fir_number: crime.fir_number,
                        offender_id: repeatOffender.offender_id,
                        prior_convictions: repeatOffender.prior_convictions,
                    },
                }];
            });

            const offenderUpdates = latestOffenders.map((offender, index) => ({
                id: `offender-registry-${offender.offender_id}`,
                type: 'offender',
                tone: parseFloat(offender.risk_score || 0) >= 0.75 ? 'danger' : 'info',
                title: 'Offender profile added to registry',
                description: `${offender.alias || offender.name} was added with ${parseInt(offender.prior_convictions || 0)} prior convictions and ${offender.status} status.`,
                occurred_at: new Date(Date.now() - (index + 8) * 7200000).toISOString(),
                district: offender.district_of_origin,
                subject: offender.alias || offender.name,
                priority: parseFloat(offender.risk_score || 0) >= 0.75 ? 'High' : 'Normal',
                meta: {
                    offender_id: offender.offender_id,
                    risk_score: offender.risk_score,
                    gang_affiliation: offender.gang_affiliation,
                },
            }));

            return ok(res, [...officerUpdates, ...crimeUpdates, ...offenderUpdates]
                .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
                .slice(0, 60));
        }

        /* ── GET /stats/summary ──────────────────────────────────────────── */
        if (path === '/stats/summary') {
            const isAllYears = String(q.year || '').toLowerCase() === 'all';
            const year = isAllYears ? null : parseInt(q.year || 2024);
            const yearWhere = isAllYears
                ? 'incident_year BETWEEN 2020 AND 2025'
                : `incident_year = ${year}`;
            const [summary] = await zcql(app,
                `SELECT COUNT(*) AS total_crimes, SUM(solved) AS solved_crimes,
                        SUM(property_loss_inr) AS total_loss, AVG(severity) AS avg_severity
                 FROM crimes WHERE ${yearWhere}`);
            const byType     = await zcql(app,
                `SELECT crime_type, COUNT(*) AS count, SUM(solved) AS solved
                 FROM crimes WHERE ${yearWhere}
                 GROUP BY crime_type ORDER BY count DESC`);
            const byDistrict = await zcql(app,
                `SELECT district, COUNT(*) AS count FROM crimes WHERE ${yearWhere}
                 GROUP BY district ORDER BY count DESC LIMIT 12`);
            const byHour     = await zcql(app,
                `SELECT incident_hour AS hour, COUNT(*) AS count
                 FROM crimes WHERE ${yearWhere}
                 GROUP BY incident_hour ORDER BY incident_hour`);
            const byDow      = await zcql(app,
                `SELECT incident_day_of_week AS day, COUNT(*) AS count
                 FROM crimes WHERE ${yearWhere}
                 GROUP BY incident_day_of_week`);
            const cloudCrimes = await zcql(app,
                `SELECT crime_id, offender_ids, io_officer_id, status, solved
                 FROM crimes WHERE ${yearWhere} LIMIT 5000`);
            const [allOffenders, allOfficers] = await Promise.all([
                zcql(app, 'SELECT offender_id, name, alias FROM offenders LIMIT 5000'),
                zcql(app, 'SELECT officer_id, officer_code, initials, rank FROM officers LIMIT 1000'),
            ]);
            const offenderById = new Map(allOffenders.map(o => [String(o.offender_id), o]));
            const officerById = new Map(allOfficers.map(o => [String(o.officer_id), o]));
            const offenderCounts = {};
            const officerCounts = {};
            cloudCrimes.forEach(crime => {
                parseIdList(crime.offender_ids).forEach(id => {
                    const offender = offenderById.get(String(id));
                    if (!offender) return;
                    const label = offender.name;
                    if (!offenderCounts[label]) {
                        offenderCounts[label] = {
                            id: offender.offender_id,
                            text: label,
                            name: offender.name,
                            alias: offender.alias,
                            value: 0,
                        };
                    }
                    offenderCounts[label].value += 1;
                });
                if (String(crime.status || '').startsWith('Closed') || parseInt(crime.solved || 0) === 1) {
                    const officer = officerById.get(String(crime.io_officer_id));
                    if (!officer) return;
                    const label = officer.officer_code || officer.initials;
                    if (!officerCounts[label]) {
                        officerCounts[label] = {
                            id: officer.officer_id,
                            text: label,
                            initials: officer.initials,
                            rank: officer.rank,
                            value: 0,
                        };
                    }
                    officerCounts[label].value += 1;
                }
            });
            return ok(res, {
                summary: {
                    ...summary,
                    year: isAllYears ? 'all' : year,
                    year_label: isAllYears ? '2020-2025' : String(year),
                    solve_rate: summary.total_crimes > 0
                        ? +(summary.solved_crimes / summary.total_crimes * 100).toFixed(1) : 0
                },
                by_crime_type:    byType,
                by_district:      byDistrict,
                by_hour:          byHour,
                by_day_of_week:   byDow,
                offender_wordcloud: Object.values(offenderCounts)
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 45),
                officer_wordcloud: Object.values(officerCounts)
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 45),
            });
        }

        /* ── GET /crimes ─────────────────────────────────────────────────── */
        if (path === '/crimes') {
            let where = 'WHERE 1=1';
            if (q.district)   where += ` AND district = '${safe(q.district)}'`;
            if (q.crime_type) where += ` AND crime_type = '${safe(q.crime_type)}'`;
            if (q.year)       where += ` AND incident_year = ${parseInt(q.year)}`;
            if (q.status)     where += ` AND status = '${safe(q.status)}'`;
            if (q.solved)     where += ` AND solved = ${parseInt(q.solved)}`;
            const limit  = Math.min(parseInt(q.limit  || 100), 500);
            const offset = parseInt(q.offset || 0);
            const rows   = await zcql(app,
                `SELECT crime_id, district, crime_type, modus_operandi, incident_date,
                        incident_time, incident_hour, incident_day_of_week,
                        latitude, longitude, location_type,
                        severity, status, solved, fir_number, station_id,
                        property_loss_inr, weapons_used
                 FROM crimes ${where}
                 ORDER BY incident_date DESC LIMIT ${limit} OFFSET ${offset}`);
            return ok(res, rows);
        }

        /* ── GET /crimes/:id ─────────────────────────────────────────────── */
        const crimeM = path.match(/^\/crimes\/(\d+)$/);
        if (crimeM) {
            const id      = parseInt(crimeM[1]);
            const [crime] = await zcql(app, `SELECT * FROM crimes WHERE crime_id = ${id}`);
            if (!crime) return fail(res, 'Crime not found', 404);
            const offIds = JSON.parse(crime.offender_ids || '[]');
            const vicIds = JSON.parse(crime.victim_ids   || '[]');
            const [offenders, victims] = await Promise.all([
                offIds.length ? zcql(app,
                    `SELECT offender_id, name, alias, age, gender, gang_affiliation,
                            prior_convictions, status, risk_score
                     FROM offenders WHERE offender_id IN (${offIds.join(',')})`) : [],
                vicIds.length ? zcql(app,
                    `SELECT victim_id, name, age, gender, occupation
                     FROM victims WHERE victim_id IN (${vicIds.join(',')})`) : []
            ]);
            return ok(res, { ...crime, offenders, victims });
        }

        /* ── GET /districts ──────────────────────────────────────────────── */
        if (path === '/districts') {
            const year = parseInt(q.year || 2024);
            const rows = await zcql(app,
                `SELECT d.district_id, d.name, d.latitude, d.longitude,
                        d.population, d.urbanization_index, d.socio_economic_index,
                        d.literacy_rate, d.unemployment_rate, d.area_sqkm,
                        COUNT(c.crime_id) AS total_crimes,
                        SUM(c.solved) AS solved_crimes,
                        SUM(c.property_loss_inr) AS total_loss,
                        AVG(c.severity) AS avg_severity
                 FROM districts d
                 LEFT JOIN crimes c ON c.district = d.name AND c.incident_year = ${year}
                 GROUP BY d.district_id, d.name, d.latitude, d.longitude,
                          d.population, d.urbanization_index, d.socio_economic_index,
                          d.literacy_rate, d.unemployment_rate, d.area_sqkm`);
            return ok(res, rows.map(r => ({
                ...r,
                crime_rate_per_100k: r.population > 0
                    ? Math.round(r.total_crimes / r.population * 100000) : 0,
                solve_rate: r.total_crimes > 0
                    ? +(r.solved_crimes / r.total_crimes).toFixed(3) : 0
            })));
        }

        /* ── GET /hotspots ───────────────────────────────────────────────── */
        if (path === '/hotspots') {
            const year  = parseInt(q.year  || 2024);
            const mPart = q.month      ? `AND incident_month = ${parseInt(q.month)}` : '';
            const cPart = q.crime_type ? `AND crime_type = '${safe(q.crime_type)}'`  : '';
            const rows  = await zcql(app,
                `SELECT latitude, longitude, crime_type, incident_hour, severity, district, incident_month
                 FROM crimes WHERE incident_year = ${year} ${mPart} ${cPart} LIMIT 2000`);
            const CELL = 0.05;
            const grid = {};
            for (const r of rows) {
                const k = `${Math.floor(r.latitude/CELL)*CELL}_${Math.floor(r.longitude/CELL)*CELL}`;
                if (!grid[k]) grid[k] = {
                    lat: Math.floor(r.latitude/CELL)*CELL + CELL/2,
                    lng: Math.floor(r.longitude/CELL)*CELL + CELL/2,
                    count: 0, sev: 0, types: {}, night: 0
                };
                grid[k].count++;
                grid[k].sev += (r.severity || 1);
                grid[k].types[r.crime_type] = (grid[k].types[r.crime_type] || 0) + 1;
                if (r.incident_hour >= 22 || r.incident_hour <= 4) grid[k].night++;
            }
            return ok(res, Object.values(grid)
                .filter(h => h.count >= 2)
                .map(h => ({
                    lat: +h.lat.toFixed(5), lng: +h.lng.toFixed(5),
                    count: h.count,
                    avg_severity:    +(h.sev / h.count).toFixed(1),
                    dominant_crime:  Object.entries(h.types).sort((a,b)=>b[1]-a[1])[0]?.[0],
                    night_ratio:     +(h.night / h.count).toFixed(2),
                    intensity:       +Math.min(1, h.count / 20).toFixed(2)
                }))
                .sort((a,b) => b.count - a.count));
        }

        /* ── GET /network ────────────────────────────────────────────────── */
        if (path === '/network') {
            const limit    = Math.min(parseInt(q.limit || 120), 300);
            const [nodes, edges] = await Promise.all([
                zcql(app,
                    `SELECT offender_id, name, alias, gang_affiliation, prior_convictions,
                            risk_score, status, age
                     FROM offenders ORDER BY prior_convictions DESC, risk_score DESC
                     LIMIT ${limit}`),
                zcql(app,
                    `SELECT offender_id_a, offender_id_b, relationship_type, strength
                     FROM associations LIMIT 600`)
            ]);
            const ids = new Set(nodes.map(n => n.offender_id));
            return ok(res, {
                nodes: nodes.map(o => ({
                    id:     o.offender_id,
                    label:  o.name,
                    alias:  o.alias,
                    group:  o.gang_affiliation || 'None',
                    prior:  o.prior_convictions,
                    risk:   o.risk_score,
                    status: o.status,
                    age:    o.age
                })),
                edges: edges
                    .filter(e => ids.has(e.offender_id_a) && ids.has(e.offender_id_b))
                    .map(e => ({
                        from:   e.offender_id_a,
                        to:     e.offender_id_b,
                        type:   e.relationship_type,
                        weight: e.strength
                    }))
            });
        }

        /* ── GET /trends ─────────────────────────────────────────────────── */
        if (path === '/trends') {
            const distPart = q.district ? `AND district = '${safe(q.district)}'` : '';
            const ctPart   = q.crime_type ? `AND crime_type = '${safe(q.crime_type)}'` : '';
            return ok(res, await zcql(app,
                `SELECT incident_year, incident_month, crime_type, district,
                        incident_count, solved_count, total_property_loss_inr, solve_rate
                 FROM monthly_stats WHERE incident_year >= 2020 ${distPart} ${ctPart}
                 ORDER BY incident_year, incident_month, crime_type`));
        }

        /* ── GET /alerts ─────────────────────────────────────────────────── */
        if (path === '/alerts') {
            const [recent, historical] = await Promise.all([
                zcql(app,
                    `SELECT district, crime_type, COUNT(*) AS count FROM crimes
                     WHERE incident_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
                     GROUP BY district, crime_type`),
                zcql(app,
                    `SELECT district, crime_type,
                            AVG(incident_count) AS avg_monthly,
                            STDDEV(incident_count) AS stddev_monthly
                     FROM monthly_stats WHERE incident_year < YEAR(CURDATE())
                     GROUP BY district, crime_type`)
            ]);
            const hist = {};
            for (const h of historical) hist[`${h.district}|${h.crime_type}`] = h;
            const alerts = [];
            for (const r of recent) {
                const h = hist[`${r.district}|${r.crime_type}`];
                if (!h || !h.avg_monthly) continue;
                const z = (r.count - h.avg_monthly) / Math.max(h.stddev_monthly || 1, 0.1);
                if (z > 1.5) alerts.push({
                    district:     r.district,
                    crime_type:   r.crime_type,
                    recent_count: r.count,
                    avg_monthly:  +h.avg_monthly.toFixed(1),
                    z_score:      +z.toFixed(2),
                    severity:     z > 3 ? 'CRITICAL' : z > 2 ? 'HIGH' : 'MEDIUM',
                    pct_above_avg: Math.round((r.count - h.avg_monthly) / h.avg_monthly * 100)
                });
            }
            return ok(res, alerts.sort((a,b) => b.z_score - a.z_score));
        }

        /* ── GET /offenders/:id ──────────────────────────────────────────── */
        const offM = path.match(/^\/offenders\/(\d+)$/);
        if (offM) {
            const id  = parseInt(offM[1]);
            const [o] = await zcql(app, `SELECT * FROM offenders WHERE offender_id = ${id}`);
            if (!o) return fail(res, 'Offender not found', 404);
            const assoc = await zcql(app,
                `SELECT a.offender_id_b AS associated_id, a.relationship_type, a.strength,
                        o2.name AS associated_name, o2.gang_affiliation
                 FROM associations a JOIN offenders o2 ON o2.offender_id = a.offender_id_b
                 WHERE a.offender_id_a = ${id} LIMIT 50`);
            return ok(res, { ...o, associations: assoc });
        }

        /* ── GET /officers ───────────────────────────────────────────────── */
        if (path === '/officers') {
            let where = 'WHERE 1=1';
            if (q.station_id)  where += ` AND station_id = ${parseInt(q.station_id)}`;
            if (q.district_id) where += ` AND district_id = ${parseInt(q.district_id)}`;
            if (q.status)      where += ` AND status = '${safe(q.status)}'`;
            return ok(res, await zcql(app,
                `SELECT officer_id, officer_code, initials, rank, badge_number,
                        station_id, district_id, specialization_crime_type_id,
                        specialization, shift, status, current_case_load,
                        years_of_service
                 FROM officers ${where}
                 ORDER BY current_case_load ASC, officer_id ASC LIMIT 200`));
        }

        /* ── GET /search ─────────────────────────────────────────────────── */
        if (path === '/search') {
            const term = safe(q.q || '');
            if (!term) return fail(res, 'Query param "q" required', 400);
            const [crimes, offenders] = await Promise.all([
                zcql(app,
                    `SELECT crime_id, crime_type, district, incident_date, fir_number, status
                     FROM crimes WHERE fir_number LIKE '%${term}%'
                     OR crime_type LIKE '%${term}%' OR modus_operandi LIKE '%${term}%'
                     LIMIT 20`),
                zcql(app,
                    `SELECT offender_id, name, alias, gang_affiliation, status, risk_score
                     FROM offenders WHERE name LIKE '%${term}%' OR alias LIKE '%${term}%'
                     LIMIT 20`)
            ]);
            return ok(res, { crimes, offenders });
        }

        /* ── GET /police-stations ────────────────────────────────────────── */
        if (path === '/police-stations') {
            const distPart = q.district_id ? `WHERE district_id = ${parseInt(q.district_id)}` : '';
            return ok(res, await zcql(app,
                `SELECT station_id, district_id, name, latitude, longitude,
                        officer_count, area_covered_sqkm
                 FROM police_stations ${distPart} LIMIT 200`));
        }

        return fail(res, `Not found: ${req.method} ${path}`, 404);

    } catch (e) {
        console.error('[crime-api]', e);
        return fail(res, e.message || 'Internal error');
    }
};
