import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Bot, CheckCircle, Database, Eye, FileText,
  Languages, Loader2, MessageSquare, Save, ShieldCheck, Upload
} from 'lucide-react';
import { api } from '../api';

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'eng', label: 'English' },
  { value: 'kan', label: 'Kannada' },
  { value: 'hin', label: 'Hindi' },
  { value: 'urd', label: 'Urdu' },
  { value: 'eng,kan', label: 'English + Kannada' },
  { value: 'eng,hin', label: 'English + Hindi' },
];

const STEPS = ['Upload', 'OCR', 'Extract', 'Review'];

function Field({ label, value, confidence }) {
  const pct = confidence ? Math.round(confidence * 100) : null;
  const color = pct >= 85 ? 'text-green-400' : pct >= 70 ? 'text-yellow-400' : 'text-orange-400';
  return (
    <div className="border-b border-slate-800 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">{label}</span>
        {pct !== null && <span className={`text-[11px] font-semibold ${color}`}>{pct}%</span>}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-100 break-words">{value || 'Not detected'}</div>
    </div>
  );
}

function Stepper({ active }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {STEPS.map((step, index) => {
        const done = index < active;
        const current = index === active;
        return (
          <div key={step} className={`rounded-lg border px-3 py-2 text-xs ${
            done ? 'border-green-700 bg-green-950 text-green-300' :
            current ? 'border-blue-600 bg-blue-950 text-blue-300' :
            'border-slate-800 bg-slate-900 text-slate-500'
          }`}>
            <div className="flex items-center gap-2">
              {done ? <CheckCircle size={13} /> : current ? <Loader2 size={13} className="animate-spin" /> : <span className="h-3 w-3 rounded-full border border-current" />}
              {step}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FIRIntake() {
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('auto');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [assistant, setAssistant] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState('Which FIR database tables should this OCR output fill?');

  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleProcess = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setSaved(false);
    setAssistant(null);
    setResult(null);
    setActiveStep(1);
    try {
      window.setTimeout(() => setActiveStep(2), 500);
      const data = await api.processFirDocument(file, { language });
      setResult(data);
      setActiveStep(3);
      await runAssistant(data, 'Review this OCR output and prepare draft FIR table mappings.');
    } catch (e) {
      setError(e.message);
      setActiveStep(0);
    } finally {
      setProcessing(false);
    }
  };

  const runAssistant = async (currentResult = result, message = assistantQuestion) => {
    if (!currentResult) return;
    setAssistantLoading(true);
    setError(null);
    try {
      const data = await api.assistFirDraft({
        message,
        document: currentResult.document,
        ocr: currentResult.ocr,
        extracted: currentResult.extracted,
      });
      setAssistant(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaved(true);
  };

  const extracted = result?.extracted || {};
  const confidence = extracted.confidence || {};
  const assignment = extracted.recommended_assignment;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText size={20} className="text-blue-400" /> FIR Intake Desk
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Upload scanned FIRs, run OCR, extract case fields, and verify before saving.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-green-800 bg-green-950 px-3 py-2 text-xs text-green-300">
          <ShieldCheck size={14} /> Local mock OCR active
        </div>
      </div>

      <Stepper active={activeStep} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Upload size={16} className="text-blue-400" /> Document Upload
            </h2>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900 px-4 py-8 text-center hover:border-blue-500">
              <Upload size={28} className="mb-3 text-slate-400" />
              <span className="text-sm font-medium text-white">Choose FIR PDF or scan</span>
              <span className="mt-1 text-xs text-slate-500">PDF, PNG, JPG, JPEG, BMP, TIFF up to 20 MB</span>
              <input
                className="hidden"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.bmp,.tiff,.webp"
                onChange={e => {
                  setFile(e.target.files?.[0] || null);
                  setResult(null);
                  setSaved(false);
                  setAssistant(null);
                  setActiveStep(e.target.files?.[0] ? 0 : 0);
                }}
              />
            </label>

            {file && (
              <div className="mt-4 rounded-lg bg-slate-900 p-3 text-xs">
                <div className="font-semibold text-white">{file.name}</div>
                <div className="mt-1 text-slate-400">{file.type || 'Unknown type'} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                <Languages size={13} /> OCR language hint
              </label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              >
                {LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>

            <button
              disabled={!file || processing}
              onClick={handleProcess}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
              Run OCR Extraction
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-700 bg-red-950 p-4 text-sm text-red-300 flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {result?.warnings?.length > 0 && (
            <div className="rounded-xl border border-yellow-700 bg-yellow-950 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-yellow-300">
                <AlertTriangle size={15} /> Review Flags
              </h3>
              <div className="space-y-2">
                {result.warnings.map(w => (
                  <div key={w} className="text-xs text-yellow-100">{w}</div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="xl:col-span-1">
          <div className="h-[680px] overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
            <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-200">Document Preview</div>
            {!previewUrl && (
              <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                Upload a document to preview it here.
              </div>
            )}
            {previewUrl && file?.type?.includes('pdf') && (
              <object data={previewUrl} type="application/pdf" className="h-full w-full">
                <div className="p-4 text-sm text-slate-400">PDF preview is unavailable in this browser.</div>
              </object>
            )}
            {previewUrl && !file?.type?.includes('pdf') && (
              <div className="flex h-full items-center justify-center bg-black">
                <img src={previewUrl} alt="Uploaded FIR preview" className="max-h-full max-w-full object-contain" />
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Database size={16} className="text-green-400" /> Extracted Case Record
            </h2>
            {!result && (
              <div className="py-16 text-center text-sm text-slate-500">
                OCR output will appear here after processing.
              </div>
            )}
            {result && (
              <>
                <div className="grid grid-cols-2 gap-x-4">
                  <Field label="FIR Number" value={extracted.fir_number} confidence={confidence.fir_number} />
                  <Field label="Crime Type" value={extracted.crime_type} />
                  <Field label="District" value={extracted.district} />
                  <Field label="Police Station" value={extracted.police_station} confidence={confidence.station} />
                  <Field label="Incident Date" value={extracted.incident_date} confidence={confidence.date_time} />
                  <Field label="Incident Time" value={extracted.incident_time} confidence={confidence.date_time} />
                  <Field label="Property Loss" value={extracted.property_loss_inr ? `INR ${extracted.property_loss_inr.toLocaleString()}` : ''} confidence={confidence.property_loss} />
                  <Field label="Weapons" value={extracted.weapons_used} />
                </div>

                <Field label="Location" value={extracted.location} />
                <Field label="Legal Sections" value={(extracted.legal_sections || []).join(', ')} confidence={confidence.legal_sections} />
                <Field label="Modus Operandi" value={extracted.modus_operandi} />
                <Field label="Summary" value={extracted.narrative_summary_english} />

                {assignment && (
                  <div className="mt-4 rounded-lg border border-blue-800 bg-blue-950 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-300">
                      <ShieldCheck size={14} /> Suggested Assignment
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 text-xs">
                      <div className="py-1">
                        <div className="text-slate-400">Officer</div>
                        <div className="font-semibold text-white">{assignment.officer_code} ({assignment.initials})</div>
                      </div>
                      <div className="py-1">
                        <div className="text-slate-400">Rank</div>
                        <div className="font-semibold text-white">{assignment.rank}</div>
                      </div>
                      <div className="py-1">
                        <div className="text-slate-400">Specialization</div>
                        <div className="font-semibold text-white">{assignment.specialization}</div>
                      </div>
                      <div className="py-1">
                        <div className="text-slate-400">Case Load</div>
                        <div className="font-semibold text-white">{assignment.current_case_load}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleSave}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500"
                  >
                    <Save size={15} /> Mark Reviewed
                  </button>
                  <button className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
                    Edit Fields
                  </button>
                </div>

                {saved && (
                  <div className="mt-3 rounded-lg border border-green-700 bg-green-950 p-3 text-xs text-green-300">
                    Reviewed locally for demo. The assistant mapping is ready for officer validation.
                  </div>
                )}
              </>
            )}
          </div>

          {result && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Bot size={16} className="text-cyan-400" /> FIR Assistant
                </h2>
                <span className="rounded-md border border-cyan-800 bg-cyan-950 px-2 py-1 text-[11px] text-cyan-300">
                  ConvoKraft-ready
                </span>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <MessageSquare size={13} /> Ask the assistant
                </div>
                <textarea
                  value={assistantQuestion}
                  onChange={e => setAssistantQuestion(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                />
                <button
                  onClick={() => runAssistant()}
                  disabled={assistantLoading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-cyan-700 bg-cyan-950 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900 disabled:opacity-50"
                >
                  {assistantLoading ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                  Analyze OCR and Map Tables
                </button>
              </div>

              {!assistant && (
                <div className="mt-3 text-xs text-slate-500">
                  The assistant will review OCR output and prepare draft FIR table mappings.
                </div>
              )}

              {assistant && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-cyan-800 bg-cyan-950 p-3 text-xs text-cyan-100">
                    {assistant.message}
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Recommendations</div>
                    <div className="space-y-2">
                      {(assistant.recommendations || []).map(item => (
                        <div key={item} className="rounded-md bg-slate-900 px-3 py-2 text-xs text-slate-300">{item}</div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Draft Table Mappings</div>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-300">
                      {JSON.stringify(assistant.table_payloads || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">Raw OCR Text</h2>
                <span className="text-xs text-slate-400">Confidence {result.ocr.confidence}%</span>
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
                {result.ocr.text}
              </pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
