import associations from '../mock-data/associations.json';
import caseStatuses from '../mock-data/case_statuses.json';
import crimeOffenders from '../mock-data/crime_offenders.json';
import crimeOfficers from '../mock-data/crime_officers.json';
import crimeTypes from '../mock-data/crime_types.json';
import crimeVictims from '../mock-data/crime_victims.json';
import crimes from '../mock-data/crimes.json';
import districts from '../mock-data/districts.json';
import educationLevels from '../mock-data/education_levels.json';
import gangs from '../mock-data/gangs.json';
import locationTypes from '../mock-data/location_types.json';
import modusOperandi from '../mock-data/modus_operandi.json';
import monthlyStats from '../mock-data/monthly_stats.json';
import occupations from '../mock-data/occupations.json';
import offenderStatuses from '../mock-data/offender_statuses.json';
import offenders from '../mock-data/offenders.json';
import officers from '../mock-data/officers.json';
import policeStations from '../mock-data/police_stations.json';
import relationshipTypes from '../mock-data/relationship_types.json';
import victims from '../mock-data/victims.json';
import weapons from '../mock-data/weapons.json';
import firAccused from '../mock-data/Accused.json';
import firAct from '../mock-data/Act.json';
import firActSectionAssociation from '../mock-data/ActSectionAssociation.json';
import firArrestSurrender from '../mock-data/ArrestSurrender.json';
import firCaseCategory from '../mock-data/CaseCategory.json';
import firCaseMaster from '../mock-data/CaseMaster.json';
import firCaseStatusMaster from '../mock-data/CaseStatusMaster.json';
import firChargesheetDetails from '../mock-data/ChargesheetDetails.json';
import firComplainantDetails from '../mock-data/ComplainantDetails.json';
import firCourt from '../mock-data/Court.json';
import firCrimeHead from '../mock-data/CrimeHead.json';
import firCrimeSubHead from '../mock-data/CrimeSubHead.json';
import firDistrict from '../mock-data/District.json';
import firEmployee from '../mock-data/Employee.json';
import firGravityOffence from '../mock-data/GravityOffence.json';
import firRank from '../mock-data/Rank.json';
import firSection from '../mock-data/Section.json';
import firUnit from '../mock-data/Unit.json';
import firVictim from '../mock-data/Victim.json';
import firInvArrestSurrenderAccused from '../mock-data/inv_arrestsurrenderaccused.json';

const OFFICERS_STORAGE_KEY = 'ksp_revamp_added_officers';
const CRIME_OFFICERS_STORAGE_KEY = 'ksp_revamp_added_crime_officers';
const ACTIVITY_STORAGE_KEY = 'ksp_revamp_activity_updates';

const baseTables = {

  Accused: firAccused,
  Act: firAct,
  ActSectionAssociation: firActSectionAssociation,
  ArrestSurrender: firArrestSurrender,
  CaseCategory: firCaseCategory,
  CaseMaster: firCaseMaster,
  CaseStatusMaster: firCaseStatusMaster,
  ChargesheetDetails: firChargesheetDetails,
  ComplainantDetails: firComplainantDetails,
  Court: firCourt,
  CrimeHead: firCrimeHead,
  CrimeSubHead: firCrimeSubHead,
  District: firDistrict,
  Employee: firEmployee,
  GravityOffence: firGravityOffence,
  Rank: firRank,
  Section: firSection,
  Unit: firUnit,
  Victim: firVictim,
  inv_arrestsurrenderaccused: firInvArrestSurrenderAccused,
  associations,
  case_statuses: caseStatuses,
  crime_offenders: crimeOffenders,
  crime_officers: crimeOfficers,
  crime_types: crimeTypes,
  crime_victims: crimeVictims,
  crimes,
  districts,
  education_levels: educationLevels,
  gangs,
  location_types: locationTypes,
  modus_operandi: modusOperandi,
  monthly_stats: monthlyStats,
  occupations,
  offender_statuses: offenderStatuses,
  offenders,
  officers,
  police_stations: policeStations,
  relationship_types: relationshipTypes,
  victims,
  weapons,
};

const wait = (value) => new Promise(resolve => {
  window.setTimeout(() => resolve(value), 120);
});

const toNumber = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const matches = (value, query) =>
  String(value || '').toLowerCase().includes(query.toLowerCase());

function parseIdList(value) {
  if (Array.isArray(value)) return value.map(toNumber).filter(Boolean);
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map(toNumber).filter(Boolean) : [];
  } catch {
    return [];
  }
}


