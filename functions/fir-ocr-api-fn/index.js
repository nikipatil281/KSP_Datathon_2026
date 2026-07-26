/**
 * FIR OCR Intake API
 * Catalyst Advanced I/O Function
 *
 * Route:
 *   POST /ocr - Accepts multipart form data with:
 *     image: PDF/image file for Zia OCR
 *     language: optional comma-separated OCR language codes, e.g. eng,kan
 *   POST /assist - Reviews OCR output and returns FIR table mappings
 *   POST /commit - Inserts the reviewed OCR record into FIR Data Store tables
 */

const fs = require('fs');
const catalyst = require('zcatalyst-sdk-node');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

function body(req) {
  return req.body || {};
}

async function zcql(app, sql) {
  return (await app.datastore().executeQuery(sql)) || [];
}

async function nextId(app, table, column) {
  const rows = await zcql(app, `SELECT MAX(${column}) AS max_id FROM ${table}`);
  return Number(rows?.[0]?.max_id || 0) + 1;
}

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function asDateTime(dateValue, timeValue) {
  const date = asDate(dateValue);
  if (!date) return null;
  return `${date} ${timeValue || '00:00'}:00`.replace(/:00:00$/, ':00');
}

function getUploadedFile(req) {
  const file = req.files?.image || req.files?.file || req.file || req.body?.image;
  if (Array.isArray(file)) return file[0];
  return file;
}

function getFilePath(file) {
  return file?.path || file?.filepath || file?.tempFilePath;
}

function getFileName(file) {
  return file?.name || file?.originalFilename || file?.originalname || 'fir-document.pdf';
}

function getField(req, name) {
  const value = req.body?.[name] || req.query?.[name];
  return Array.isArray(value) ? value[0] : value;
}

async function runCatalystOcr(req, file, language) {
  const filePath = getFilePath(file);
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('No uploaded file was found in the request. Expected multipart field "image".');
  }

  const app = catalyst.initialize(req);
  const options = { modelType: 'OCR' };
  if (language && language !== 'auto') options.language = language;
  return app.zia().extractOpticalCharacters(fs.createReadStream(filePath), options);
}

function extractFirFields(ocrData, file) {
  const text = ocrData.text || '';
  const pick = (pattern) => text.match(pattern)?.[1]?.trim() || '';
  const sections = text.match(/\b(?:BNS|IPC)\s*\d+(?:\(\d+\))?/gi) || [];
  const loss = text.match(/(?:INR|Rs\.?|₹)\s*([0-9,]+)/i)?.[1]?.replace(/,/g, '');
  const complainant = pick(/Complainant\s*[:\-]\s*([^,\n]+)/i);
  const accused = pick(/(?:Accused|Suspect|Accused\/Suspect)\s*[:\-]\s*([^\n]+)/i);

  return {
    document: {
      file_name: getFileName(file),
      accepted_by_catalyst_ocr: true,
    },
    ocr: {
      provider: 'zia-ocr',
      model_type: 'OCR',
      confidence: ocrData.confidence,
      text,
    },
    extracted: {
      fir_number: pick(/FIR\s*(?:No\.?|Number)?\s*[:\-]\s*([^\n]+)/i),
      police_station: pick(/Police Station\s*[:\-]\s*([^\n]+)/i),
      district: pick(/District\s*[:\-]\s*([^\n]+)/i),
      incident_date: pick(/(?:Date of occurrence|Incident Date)\s*[:\-]\s*([^\n]+)/i),
      incident_time: pick(/(?:Time of occurrence|Incident Time)\s*[:\-]\s*([^\n]+)/i),
      crime_type: pick(/(?:Offence|Crime Type)\s*[:\-]\s*([^\n]+)/i),
      legal_sections: [...new Set(sections)],
      location: pick(/(?:Place of occurrence|Location)\s*[:\-]\s*([^\n]+)/i),
      complainant,
      victims: complainant ? [{ name: complainant, role: 'Complainant/Victim' }] : [],
      accused: accused ? [{ name: accused, role: 'Suspect' }] : [],
      property_loss_inr: loss ? Number(loss) : null,
      narrative_summary_english: text.split('\n').filter(Boolean).slice(-3).join(' '),
      confidence: {
        fir_number: 0.7,
        station: 0.7,
        date_time: 0.65,
        legal_sections: sections.length ? 0.75 : 0.25,
      },
    },
    warnings: [
      'Fields are OCR-derived and require officer verification before saving.',
    ],
    audit: {
      mode: 'catalyst-zia-ocr',
      saved_to_datastore: false,
      requires_human_review: true,
    },
  };
}

