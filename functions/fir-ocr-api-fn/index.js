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
const os = require('os');
const pathModule = require('path');
const express = require('express');
const multer = require('multer');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

app.use((req, res, next) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  return next();
});

app.use(express.json({ limit: '10mb' }));

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
  return file?.path || file?.filepath || file?.tempFilePath || file?.temp_file_path || file?.filePath;
}

function getFileName(file) {
  return file?.name || file?.originalFilename || file?.originalname || file?.filename || 'fir-document.pdf';
}

function getField(req, name) {
  const value = req.body?.[name] || req.query?.[name];
  return Array.isArray(value) ? value[0] : value;
}

async function runCatalystOcr(req, file, language) {
  let filePath = getFilePath(file);
  if (!filePath && file?.buffer) {
    filePath = pathModule.join(os.tmpdir(), `${Date.now()}-${getFileName(file)}`);
    fs.writeFileSync(filePath, file.buffer);
  }
  if (!filePath && file?.data) {
    filePath = pathModule.join(os.tmpdir(), `${Date.now()}-${getFileName(file)}`);
    const bytes = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data), 'base64');
    fs.writeFileSync(filePath, bytes);
  }
  if (!filePath || !fs.existsSync(filePath)) {
    const debug = {
      hasFiles: Boolean(req.files),
      fileKeys: req.files ? Object.keys(req.files) : [],
      hasBodyImage: Boolean(req.body?.image),
      fileShape: file ? Object.keys(file) : [],
    };
    throw new Error(`No uploaded file was found in the request. Expected multipart field "image". Debug: ${JSON.stringify(debug)}`);
  }

  const app = catalyst.initialize(req);
  const options = { modelType: 'OCR' };
  if (language && language !== 'auto') options.language = language;
  const zia = app.zia();
  if (!zia?.extractOpticalCharacters) {
    throw new Error('Catalyst Zia OCR SDK method extractOpticalCharacters is unavailable in this function runtime.');
  }
  return zia.extractOpticalCharacters(fs.createReadStream(filePath), options);
}