function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateDiffDays(start, end) {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function caseYear(row) {
  return toNumber(String(row.CrimeRegisteredDate || '').slice(0, 4));
}

function getFirCasesForYear(year) {
  if (isAllYears(year)) return firCaseMaster.filter(c => caseYear(c) >= 2020 && caseYear(c) <= 2025);
  return firCaseMaster.filter(c => caseYear(c) === toNumber(year));
}

function topRows(rows, limit = 10) {
  return rows.sort((a, b) => toNumber(b.total || b.count || b.cases || b.registered) - toNumber(a.total || a.count || a.cases || a.registered)).slice(0, limit);
}

function buildFirPatterns(year = 2024) {
  const cases = getFirCasesForYear(year);
  const caseIds = new Set(cases.map(c => String(c.CaseMasterID)));
  const statusById = new Map(firCaseStatusMaster.map(r => [String(r.CaseStatusID), r.CaseStatusName]));
  const categoryById = new Map(firCaseCategory.map(r => [String(r.CaseCategoryID), r.LookupValue]));
  const gravityById = new Map(firGravityOffence.map(r => [String(r.GravityOffenceID), r.LookupValue]));
  const headById = new Map(firCrimeHead.map(r => [String(r.CrimeHeadID), r.CrimeGroupName]));
  const subHeadById = new Map(firCrimeSubHead.map(r => [String(r.CrimeSubHeadID), r]));
  const unitById = new Map(firUnit.map(r => [String(r.UnitID), r]));
  const districtById = new Map(firDistrict.map(r => [String(r.DistrictID), r.DistrictName]));
  const employeeById = new Map(firEmployee.map(r => [String(r.EmployeeID), r]));
  const rankById = new Map(firRank.map(r => [String(r.RankID), r.RankName]));
  const courtById = new Map(firCourt.map(r => [String(r.CourtID), r.CourtName]));
  const sectionByKey = new Map(firSection.map(r => [`${r.ActCode}|${r.SectionCode}`, r]));

  const chargesheets = firChargesheetDetails.filter(r => caseIds.has(String(r.CaseMasterID)));
  const arrests = firArrestSurrender.filter(r => caseIds.has(String(r.CaseMasterID)));
  const accusedRows = firAccused.filter(r => caseIds.has(String(r.CaseMasterID)));
  const victimRows = firVictim.filter(r => caseIds.has(String(r.CaseMasterID)));
  const actRows = firActSectionAssociation.filter(r => caseIds.has(String(r.CaseMasterID)));
  const chargesheetByCase = new Map(chargesheets.map(r => [String(r.CaseMasterID), r]));
  const arrestCountByCase = arrests.reduce((acc, r) => {
    acc[String(r.CaseMasterID)] = (acc[String(r.CaseMasterID)] || 0) + 1;
    return acc;
  }, {});

  const statusCounts = {};
  const categoryCounts = {};
  const gravityCounts = {};
  const monthly = {};
  const gravityByHead = {};
  const stationPressure = {};
  const officerLoad = {};
  const victimAccusedMix = {};
  const courtPipeline = {};

  cases.forEach(c => {
    const status = statusById.get(String(c.CaseStatusID)) || `Status ${c.CaseStatusID}`;
    const category = categoryById.get(String(c.CaseCategoryID)) || `Category ${c.CaseCategoryID}`;
    const gravity = gravityById.get(String(c.GravityOffenceID)) || `Gravity ${c.GravityOffenceID}`;
    const head = headById.get(String(c.CrimeMajorHeadID)) || `Head ${c.CrimeMajorHeadID}`;
    const subHead = subHeadById.get(String(c.CrimeMinorHeadID));
    const unit = unitById.get(String(c.PoliceStationID));
    const district = districtById.get(String(unit?.DistrictID)) || 'Unknown District';
    const station = unit?.UnitName || `Unit ${c.PoliceStationID}`;
    const employee = employeeById.get(String(c.PolicePersonID));
    const officer = employee?.FirstName || `OFF-${c.PolicePersonID}`;
    const rank = rankById.get(String(employee?.RankID)) || 'Unranked';
    const court = courtById.get(String(c.CourtID)) || `Court ${c.CourtID}`;
    const month = String(c.CrimeRegisteredDate || '').slice(0, 7);
    const cs = chargesheetByCase.get(String(c.CaseMasterID));
    const daysToCs = cs ? dateDiffDays(c.CrimeRegisteredDate, cs.csdate) : null;

    statusCounts[status] = (statusCounts[status] || 0) + 1;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    gravityCounts[gravity] = (gravityCounts[gravity] || 0) + 1;

    if (!monthly[month]) monthly[month] = { month, registered: 0, chargesheeted: 0, arrests: 0 };
    monthly[month].registered += 1;
    if (cs) monthly[month].chargesheeted += 1;
    monthly[month].arrests += arrestCountByCase[String(c.CaseMasterID)] || 0;

    if (!gravityByHead[head]) gravityByHead[head] = { crime_head: head, Heinous: 0, 'Non-Heinous': 0, total: 0 };
    gravityByHead[head][gravity] = (gravityByHead[head][gravity] || 0) + 1;
    gravityByHead[head].total += 1;

    const stationKey = `${district}|${station}`;
    if (!stationPressure[stationKey]) stationPressure[stationKey] = { district, station, registered: 0, chargesheeted: 0, arrests: 0, pending: 0, charge_rate: 0 };
    stationPressure[stationKey].registered += 1;
    stationPressure[stationKey].arrests += arrestCountByCase[String(c.CaseMasterID)] || 0;
    if (cs) stationPressure[stationKey].chargesheeted += 1;
    if (!['Charge Sheeted', 'Closed', 'False Case'].includes(status)) stationPressure[stationKey].pending += 1;

    if (!officerLoad[officer]) officerLoad[officer] = { officer, rank, station, registered: 0, arrests: 0, chargesheets: 0 };
    officerLoad[officer].registered += 1;
    officerLoad[officer].arrests += arrestCountByCase[String(c.CaseMasterID)] || 0;
    if (cs) officerLoad[officer].chargesheets += 1;

    if (!victimAccusedMix[head]) victimAccusedMix[head] = { crime_head: head, cases: 0, victims: 0, accused: 0, avg_victims: 0, avg_accused: 0 };
    victimAccusedMix[head].cases += 1;
    victimAccusedMix[head].victims += victimRows.filter(v => String(v.CaseMasterID) === String(c.CaseMasterID)).length;
    victimAccusedMix[head].accused += accusedRows.filter(a => String(a.CaseMasterID) === String(c.CaseMasterID)).length;

    if (!courtPipeline[court]) courtPipeline[court] = { court, cases: 0, chargesheets: 0, avg_days_to_chargesheet: 0, total_days: 0 };
    courtPipeline[court].cases += 1;
    if (cs) {
      courtPipeline[court].chargesheets += 1;
      courtPipeline[court].total_days += daysToCs || 0;
    }
  });

  const legalSections = Object.values(actRows.reduce((acc, row) => {
    const key = `${row.ActID}|${row.SectionID}`;
    const section = sectionByKey.get(key);
    const caseRow = firCaseMaster.find(c => String(c.CaseMasterID) === String(row.CaseMasterID));
    const head = headById.get(String(caseRow?.CrimeMajorHeadID)) || 'Unknown';
    if (!acc[key]) acc[key] = { act: row.ActID, section: row.SectionID, label: `${row.ActID} ${row.SectionID}`, description: section?.SectionDescription || '', cases: 0, chargesheeted: 0, arrest_events: 0, crime_head: head };
    acc[key].cases += 1;
    if (chargesheetByCase.has(String(row.CaseMasterID))) acc[key].chargesheeted += 1;
    acc[key].arrest_events += arrestCountByCase[String(row.CaseMasterID)] || 0;
    return acc;
  }, {})).sort((a, b) => b.cases - a.cases).slice(0, 10);

  const stationRows = Object.values(stationPressure).map(r => ({
    ...r,
    charge_rate: r.registered ? Math.round(r.chargesheeted / r.registered * 100) : 0,
  }));
  const officerRows = Object.values(officerLoad).map(r => ({
    ...r,
    closure_pressure: r.registered ? Math.round(r.chargesheets / r.registered * 100) : 0,
  }));
  const mixRows = Object.values(victimAccusedMix).map(r => ({
    ...r,
    avg_victims: r.cases ? +(r.victims / r.cases).toFixed(2) : 0,
    avg_accused: r.cases ? +(r.accused / r.cases).toFixed(2) : 0,
  }));
  const courtRows = Object.values(courtPipeline).map(r => ({
    ...r,
    avg_days_to_chargesheet: r.chargesheets ? Math.round(r.total_days / r.chargesheets) : 0,
  }));
  const chargeDays = chargesheets
    .map(cs => {
      const caseRow = firCaseMaster.find(c => String(c.CaseMasterID) === String(cs.CaseMasterID));
      return caseRow ? dateDiffDays(caseRow.CrimeRegisteredDate, cs.csdate) : null;
    })
    .filter(v => v !== null);

  return {
    summary: {
      total_cases: cases.length,
      chargesheeted_cases: chargesheets.length,
      arrest_events: arrests.length,
      avg_days_to_chargesheet: chargeDays.length ? Math.round(chargeDays.reduce((a, b) => a + b, 0) / chargeDays.length) : 0,
      heinous_cases: gravityCounts.Heinous || 0,
      multi_accused_cases: cases.filter(c => accusedRows.filter(a => String(a.CaseMasterID) === String(c.CaseMasterID)).length > 1).length,
    },
    status_flow: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    category_mix: Object.entries(categoryCounts).map(([category, count]) => ({ category, count })),
    gravity_by_head: Object.values(gravityByHead).sort((a, b) => b.total - a.total),
    monthly_registrations: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)),
    station_pressure: topRows(stationRows, 10),
    legal_sections: legalSections,
    officer_load: topRows(officerRows, 12),
    victim_accused_mix: mixRows.sort((a, b) => b.cases - a.cases),
    court_pipeline: topRows(courtRows, 10),
  };
}

