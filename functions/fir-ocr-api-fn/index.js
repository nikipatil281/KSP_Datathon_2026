/**
 * FIR OCR Intake API
 * Catalyst Advanced I/O Function
 *
 * Route:
 *   POST /ocr - Accepts multipart form data with:
 *     image: PDF/image file for Zia OCR
 *     language: optional comma-separated OCR language codes, e.g. eng,kan
 *   POST /assist - Reviews OCR output and returns FIR table mappings
 *   POST /drafts - Saves a reviewed FIR draft into Catalyst Data Store
 *
 * Environment variables required for real Catalyst OCR forwarding:
 *   CATALYST_PROJECT_ID
 *   CATALYST_OAUTH_TOKEN
 *   CATALYST_API_DOMAIN=https://api.catalyst.zoho.in
 *   CATALYST_ENVIRONMENT=Development
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

function toJson(value) {
  return JSON.stringify(value || null);
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

async function runCatalystOcr(file, language) {
  const projectId = process.env.CATALYST_PROJECT_ID;
  const token = process.env.CATALYST_OAUTH_TOKEN;
  const apiDomain = process.env.CATALYST_API_DOMAIN || 'https://api.catalyst.zoho.in';
  const environment = process.env.CATALYST_ENVIRONMENT || 'Development';

  if (!projectId || !token) {
    throw new Error('OCR is not configured. Set CATALYST_PROJECT_ID and CATALYST_OAUTH_TOKEN in Catalyst environment variables.');
  }

  const filePath = getFilePath(file);
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('No uploaded file was found in the request. Expected multipart field "image".');
  }

  const bytes = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('image', new Blob([bytes]), getFileName(file));
  if (language && language !== 'auto') form.append('language', language);

  const response = await fetch(`${apiDomain}/baas/v1/project/${projectId}/ml/ocr`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      Environment: environment,
    },
    body: form,
  });

  const json = await response.json();
  if (!response.ok || json.status !== 'success') {
    throw new Error(json.message || json.error || `Catalyst OCR failed with ${response.status}`);
  }

  return json.data;
}

function extractFirFields(ocrData, file) {
  const text = ocrData.text || '';
  const pick = (pattern) => text.match(pattern)?.[1]?.trim() || '';
  const sections = text.match(/\b(?:BNS|IPC)\s*\d+(?:\(\d+\))?/gi) || [];
  const loss = text.match(/(?:INR|Rs\.?|₹)\s*([0-9,]+)/i)?.[1]?.replace(/,/g, '');

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
      'Save the reviewed output into FIRIntakeDrafts first, then promote to normalized FIR tables after approval.',
    ],
    table_payloads: tablePayloads,
    confidence_notes: [
      'This assistant uses OCR text plus extracted fields to prepare a reviewable draft.',
      'Fields with unknown suspects or ambiguous legal clauses should stay provisional.',
      'The draft-first pattern protects official FIR tables from unverified OCR errors.',
    ],
  };
}

async function saveDraft(req, payload = {}) {
  const app = catalyst.initialize(req);
  const extracted = payload.extracted || {};
  const assistant = payload.assistant || buildAssistant(payload);
  const row = {
    FIRNumber: extracted.fir_number || '',
    SourceFile: payload.document?.file_name || '',
    OCRProvider: payload.ocr?.provider || '',
    OCRConfidence: String(payload.ocr?.confidence ?? ''),
    District: extracted.district || '',
    PoliceStation: extracted.police_station || '',
    CrimeType: extracted.crime_type || '',
    IncidentDate: extracted.incident_date || '',
    LegalSections: (extracted.legal_sections || []).join(', '),
    ReviewStatus: 'Reviewed',
    ExtractedJson: toJson(extracted),
    TablePayloadJson: toJson(assistant.table_payloads),
    AssistantNotes: toJson({
      provider: assistant.provider,
      message: assistant.message,
      recommendations: assistant.recommendations,
      confidence_notes: assistant.confidence_notes,
    }),
  };
  const saved = await app.datastore().table('FIRIntakeDrafts').insertRow(row);
  return {
    saved: true,
    datastore: true,
    row: saved,
    message: 'Reviewed FIR draft saved to Catalyst Data Store.',
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
      const ocrData = await runCatalystOcr(file, language);
      return ok(res, extractFirFields(ocrData, file));
    }

    if (req.method === 'POST' && path === '/assist') {
      return ok(res, buildAssistant(body(req)));
    }

    if (req.method === 'POST' && path === '/drafts') {
      return ok(res, await saveDraft(req, body(req)), 201);
    }

    return fail(res, `Not found: ${req.method} ${path}`, 404);
  } catch (e) {
    console.error('[fir-ocr-api]', e);
    return fail(res, e.message || 'FIR intake processing failed');
  }
};