function buildTablePayloads(extracted = {}) {
  const sections = extracted.legal_sections || [];
  return {
    CaseMaster: {
      CrimeNo: extracted.fir_number || '',
      CrimeRegisteredDate: extracted.reported_date || extracted.incident_date || '',
      PoliceStationID: extracted.station_id || '',
      CrimeMajorHeadID: extracted.crime_type_id || '',
      IncidentFromDate: `${extracted.incident_date || ''} ${extracted.incident_time || ''}`.trim(),
      latitude: extracted.latitude || '',
      longitude: extracted.longitude || '',
      BriefFacts: extracted.narrative_summary_english || '',
    },
    ComplainantDetails: {
      CaseMasterID: 'draft-after-case-save',
      ComplainantName: extracted.complainant || '',
    },
    Victim: (extracted.victims || []).map(v => ({
      CaseMasterID: 'draft-after-case-save',
      VictimName: v.name || '',
      AgeYear: v.age || '',
      GenderID: v.gender || '',
    })),
    Accused: (extracted.accused || []).map(a => ({
      CaseMasterID: 'draft-after-case-save',
      AccusedName: a.name || '',
      PersonID: a.vehicle || '',
    })),
    ActSectionAssociation: sections.map(section => ({
      CaseMasterID: 'draft-after-case-save',
      ActID: String(section).split(' ')[0] || '',
      SectionID: String(section).replace(/^(BNS|IPC)\s*/i, ''),
    })),
  };
}

function buildAssistant(payload = {}) {
  const extracted = payload.extracted || payload.result?.extracted || {};
  const question = payload.message || 'Map this OCR output into FIR database tables.';
  const tablePayloads = buildTablePayloads(extracted);
  return {
    provider: 'catalyst-convokraft-ready-assistant',
    mode: 'ocr-to-fir-table-mapping',
    question,
    message: 'I reviewed the OCR output and prepared draft table mappings for officer approval.',
    recommendations: [
      `Use ${extracted.fir_number || 'the detected FIR number'} as the CaseMaster CrimeNo.`,
      `Map ${extracted.police_station || 'the detected station'} to PoliceStationID before final table insertion.`,
      `Route legal sections to ActSectionAssociation after validating the exact BNS/IPC clauses.`,
      'Use these mappings as review guidance for the officer before any official case entry.',
    ],
    table_payloads: tablePayloads,
    confidence_notes: [
      'This assistant uses OCR text plus extracted fields to prepare a reviewable draft.',
      'Fields with unknown suspects or ambiguous legal clauses should stay provisional.',
      'The draft-first pattern protects official FIR tables from unverified OCR errors.',
    ],
  };
}