function extractFirFields(ocrData, file) {
  const text = ocrData.text || '';
  const lines = text
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const clean = (value = '') => String(value)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bFileID=\S+/gi, '')
    .replace(/\b(?:ViewMode|Typ|Type)s?=\S+/gi, '')
    .replace(/\b\d+\s*(?:of|\/)\s*\d+\b/gi, '')
    .replace(/[|{}[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const pick = (pattern) => clean(text.match(pattern)?.[1] || '');
  const pickInline = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escaped}\\s*[:\\-]?\\s*([^\\n]+)`, 'i');
    return pick(pattern);
  };
  const pickNear = (label) => {
    const labelPattern = new RegExp(label, 'i');
    const sameLine = lines.find(line => labelPattern.test(line));
    if (sameLine) {
      const after = clean(sameLine.replace(labelPattern, '').replace(/^[:\-\s]+/, ''));
      if (after && !/^(date|ps|year|fir|no\.?)\b/i.test(after)) return after;
    }
    const index = lines.findIndex(line => labelPattern.test(line));
    if (index >= 0) {
      const next = clean(lines[index + 1] || '');
      if (next && !/^(date|ps|year|fir|no\.?)\b/i.test(next)) return next;
    }
    return '';
  };
  const pickDate = () => {
    const date = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/)?.[1];
    return date || '';
  };
  const pickSummary = () => {
    const section = text.match(/(?:First information contents|Brief facts|Facts of the case)\s*[:\-]?\s*([\s\S]{40,900}?)(?:\n\s*\d+\s*\.|\n\s*(?:Action taken|Signature|Complainant|Investigating Officer)\b|$)/i)?.[1];
    const candidate = clean(section || '');
    if (!candidate) return '';
    if (/https?:|FileID=|ViewMode|cbi\.gov|^\W*\d+\s*(?:of|\/)\s*\d+\W*$/i.test(candidate)) return '';
    if (candidate.length < 40) return '';
    return candidate.slice(0, 420);
  };
  const sections = text.match(/\b(?:BNS|IPC)\s*\d+(?:\(\d+\))?/gi) || [];
  const loss = text.match(/(?:INR|Rs\.?|₹)\s*([0-9,]+)/i)?.[1]?.replace(/,/g, '');
  const complainant = pick(/Complainant\s*(?:\/\s*Informant)?\s*[\s\S]{0,120}?Name\s*[:\-]?\s*([^\n]+)/i) || pickInline('Complainant');
  const accused = pick(/(?:Accused|Suspect|Accused\/Suspect)\s*[:\-]\s*([^\n]+)/i);
  const firNumber = pick(/FIR\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Z0-9/.-]+)/i);
  const policeStation = pick(/(?:PS|Police Station)\s*[:\-]?\s*([A-Z][A-Z0-9 .\-]{2,60}?)(?=\s+(?:FIR|Date|Year|District|$))/i) || pickNear('Police Station|PS');
  const district = pick(/District\s*[:\-]?\s*([A-Z][A-Za-z .-]{2,45}?)(?=\s+(?:PS|Police Station|Year|FIR|Date|$))/i) || pickNear('District');

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
      fir_number: firNumber,
      police_station: policeStation,
      district,
      incident_date: pick(/(?:Date of occurrence|Incident Date|Date)\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i) || pickDate(),
      incident_time: pick(/(?:Time of occurrence|Incident Time)\s*[:\-]\s*([^\n]+)/i),
      crime_type: pick(/Suspected offences?\s*[:\-]?\s*([^\n]+)/i) || pick(/(?:Offence|Crime Type)\s*[:\-]\s*([^\n]+)/i),
      legal_sections: [...new Set(sections)],
      location: pick(/(?:Place of occurrence|Location)\s*[:\-]\s*([^\n]+)/i),
      complainant,
      victims: complainant ? [{ name: complainant, role: 'Complainant/Victim' }] : [],
      accused: accused ? [{ name: accused, role: 'Suspect' }] : [],
      property_loss_inr: loss ? Number(loss) : null,
      narrative_summary_english: pickSummary(),
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

function sentence(value) {
  return value ? String(value).trim() : 'not detected';
}

function buildPlainEnglishBrief(extracted = {}) {
  const sections = (extracted.legal_sections || []).join(', ') || 'no legal sections detected';
  const place = extracted.location || [extracted.police_station, extracted.district].filter(Boolean).join(', ');
  const parts = [
    `This appears to be FIR ${sentence(extracted.fir_number)} registered at ${sentence(extracted.police_station)} in ${sentence(extracted.district)}.`,
    `The detected offence is ${sentence(extracted.crime_type)}, with sections ${sections}.`,
    `The date found in OCR is ${sentence(extracted.incident_date)}${extracted.incident_time ? ` at ${extracted.incident_time}` : ''}.`,
    `The place or jurisdiction detail is ${sentence(place)}.`,
  ];
  if (extracted.complainant) parts.push(`The complainant/informant detected is ${extracted.complainant}.`);
  if (extracted.narrative_summary_english) parts.push(`Narrative: ${extracted.narrative_summary_english}`);
  parts.push('Low-confidence or missing fields should be checked against the PDF before saving.');
  return parts.join(' ');
}

function detectLanguages(text = '') {
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasKannada = /[\u0C80-\u0CFF]/.test(text);
  const alpha = text.match(/[A-Za-z]/g)?.length || 0;
  const latinWords = text.match(/\b[A-Za-z]{3,}\b/g)?.length || 0;
  return {
    hasDevanagari,
    hasKannada,
    hasEnglish: alpha >= 20 || latinWords >= 5,
  };
}

function answerLanguageQuestion(question, ocrText = '') {
  const normalizedQuestion = question.toLowerCase();
  const lang = detectLanguages(ocrText);
  const asksHindi = /\b(hindi|devanagari)\b/.test(normalizedQuestion);
  const asksKannada = /\b(kannada|kan)\b/.test(normalizedQuestion);
  const asksEnglish = /\b(english|eng)\b/.test(normalizedQuestion);
  if (!asksHindi && !asksKannada && !asksEnglish && !/\blanguage\b/.test(normalizedQuestion)) return null;

  const detected = [
    lang.hasEnglish ? 'English/Latin text' : '',
    lang.hasDevanagari ? 'Hindi/Devanagari text' : '',
    lang.hasKannada ? 'Kannada text' : '',
  ].filter(Boolean);

  if (asksHindi) {
    return lang.hasDevanagari
      ? 'Yes. The OCR output contains Devanagari characters, so there appears to be Hindi text in the FIR.'
      : 'I do not see Hindi/Devanagari characters in the OCR output. This scan appears to be mostly English/Latin text, though OCR can miss faint handwritten or low-resolution Hindi text.';
  }
  if (asksKannada) {
    return lang.hasKannada
      ? 'Yes. The OCR output contains Kannada characters.'
      : 'I do not see Kannada characters in the OCR output. This scan appears to be mostly English/Latin text.';
  }
  if (asksEnglish) {
    return lang.hasEnglish
      ? 'Yes. The OCR output is mostly English/Latin text.'
      : 'I do not see much English/Latin text in the OCR output.';
  }
  return detected.length
    ? `The OCR output appears to contain ${detected.join(', ')}.`
    : 'I could not confidently identify the document language from the OCR output.';
}

function buildAssistant(payload = {}) {
  const extracted = payload.extracted || payload.result?.extracted || {};
  const ocrText = payload.ocr?.text || payload.result?.ocr?.text || '';
  const question = payload.message || 'Map this OCR output into FIR database tables.';
  const normalizedQuestion = question.toLowerCase();
  const tablePayloads = buildTablePayloads(extracted);
  const languageAnswer = answerLanguageQuestion(question, ocrText);
  const wantsSummary = /\b(what|say|summary|summarize|explain|really)\b/.test(normalizedQuestion);
  const wantsTables = /\b(table|database|map|mapping|schema|case ?master|datastore)\b/.test(normalizedQuestion);
  const brief = buildPlainEnglishBrief(extracted);
  const message = languageAnswer || (wantsSummary && !wantsTables
    ? brief
    : `${brief} I also prepared draft table mappings for officer approval.`);
  const showTables = wantsTables || (!languageAnswer && !wantsSummary);
  const recommendations = showTables ? [
    extracted.fir_number
      ? `Use ${extracted.fir_number} as the draft CaseMaster CrimeNo after officer verification.`
      : 'FIR number was not confidently detected; verify it manually from the first page.',
    extracted.police_station
      ? `Resolve ${extracted.police_station} to the correct PoliceStationID before any official insertion.`
      : 'Police station was not confidently detected; do not save until it is selected.',
    (extracted.legal_sections || []).length
      ? `Route ${extracted.legal_sections.join(', ')} to ActSectionAssociation after validating the exact clauses.`
      : 'No legal sections were confidently detected; review the Acts & Sections table in the PDF.',
    'Use Add to Database only after the extracted record has been reviewed.',
  ] : [
    'This answer is based only on the OCR text returned by Catalyst Zia.',
    'If the PDF image visually contains text that OCR missed, rerun OCR with the closest language hint.',
  ];

  return {
    provider: 'catalyst-convokraft-ready-assistant',
    mode: languageAnswer ? 'fir-language-check' : wantsSummary && !wantsTables ? 'fir-plain-language-review' : 'ocr-to-fir-table-mapping',
    question,
    message,
    recommendations,
    table_payloads: showTables ? tablePayloads : null,
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

app.post('/ocr', upload.single('image'), async (req, res) => {
  try {
    const file = getUploadedFile(req);
    const language = getField(req, 'language') || 'auto';
    const ocrData = await runCatalystOcr(req, file, language);
    return ok(res, extractFirFields(ocrData, file));
  } catch (e) {
    console.error('[fir-ocr-api]', e);
    return fail(res, e.stack || e.message || 'FIR intake processing failed');
  }
});

app.post('/assist', (req, res) => ok(res, buildAssistant(body(req))));

app.post('/commit', async (req, res) => {
  try {
    return ok(res, await commitFirRecord(req, body(req)), 201);
  } catch (e) {
    console.error('[fir-ocr-api]', e);
    return fail(res, e.stack || e.message || 'FIR intake processing failed');
  }
});

app.use((req, res) => fail(res, `Not found: ${req.method} ${req.path || ''}`, 404));

module.exports = app;
