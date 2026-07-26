import { mockApi } from './mockApi';

const CRIME_API    = import.meta.env.VITE_CRIME_API_URL    || '/api';
const ANALYTICS_API = import.meta.env.VITE_ANALYTICS_API_URL || '/analytics';
const FIR_API = import.meta.env.VITE_FIR_API_URL || '/fir';
const DATA_API = import.meta.env.VITE_DATA_API_URL || CRIME_API;
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';
const USE_CATALYST_FIR = import.meta.env.VITE_USE_CATALYST_FIR === 'true' && Boolean(import.meta.env.VITE_FIR_API_URL);

async function get(base, path, params = {}) {
    const url  = new URL(base + path, window.location.origin);
    Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'API error');
    return json.data;
}

async function postMultipart(base, path, formData) {
    const url = new URL(base + path, window.location.origin);
    const res = await fetch(url.toString(), { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'API error');
    return json.data;
}

async function postJson(base, path, data) {
    const url = new URL(base + path, window.location.origin);
    const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'API error');
    return json.data;
}

const firApi = {
    processFirDocument: (file, options = {}) => {
        const formData = new FormData();
        formData.append('image', file);
        if (options.language) formData.append('language', options.language);
        if (options.modelType) formData.append('modelType', options.modelType);
        return postMultipart(FIR_API, '/ocr', formData);
    },
    assistFirDraft: (payload) => postJson(FIR_API, '/assist', payload),
    saveFirDraft: (payload) => postJson(FIR_API, '/drafts', payload),
};

const catalystApi = {
    summary:        (year)            => get(CRIME_API, '/stats/summary',    { year }),
    crimes:         (filters)         => get(CRIME_API, '/crimes',            filters),
    crime:          (id)              => get(CRIME_API, `/crimes/${id}`),
    districts:      (year)            => get(CRIME_API, '/districts',         { year }),
    hotspots:       (params)          => get(CRIME_API, '/hotspots',          params),
    network:        (limit)           => get(CRIME_API, '/network',           { limit }),
    trends:         (params)          => get(CRIME_API, '/trends',            params),
    alerts:         ()                => get(CRIME_API, '/alerts'),
    updates:        ()                => get(CRIME_API, '/updates'),
    offender:       (id)              => get(CRIME_API, `/offenders/${id}`),
    officers:       (params)          => get(CRIME_API, '/officers',          params),
    search:         (q)               => get(CRIME_API, '/search',            { q }),
    stations:       (district_id)     => get(CRIME_API, '/police-stations',   { district_id }),

    // Analytics API
    riskScores:     (year)            => get(ANALYTICS_API, '/predict/risk',   { year }),
    hotzonePred:    ()                => get(ANALYTICS_API, '/predict/hotzone'),
    correlations:   ()                => get(ANALYTICS_API, '/correlations'),
    anomalies:      ()                => get(ANALYTICS_API, '/anomalies'),
    moProfile:      (params)          => get(ANALYTICS_API, '/mo-profile',     params),
    recidivism:     ()                => get(ANALYTICS_API, '/recidivism'),

    // FIR OCR / intake
    ...firApi,

    // Data directory
    listDataTables: () => get(DATA_API, '/data-directory/tables'),
    getDataTable: (table) => get(DATA_API, `/data-directory/tables/${table}`),
    addOfficer: (officer) => postJson(DATA_API, '/officers', officer),
};

export const api = USE_MOCKS
    ? { ...mockApi, ...(USE_CATALYST_FIR ? firApi : {}) }
    : catalystApi;