async function commitFirRecord(req, payload = {}) {
  const app = catalyst.initialize(req);
  const extracted = payload.extracted || {};
  const caseMasterId = await nextId(app, 'CaseMaster', 'CaseMasterID');
  const complainantId = await nextId(app, 'ComplainantDetails', 'ComplainantID');
  const victimId = await nextId(app, 'Victim', 'VictimMasterID');
  const accusedId = await nextId(app, 'Accused', 'AccusedMasterID');
  const occuranceTimeId = await nextId(app, 'Inv_OccuranceTime', 'OccuranceTimeID');

  const caseRow = {
    CaseMasterID: caseMasterId,
    CrimeNo: extracted.fir_number || `OCR-${Date.now()}`,
    CaseNo: extracted.fir_number || `OCR-${Date.now()}`,
    CrimeRegisteredDate: asDate(extracted.reported_date || extracted.incident_date),
    PolicePersonID: Number(extracted.police_person_id || 0),
    PoliceStationID: Number(extracted.station_id || 0),
    CaseCategoryID: Number(extracted.case_category_id || 1),
    GravityOffenceID: Number(extracted.gravity_offence_id || 0),
    CrimeMajorHeadID: Number(extracted.crime_type_id || extracted.crime_major_head_id || 0),
    CrimeMinorHeadID: Number(extracted.crime_minor_head_id || 0),
    CaseStatusID: Number(extracted.case_status_id || 1),
    CourtID: Number(extracted.court_id || 0),
    IncidentFromDate: asDateTime(extracted.incident_date, extracted.incident_time),
    IncidentToDate: asDateTime(extracted.incident_date, extracted.incident_time),
    InfoReceivedPSDate: asDateTime(extracted.reported_date || extracted.incident_date, extracted.incident_time),
    latitude: Number(extracted.latitude || 0),
    longitude: Number(extracted.longitude || 0),
    BriefFacts: extracted.narrative_summary_english || payload.ocr?.text || '',
  };

  const inserted = {};
  inserted.CaseMaster = await app.datastore().table('CaseMaster').insertRow(caseRow);

  if (extracted.complainant) {
    inserted.ComplainantDetails = await app.datastore().table('ComplainantDetails').insertRow({
      ComplainantID: complainantId,
      CaseMasterID: caseMasterId,
      ComplainantName: extracted.complainant,
      AgeYear: Number(extracted.complainant_age || 0),
      OccupationID: Number(extracted.occupation_id || 0),
      ReligionID: Number(extracted.religion_id || 0),
      CasteID: Number(extracted.caste_id || 0),
      GenderID: Number(extracted.gender_id || 0),
    });
  }

  const victimRows = (extracted.victims || []).map((victim, index) => ({
    VictimMasterID: victimId + index,
    CaseMasterID: caseMasterId,
    VictimName: victim.name || victim.VictimName || 'Unknown victim',
    AgeYear: Number(victim.age || victim.AgeYear || 0),
    GenderID: Number(victim.gender_id || 0),
    VictimPolice: Boolean(victim.VictimPolice || false),
  }));
  if (victimRows.length) inserted.Victim = await app.datastore().table('Victim').insertRows(victimRows);

  const accusedRows = (extracted.accused || []).map((accusedItem, index) => ({
    AccusedMasterID: accusedId + index,
    CaseMasterID: caseMasterId,
    AccusedName: accusedItem.name || accusedItem.AccusedName || 'Unknown accused',
    AgeYear: Number(accusedItem.age || accusedItem.AgeYear || 0),
    GenderID: Number(accusedItem.gender_id || 0),
    PersonID: accusedItem.vehicle || accusedItem.PersonID || '',
  }));
  if (accusedRows.length) inserted.Accused = await app.datastore().table('Accused').insertRows(accusedRows);

  const sectionRows = (extracted.legal_sections || []).map((section, index) => ({
    CaseMasterID: caseMasterId,
    ActID: String(section).split(' ')[0] || '',
    SectionID: String(section).replace(/^(BNS|IPC)\s*/i, ''),
    ActOrderID: index + 1,
    SectionOrderID: index + 1,
  }));
  if (sectionRows.length) inserted.ActSectionAssociation = await app.datastore().table('ActSectionAssociation').insertRows(sectionRows);

  if (extracted.location || extracted.incident_date) {
    inserted.Inv_OccuranceTime = await app.datastore().table('Inv_OccuranceTime').insertRow({
      OccuranceTimeID: occuranceTimeId,
      CaseMasterID: caseMasterId,
      FromDate: asDateTime(extracted.incident_date, extracted.incident_time),
      ToDate: asDateTime(extracted.incident_date, extracted.incident_time),
      PlaceOfOccurance: extracted.location || '',
      latitude: Number(extracted.latitude || 0),
      longitude: Number(extracted.longitude || 0),
    });
  }

  return {
    committed: true,
    case_master_id: caseMasterId,
    inserted_tables: Object.keys(inserted),
    inserted,
    message: 'Added reviewed FIR record to Catalyst Data Store tables.',
  };
}

module.exports = async (context, req, res) => {
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  try {
    const path = req.path || '';

    if (req.method === 'POST' && path === '/ocr') {
      const file = getUploadedFile(req);
      const language = getField(req, 'language') || 'auto';
      const ocrData = await runCatalystOcr(req, file, language);
      return ok(res, extractFirFields(ocrData, file));
    }

    if (req.method === 'POST' && path === '/assist') {
      return ok(res, buildAssistant(body(req)));
    }

    if (req.method === 'POST' && path === '/commit') {
      return ok(res, await commitFirRecord(req, body(req)), 201);
    }

    return fail(res, `Not found: ${req.method} ${path}`, 404);
  } catch (e) {
    console.error('[fir-ocr-api]', e);
    return fail(res, e.message || 'FIR intake processing failed');
  }
};