function isAllYears(year) {
  return year === 'all' || year === 'All' || year === undefined || year === null;
}

function readAddedOfficers() {
  try {
    const raw = window.localStorage.getItem(OFFICERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readAddedCrimeOfficers() {
  try {
    const raw = window.localStorage.getItem(CRIME_OFFICERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readActivityUpdates() {
  try {
    const raw = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeActivityUpdates(rows) {
  window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(rows));
}

function writeAddedOfficers(rows) {
  window.localStorage.setItem(OFFICERS_STORAGE_KEY, JSON.stringify(rows));
}

function writeAddedCrimeOfficers(rows) {
  window.localStorage.setItem(CRIME_OFFICERS_STORAGE_KEY, JSON.stringify(rows));
}

function getOfficers() {
  return [...officers, ...readAddedOfficers()];
}

function getTableRows(table) {
  if (table === 'officers') return getOfficers();
  if (table === 'crime_officers') return [...crimeOfficers, ...readAddedCrimeOfficers()];
  return baseTables[table] || [];
}

function groupBy(rows, keyFn) {
  return rows.reduce((acc, row) => {
    const key = keyFn(row);
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
}

function getCrimesForYear(year) {
  if (isAllYears(year)) {
    return crimes.filter(c => toNumber(c.incident_year) >= 2020 && toNumber(c.incident_year) <= 2025);
  }
  return crimes.filter(c => toNumber(c.incident_year) === toNumber(year));
}

function buildSummary(year = 2024) {
  const rows = getCrimesForYear(year);
  const total = rows.length;
  const solved = rows.reduce((sum, c) => sum + toNumber(c.solved), 0);
  const totalLoss = rows.reduce((sum, c) => sum + toNumber(c.property_loss_inr), 0);
  const severity = rows.reduce((sum, c) => sum + toNumber(c.severity), 0);

  const byType = Object.entries(groupBy(rows, c => c.crime_type))
    .map(([crime_type, items]) => ({
      crime_type,
      count: items.length,
      solved: items.reduce((sum, c) => sum + toNumber(c.solved), 0),
    }))
    .sort((a, b) => b.count - a.count);

  const byDistrict = Object.entries(groupBy(rows, c => c.district))
    .map(([district, items]) => ({ district, count: items.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: rows.filter(c => toNumber(c.incident_hour) === hour).length,
  }));

  const byDow = Object.entries(groupBy(rows, c => c.incident_day_of_week))
    .map(([day, items]) => ({ day, count: items.length }));

  const offenderById = new Map(offenders.map(o => [String(o.offender_id), o]));
  const offenderCounts = {};
  rows.forEach(c => {
    parseIdList(c.offender_ids).forEach(id => {
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
  });

  const officerById = new Map(getOfficers().map(o => [String(o.officer_id), o]));
  const officerCounts = {};
  rows
    .filter(c => String(c.status || '').startsWith('Closed') || toNumber(c.solved) === 1)
    .forEach(c => {
      const officer = officerById.get(String(c.io_officer_id));
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
    });

  const offenderWordcloud = Object.values(offenderCounts)
    .sort((a, b) => b.value - a.value)
    .slice(0, 45);
  const officerWordcloud = Object.values(officerCounts)
    .sort((a, b) => b.value - a.value)
    .slice(0, 45);

  return {
    summary: {
      total_crimes: total,
      solved_crimes: solved,
      total_loss: totalLoss,
      avg_severity: total ? severity / total : 0,
      year,
      year_label: isAllYears(year) ? '2020-2025' : String(year),
      solve_rate: total ? +(solved / total * 100).toFixed(1) : 0,
    },
    by_crime_type: byType,
    by_district: byDistrict,
    by_hour: byHour,
    by_day_of_week: byDow,
    offender_wordcloud: offenderWordcloud,
    officer_wordcloud: officerWordcloud,
    fir_patterns: buildFirPatterns(year),
  };
}

function listCrimes(filters = {}) {
  let rows = crimes;
  if (filters.district) rows = rows.filter(c => c.district === filters.district);
  if (filters.crime_type) rows = rows.filter(c => c.crime_type === filters.crime_type);
  if (filters.year) rows = rows.filter(c => toNumber(c.incident_year) === toNumber(filters.year));
  if (filters.status) rows = rows.filter(c => c.status === filters.status);
  if (filters.solved !== undefined) rows = rows.filter(c => toNumber(c.solved) === toNumber(filters.solved));
  const offset = toNumber(filters.offset);
  const limit = Math.min(toNumber(filters.limit) || 100, 500);
  return rows
    .slice()
    .sort((a, b) => String(b.incident_date).localeCompare(String(a.incident_date)))
    .slice(offset, offset + limit);
}

function getDistricts(year = 2024) {
  const rows = getCrimesForYear(year);
  return districts.map(d => {
    const districtCrimes = rows.filter(c => c.district === d.name);
    const total = districtCrimes.length;
    const solved = districtCrimes.reduce((sum, c) => sum + toNumber(c.solved), 0);
    const loss = districtCrimes.reduce((sum, c) => sum + toNumber(c.property_loss_inr), 0);
    const sev = districtCrimes.reduce((sum, c) => sum + toNumber(c.severity), 0);
    return {
      ...d,
      total_crimes: total,
      solved_crimes: solved,
      total_loss: loss,
      avg_severity: total ? sev / total : 0,
      crime_rate_per_100k: d.population ? Math.round(total / toNumber(d.population) * 100000) : 0,
      solve_rate: total ? +(solved / total).toFixed(3) : 0,
    };
  });
}

function getHotspots(params = {}) {
  let rows = getCrimesForYear(params.year || 2024);
  if (params.month) rows = rows.filter(c => toNumber(c.incident_month) === toNumber(params.month));
  if (params.crime_type) rows = rows.filter(c => c.crime_type === params.crime_type);

  const cell = 0.05;
  const grid = {};
  rows.forEach(r => {
    const lat = Math.floor(toNumber(r.latitude) / cell) * cell;
    const lng = Math.floor(toNumber(r.longitude) / cell) * cell;
    const key = `${lat}_${lng}`;
    if (!grid[key]) grid[key] = { lat: lat + cell / 2, lng: lng + cell / 2, count: 0, sev: 0, types: {}, night: 0 };
    grid[key].count += 1;
    grid[key].sev += toNumber(r.severity);
    grid[key].types[r.crime_type] = (grid[key].types[r.crime_type] || 0) + 1;
    if (toNumber(r.incident_hour) >= 22 || toNumber(r.incident_hour) <= 4) grid[key].night += 1;
  });

  return Object.values(grid)
    .filter(h => h.count >= 2)
    .map(h => ({
      lat: +h.lat.toFixed(5),
      lng: +h.lng.toFixed(5),
      count: h.count,
      avg_severity: +(h.sev / h.count).toFixed(1),
      dominant_crime: Object.entries(h.types).sort((a, b) => b[1] - a[1])[0]?.[0],
      night_ratio: +(h.night / h.count).toFixed(2),
      intensity: +Math.min(1, h.count / 20).toFixed(2),
    }))
    .sort((a, b) => b.count - a.count);
}

function getNetwork(limit = 120) {
  const nodes = offenders
    .slice()
    .sort((a, b) => toNumber(b.prior_convictions) - toNumber(a.prior_convictions) || toNumber(b.risk_score) - toNumber(a.risk_score))
    .slice(0, Math.min(toNumber(limit) || 120, 300))
    .map(o => ({
      id: String(o.offender_id),
      label: o.name,
      alias: o.alias,
      group: o.gang_affiliation || 'None',
      prior: toNumber(o.prior_convictions),
      risk: toNumber(o.risk_score),
      status: o.status,
      age: toNumber(o.age),
    }));

  const ids = new Set(nodes.map(n => n.id));
  const edges = associations
    .filter(e => ids.has(String(e.offender_id_a)) && ids.has(String(e.offender_id_b)))
    .slice(0, 600)
    .map(e => ({
      source: String(e.offender_id_a),
      target: String(e.offender_id_b),
      from: String(e.offender_id_a),
      to: String(e.offender_id_b),
      type: e.relationship_type,
      weight: toNumber(e.strength),
    }));

  return { nodes, edges };
}

function getTrends(params = {}) {
  return monthlyStats
    .filter(r => !params.district || r.district === params.district)
    .filter(r => !params.crime_type || r.crime_type === params.crime_type)
    .map(r => ({
      ...r,
      year: toNumber(r.incident_year ?? r.year),
      month: toNumber(r.incident_month ?? r.month),
      incident_count: toNumber(r.incident_count),
      solved_count: toNumber(r.solved_count),
      total_property_loss_inr: toNumber(r.total_property_loss_inr),
      solve_rate: toNumber(r.solve_rate),
    }))
    .sort((a, b) => a.year - b.year || a.month - b.month || a.crime_type.localeCompare(b.crime_type));
}

function getAlerts() {
  const recent = crimes.filter(c => toNumber(c.incident_year) === 2025);
  const current = Object.entries(groupBy(recent, c => `${c.district}|${c.crime_type}`))
    .map(([key, items]) => {
      const [district, crime_type] = key.split('|');
      return { district, crime_type, recent_count: items.length };
    });

  const historical = getTrends()
    .filter(r => r.year < 2025)
    .reduce((acc, row) => {
      const key = `${row.district}|${row.crime_type}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row.incident_count);
      return acc;
    }, {});

  return current.map(row => {
    const values = historical[`${row.district}|${row.crime_type}`] || [];
    const avg = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 1;
    const variance = values.length ? values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length : 1;
    const stddev = Math.max(Math.sqrt(variance), 0.5);
    const z = (row.recent_count - avg) / stddev;
    return {
      ...row,
      avg_monthly: +avg.toFixed(1),
      z_score: +z.toFixed(2),
      severity: z > 3 ? 'CRITICAL' : z > 2 ? 'HIGH' : 'MEDIUM',
      pct_above_avg: Math.max(0, Math.round((row.recent_count - avg) / avg * 100)),
    };
  })
    .filter(a => a.z_score > 1.5)
    .sort((a, b) => b.z_score - a.z_score)
    .slice(0, 24);
}

function buildUpdates() {
  const offenderById = new Map(offenders.map(o => [String(o.offender_id), o]));
  const storedUpdates = readActivityUpdates();
  const storedOfficerIds = new Set(storedUpdates.map(u => String(u.meta?.officer_id || '')));
  const officerUpdates = readAddedOfficers()
    .filter(officer => !storedOfficerIds.has(String(officer.officer_id)))
    .map((officer, index) => ({
      id: `local-officer-${officer.officer_id}`,
      type: 'officer',
      tone: 'success',
      title: `Welcome to the team, ${officer.officer_code || officer.initials}`,
      description: `${officer.rank} ${officer.initials} joined ${officer.specialization || 'general investigation'} duty with ${toNumber(officer.current_case_load)} assigned case${toNumber(officer.current_case_load) === 1 ? '' : 's'}.`,
      occurred_at: officer.created_at || new Date(Date.now() - index * 3600000).toISOString(),
      district: districts.find(d => String(d.district_id) === String(officer.district_id))?.name || '',
      subject: officer.officer_code || officer.initials,
      priority: 'Normal',
      meta: {
        station_id: officer.station_id,
        officer_id: officer.officer_id,
        case_load: officer.current_case_load,
      },
    }));

  const repeatCrimeUpdates = crimes
    .slice()
    .sort((a, b) => String(b.incident_date).localeCompare(String(a.incident_date)))
    .flatMap(crime => {
      const repeatOffender = parseIdList(crime.offender_ids)
        .map(id => offenderById.get(String(id)))
        .find(o => o && toNumber(o.prior_convictions) > 0 && !['Convicted', 'Juvenile'].includes(o.status));
      if (!repeatOffender) return [];
      return [{
        id: `repeat-crime-${crime.crime_id}-${repeatOffender.offender_id}`,
        type: 'crime',
        tone: toNumber(crime.severity) >= 5 ? 'danger' : 'warning',
        title: `Repeat-offender activity detected`,
        description: `${repeatOffender.alias || repeatOffender.name} is linked to a new ${crime.crime_type.toLowerCase()} case in ${crime.district}. Current offender status: ${repeatOffender.status}.`,
        occurred_at: `${crime.incident_date}T${crime.incident_time || '09:00:00'}`,
        district: crime.district,
        subject: repeatOffender.alias || repeatOffender.name,
        priority: toNumber(crime.severity) >= 5 ? 'High' : 'Watch',
        meta: {
          crime_id: crime.crime_id,
          fir_number: crime.fir_number,
          offender_id: repeatOffender.offender_id,
          prior_convictions: repeatOffender.prior_convictions,
        },
      }];
    })
    .slice(0, 24);

  const offenderRegistryUpdates = offenders
    .slice()
    .sort((a, b) => toNumber(b.offender_id) - toNumber(a.offender_id))
    .slice(0, 8)
    .map((offender, index) => ({
      id: `offender-registry-${offender.offender_id}`,
      type: 'offender',
      tone: toNumber(offender.risk_score) >= 0.75 ? 'danger' : 'info',
      title: 'Offender profile added to registry',
      description: `${offender.alias || offender.name} was added with ${toNumber(offender.prior_convictions)} prior conviction${toNumber(offender.prior_convictions) === 1 ? '' : 's'} and ${offender.status} status.`,
      occurred_at: new Date(Date.now() - (index + 8) * 7200000).toISOString(),
      district: offender.district_of_origin,
      subject: offender.alias || offender.name,
      priority: toNumber(offender.risk_score) >= 0.75 ? 'High' : 'Normal',
      meta: {
        offender_id: offender.offender_id,
        risk_score: offender.risk_score,
        gang_affiliation: offender.gang_affiliation,
      },
    }));

  return [...storedUpdates, ...officerUpdates, ...repeatCrimeUpdates, ...offenderRegistryUpdates]
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
    .slice(0, 60);
}

function getRiskScores(year = 2024) {
  return getDistricts(year)
    .map(d => {
      const crimeRate = toNumber(d.crime_rate_per_100k);
      const seiRisk = 1 - toNumber(d.socio_economic_index);
      const unemp = toNumber(d.unemployment_rate);
      const avgSev = toNumber(d.avg_severity);
      const unsolvedRate = d.total_crimes ? 1 - toNumber(d.solve_rate) : 0;
      const risk = (
        Math.min(crimeRate / 500, 1) * 35 +
        seiRisk * 20 +
        unemp * 15 +
        (avgSev / 5) * 15 +
        unsolvedRate * 15
      );
      return {
        district: d.name,
        risk_score: +Math.min(risk, 100).toFixed(1),
        crime_rate_100k: +crimeRate.toFixed(1),
        avg_severity: +avgSev.toFixed(2),
        unsolved_rate: +unsolvedRate.toFixed(3),
        risk_band: risk >= 60 ? 'HIGH' : risk >= 35 ? 'MEDIUM' : 'LOW',
      };
    })
    .sort((a, b) => b.risk_score - a.risk_score);
}

function getHotzonePredictions() {
  const grouped = groupBy(getTrends(), r => `${r.district}|${r.crime_type}`);
  return Object.entries(grouped).flatMap(([key, rows]) => {
    const values = rows.sort((a, b) => a.year - b.year || a.month - b.month).map(r => r.incident_count);
    if (values.length < 6) return [];
    const recentAvg = values.slice(-3).reduce((sum, v) => sum + v, 0) / 3;
    const earlier = values.slice(-9, -3);
    const priorAvg = earlier.reduce((sum, v) => sum + v, 0) / Math.max(earlier.length, 1);
    const trend = priorAvg ? (recentAvg - priorAvg) / priorAvg * 100 : 0;
    if (trend <= 10) return [];
    const [district, crime_type] = key.split('|');
    return [{
      district,
      crime_type,
      predicted_next_month: Math.max(0, Math.round(recentAvg * (1 + trend / 100))),
      trend_pct_per_month: +trend.toFixed(1),
      recent_avg: +recentAvg.toFixed(1),
      alert_level: trend > 30 ? 'HIGH' : 'MEDIUM',
    }];
  })
    .sort((a, b) => b.trend_pct_per_month - a.trend_pct_per_month)
    .slice(0, 30);
}

function getCorrelations() {
  return {
    correlations: [
      { factor: 'socio_economic_index', corr_with_crime_count: -0.42, corr_with_avg_severity: -0.31 },
      { factor: 'urbanization_index', corr_with_crime_count: 0.58, corr_with_avg_severity: 0.12 },
      { factor: 'unemployment_rate', corr_with_crime_count: 0.37, corr_with_avg_severity: 0.44 },
      { factor: 'literacy_rate', corr_with_crime_count: -0.18, corr_with_avg_severity: -0.22 },
    ],
    scatter_data: getDistricts(2024).map(d => ({
      district: d.name,
      socio_economic: toNumber(d.socio_economic_index),
      urbanization: toNumber(d.urbanization_index),
      unemployment: toNumber(d.unemployment_rate),
      literacy: toNumber(d.literacy_rate),
      total_crimes: toNumber(d.total_crimes),
      avg_severity: toNumber(d.avg_severity),
    })),
  };
}

function getAnomalies() {
  return getAlerts().map(a => ({
    district: a.district,
    crime_type: a.crime_type,
    year: 2025,
    month: 12,
    count: a.recent_count,
    mean: a.avg_monthly,
    z_score: a.z_score,
    direction: 'SPIKE',
    magnitude: a.z_score > 3 ? 'EXTREME' : a.z_score > 2.5 ? 'HIGH' : 'MODERATE',
  }));
}

function getRecidivism() {
  const repeat = offenders
    .filter(o => toNumber(o.prior_convictions) > 0)
    .sort((a, b) => toNumber(b.prior_convictions) - toNumber(a.prior_convictions));
  const bins = { '1': 0, '2-3': 0, '4-5': 0, '6+': 0 };
  const gang_breakdown = {};
  repeat.forEach(o => {
    const p = toNumber(o.prior_convictions);
    if (p === 1) bins['1'] += 1;
    else if (p <= 3) bins['2-3'] += 1;
    else if (p <= 5) bins['4-5'] += 1;
    else bins['6+'] += 1;
    const gang = o.gang_affiliation || 'None';
    gang_breakdown[gang] = (gang_breakdown[gang] || 0) + 1;
  });
  return {
    top_repeat_offenders: repeat.slice(0, 20),
    conviction_distribution: bins,
    gang_breakdown,
    total_repeat_offenders: repeat.length,
  };
}

function search(q) {
  const term = q.toLowerCase();
  return {
    crimes: crimes
      .filter(c => matches(c.fir_number, term) || matches(c.crime_type, term) || matches(c.modus_operandi, term) || matches(c.district, term))
      .slice(0, 20),
    offenders: offenders
      .filter(o => matches(o.name, term) || matches(o.alias, term) || matches(o.gang_affiliation, term))
      .slice(0, 20),
  };
}

function buildMockFirExtraction(file, options = {}) {
  const fileName = file?.name || 'sample-fir.pdf';
  const language = options.language || 'auto';
  const station = policeStations.find(s => s.name === 'Whitefield PS') || policeStations[0];
  const allOfficers = getOfficers();
  const recommendedOfficer = allOfficers
    .filter(o => String(o.station_id) === String(station?.station_id))
    .sort((a, b) => toNumber(a.current_case_load) - toNumber(b.current_case_load))[0] || allOfficers[0];
  const ocrText = [
    'Karnataka State Police / Karnataka Rajya Police',
    'First Information Report',
    'FIR No: FIR/2025/003/2197',
    'Police Station: Whitefield PS',
    'District: Bengaluru Urban',
    'Date of occurrence: 18-06-2025',
    'Time of occurrence: 21:35',
    'Place of occurrence: ITPL Main Road near bus stop, Whitefield',
    'Complainant: Priya Kumar, age 32',
    'Accused/Suspect: Unknown male persons, two wheeler KA-03-HJ-4421',
    'Offence: Chain snatching and assault',
    'Sections: BNS 304, BNS 115, BNS 3(5)',
    'Property loss: Gold chain approximately INR 85,000',
    'Narrative: Complainant stated that two persons on a motorcycle approached from behind, snatched her chain, pushed her to the ground and fled towards Marathahalli.',
    'Kannada note: ದೂರುದಾರರು ಇಬ್ಬರು ಅಪರಿಚಿತರು ಸರ ಕಿತ್ತುಕೊಂಡು ಪರಾರಿಯಾದರು ಎಂದು ತಿಳಿಸಿದ್ದಾರೆ.',
  ].join('\n');

  return {
    document: {
      file_name: fileName,
      file_type: file?.type || 'application/pdf',
      file_size_bytes: file?.size || 0,
      accepted_by_catalyst_ocr: true,
    },
    ocr: {
      provider: 'mock-zia-ocr',
      model_type: 'OCR',
      requested_language: language,
      detected_languages: language === 'auto' ? ['eng', 'kan'] : language.split(',').map(v => v.trim()).filter(Boolean),
      confidence: 87.4,
      text: ocrText,
    },
    extracted: {
      fir_number: 'FIR/2025/003/2197',
      police_station: 'Whitefield PS',
      district: 'Bengaluru Urban',
      district_id: 1,
      station_id: station?.station_id,
      incident_date: '2025-06-18',
      incident_time: '21:35',
      reported_date: '2025-06-19',
      crime_type: 'Robbery',
      crime_type_id: 7,
      legal_sections: ['BNS 304', 'BNS 115', 'BNS 3(5)'],
      location: 'ITPL Main Road near bus stop, Whitefield',
      complainant: 'Priya Kumar',
      victims: [{ name: 'Priya Kumar', age: 32, gender: 'Female', role: 'Complainant/Victim' }],
      accused: [{ name: 'Unknown male persons', vehicle: 'KA-03-HJ-4421', role: 'Suspect' }],
      property_loss_inr: 85000,
      weapons_used: 'None reported',
      modus_operandi: 'Chain snatching by two-wheeler',
      narrative_summary_english: 'Two unidentified suspects on a motorcycle snatched a gold chain from the complainant near ITPL Main Road and fled towards Marathahalli.',
      source_language: language === 'auto' ? 'English + Kannada' : language,
      confidence: {
        fir_number: 0.95,
        station: 0.91,
        date_time: 0.88,
        people: 0.76,
        legal_sections: 0.82,
        property_loss: 0.84,
      },
      recommended_assignment: recommendedOfficer ? {
        officer_id: recommendedOfficer.officer_id,
        officer_code: recommendedOfficer.officer_code,
        initials: recommendedOfficer.initials,
        rank: recommendedOfficer.rank,
        station_id: recommendedOfficer.station_id,
        specialization: recommendedOfficer.specialization,
        shift: recommendedOfficer.shift,
        current_case_load: recommendedOfficer.current_case_load,
      } : null,
    },
    warnings: [
      'Accused names are not present in the FIR text.',
      'Vehicle number should be verified manually from original scan.',
      'Legal section extraction is provisional until officer review.',
    ],
    audit: {
      mode: 'local-mock',
      saved_to_datastore: false,
      requires_human_review: true,
    },
  };
}

function buildFirTablePayloads(extracted = {}) {
  const sections = extracted.legal_sections || [];
  return {
    CaseMaster: {
      CrimeNo: extracted.fir_number || '',
      CrimeRegisteredDate: extracted.reported_date || extracted.incident_date || '',
      PoliceStationID: extracted.station_id || '',
      CrimeMajorHeadID: extracted.crime_type_id || '',
      IncidentFromDate: `${extracted.incident_date || ''} ${extracted.incident_time || ''}`.trim(),
      BriefFacts: extracted.narrative_summary_english || '',
    },
    ComplainantDetails: {
      ComplainantName: extracted.complainant || '',
      CaseMasterID: 'draft-after-case-save',
    },
    Victim: (extracted.victims || []).map(v => ({
      VictimName: v.name || '',
      AgeYear: v.age || '',
      GenderID: v.gender || '',
      CaseMasterID: 'draft-after-case-save',
    })),
    Accused: (extracted.accused || []).map(a => ({
      AccusedName: a.name || '',
      PersonID: a.vehicle || '',
      CaseMasterID: 'draft-after-case-save',
    })),
    ActSectionAssociation: sections.map(section => ({
      ActID: section.split(' ')[0] || '',
      SectionID: section.replace(/^(BNS|IPC)\s*/i, ''),
      CaseMasterID: 'draft-after-case-save',
    })),
  };
}

function buildMockFirAssistant(payload = {}) {
  const extracted = payload.extracted || payload.result?.extracted || {};
  const tablePayloads = buildFirTablePayloads(extracted);
  return {
    provider: 'mock-convokraft-assistant',
    mode: 'demo-table-mapping',
    message: 'I reviewed the OCR fields and prepared draft table mappings for officer approval.',
    recommendations: [
      `Use ${extracted.fir_number || 'the detected FIR number'} as the CaseMaster CrimeNo.`,
      `Map ${extracted.police_station || 'the detected station'} to PoliceStationID before final Data Store insertion.`,
      `Keep legal sections in ActSectionAssociation until a supervisor validates the exact BNS/IPC clauses.`,
      'Save this as a reviewed FIRIntakeDrafts row first, then promote to normalized FIR tables after approval.',
    ],
    table_payloads: tablePayloads,
    confidence_notes: [
      'FIR number and station are high-confidence fields.',
      'Accused identity remains provisional because OCR text contains unknown suspects.',
      'The assistant is intentionally draft-first to avoid overwriting official records.',
    ],
  };
}

function mockSaveFirDraft(payload = {}) {
  const now = new Date().toISOString();
  const row = {
    ROWID: `local-${Date.now()}`,
    ReviewStatus: 'Reviewed',
    CreatedAt: now,
    FIRNumber: payload.extracted?.fir_number || '',
    SourceFile: payload.document?.file_name || '',
    saved_to_datastore: false,
    mode: 'local-demo',
  };
  return {
    saved: true,
    datastore: false,
    row,
    message: 'Reviewed locally. Configure the Catalyst FIR function to persist this row in Data Store.',
  };
}

export const mockApi = {
  summary: year => wait(buildSummary(year)),
  crimes: filters => wait(listCrimes(filters)),
  crime: id => wait(crimes.find(c => String(c.crime_id) === String(id))),
  districts: year => wait(getDistricts(year)),
  hotspots: params => wait(getHotspots(params)),
  network: limit => wait(getNetwork(limit)),
  trends: params => wait(getTrends(params)),
  alerts: () => wait(getAlerts()),
  updates: () => wait(buildUpdates()),
  offender: id => wait(offenders.find(o => String(o.offender_id) === String(id))),
  officers: params => wait(getOfficers().filter(o => !params?.station_id || String(o.station_id) === String(params.station_id))),
  search: q => wait(search(q)),
  stations: district_id => wait(district_id
    ? policeStations.filter(s => String(s.district_id) === String(district_id))
    : policeStations),
  riskScores: year => wait(getRiskScores(year)),
  hotzonePred: () => wait(getHotzonePredictions()),
  correlations: () => wait(getCorrelations()),
  anomalies: () => wait(getAnomalies()),
  moProfile: params => wait(Object.values(listCrimes(params).reduce((acc, c) => {
    const key = `${c.modus_operandi}|${c.crime_type}`;
    if (!acc[key]) acc[key] = { modus_operandi: c.modus_operandi, crime_type: c.crime_type, count: 0, avg_sev: 0, solved: 0, total_loss: 0 };
    acc[key].count += 1;
    acc[key].avg_sev += toNumber(c.severity);
    acc[key].solved += toNumber(c.solved);
    acc[key].total_loss += toNumber(c.property_loss_inr);
    return acc;
  }, {})).map(row => ({ ...row, avg_sev: row.count ? row.avg_sev / row.count : 0 }))),
  recidivism: () => wait(getRecidivism()),
  processFirDocument: (file, options) => wait(buildMockFirExtraction(file, options)),
  assistFirDraft: payload => wait(buildMockFirAssistant(payload)),
  saveFirDraft: payload => wait(mockSaveFirDraft(payload)),
  listDataTables: () => wait(Object.keys(baseTables).sort().map(name => ({
    name,
    file_name: `${name}.csv`,
    row_count: getTableRows(name).length,
    column_count: Object.keys(getTableRows(name)[0] || {}).length,
  }))),
  getDataTable: table => wait({
    name: table,
    file_name: `${table}.csv`,
    rows: getTableRows(table),
    columns: Object.keys(getTableRows(table)[0] || {}),
  }),
  addOfficer: officer => {
    const allOfficers = getOfficers();
    const nextId = Math.max(...allOfficers.map(o => toNumber(o.officer_id)), 0) + 1;
    const assignedCrimeIds = Array.isArray(officer.assigned_crime_ids) ? officer.assigned_crime_ids : [];
    const station = policeStations.find(s => String(s.station_id) === String(officer.station_id));
    const crimeType = crimeTypes.find(t => String(t.crime_type_id) === String(officer.specialization_crime_type_id));
    const initials = String(officer.initials || '').trim().toUpperCase();
    const row = {
      officer_id: nextId,
      officer_code: officer.officer_code || `OFF-${initials || nextId}`,
      initials: initials || `X${nextId}`,
      rank: officer.rank,
      badge_number: officer.badge_number || `KSP-${String(nextId).padStart(3, '0')}`,
      station_id: toNumber(officer.station_id),
      district_id: toNumber(officer.district_id || station?.district_id),
      specialization_crime_type_id: toNumber(officer.specialization_crime_type_id),
      specialization: crimeType?.crime_type || officer.specialization || '',
      shift: officer.shift,
      status: officer.status || 'Active',
      current_case_load: assignedCrimeIds.length,
      years_of_service: toNumber(officer.years_of_service),
    };
    const existingAssignments = [...crimeOfficers, ...readAddedCrimeOfficers()];
    const nextAssignmentId = Math.max(...existingAssignments.map(a => toNumber(a.crime_officer_id)), 0) + 1;
    const newAssignments = assignedCrimeIds.map((crimeId, index) => {
      const crime = crimes.find(c => String(c.crime_id) === String(crimeId));
      return {
        crime_officer_id: nextAssignmentId + index,
        crime_id: toNumber(crimeId),
        officer_id: nextId,
        role: 'Investigating Officer',
        assigned_date: new Date().toISOString().slice(0, 10),
        assignment_status: crime?.status?.startsWith('Closed') ? 'Closed' : 'Active',
      };
    });
    writeAddedOfficers([...readAddedOfficers(), row]);
    writeAddedCrimeOfficers([...readAddedCrimeOfficers(), ...newAssignments]);
    writeActivityUpdates([
      {
        id: `activity-officer-${nextId}-${Date.now()}`,
        type: 'officer',
        tone: 'success',
        title: `Welcome to the team, ${row.officer_code}`,
        description: `${row.rank} ${row.initials} joined ${row.specialization || 'general investigation'} duty at station ${row.station_id}.`,
        occurred_at: new Date().toISOString(),
        district: districts.find(d => String(d.district_id) === String(row.district_id))?.name || '',
        subject: row.officer_code,
        priority: 'Normal',
        meta: {
          officer_id: row.officer_id,
          station_id: row.station_id,
          case_load: row.current_case_load,
        },
      },
      ...readActivityUpdates(),
    ].slice(0, 40));
    return wait(row);
  },
};
