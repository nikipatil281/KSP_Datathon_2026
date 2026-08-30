import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Layers, Thermometer, MapPin } from 'lucide-react';
import { api } from '../api';

// leaflet.heat loaded via CDN in index.html

const CRIME_TYPES = ['All','Theft','Robbery','Assault','Cybercrime','Drug Offence','Fraud','Murder','Kidnapping'];

const DISTRICT_COLORS = {
  HIGH:   '#df4f61',
  MEDIUM: '#d2a552',
  LOW:    '#58c095',
};

function getRiskColor(rate) {
  if (rate > 400) return '#df4f61';
  if (rate > 200) return '#e58746';
  if (rate > 100) return '#d2a552';
  return '#58c095';
}

function popupShell(title, subtitle, rows) {
  return `
    <div class="map-popup">
      <div class="map-popup-title">${title}</div>
      ${subtitle ? `<div class="map-popup-subtitle">${subtitle}</div>` : ''}
      <div class="map-popup-grid">
        ${rows.map(([label, value, color]) => `
          <div class="map-popup-row">
            <span class="map-popup-label">${label}</span>
            <span class="map-popup-value" ${color ? `style="color:${color}"` : ''}>${value}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

export default function GeoMap() {
  const mapRef  = useRef(null);
  const mapInst = useRef(null);
  const heatRef = useRef(null);
  const distRef = useRef(null);

  const [year,      setYear]      = useState(2024);
  const [month,     setMonth]     = useState('');
  const [crimeType, setCrimeType] = useState('All');
  const [mode,      setMode]      = useState('heatmap'); // 'heatmap' | 'districts' | 'stations'
  const [loading,   setLoading]   = useState(false);
  const [info,      setInfo]      = useState(null);

  // Init map once
  useEffect(() => {
    if (mapInst.current) return;
    mapInst.current = L.map(mapRef.current, {
      center: [14.5, 75.7],
      zoom: 7,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(mapInst.current);
    return () => { mapInst.current?.remove(); mapInst.current = null; };
  }, []);

  // Load data when filters change
  useEffect(() => {
    if (!mapInst.current) return;
    setLoading(true);

    // Clear previous layers
    heatRef.current?.remove();
    distRef.current?.remove();

    const params = {
      year,
      ...(month      ? { month }      : {}),
      ...(crimeType !== 'All' ? { crime_type: crimeType } : {})
    };

    if (mode === 'heatmap') {
      api.hotspots(params).then(spots => {
        const pts = spots.map(s => [s.lat, s.lng, s.intensity * 2]);
        if (window.L && window.L.heatLayer) {
          heatRef.current = window.L.heatLayer(pts, {
            radius: 35, blur: 25, maxZoom: 12,
            gradient: { 0.0:'#17364a', 0.3:'#20c7e8', 0.6:'#d2a552', 0.85:'#df4f61', 1.0:'#f7f8fc' }
          }).addTo(mapInst.current);
        } else {
          // Fallback circles if heatLayer not loaded
          const layer = L.layerGroup();
          spots.forEach(s => {
            L.circleMarker([s.lat, s.lng], {
              radius: Math.max(6, s.count / 3),
              fillColor: getRiskColor(s.count * 10),
              color: '#fff', weight: 0.5,
              fillOpacity: 0.75
            })
            .bindPopup(popupShell(s.dominant_crime, 'Hotspot cluster', [
              ['Count', s.count],
              ['Avg Severity', s.avg_severity],
              ['Night Ratio', `${(s.night_ratio*100).toFixed(0)}%`],
            ]))
            .addTo(layer);
          });
          distRef.current = layer.addTo(mapInst.current);
        }
        setLoading(false);
      }).catch(() => setLoading(false));

    } else if (mode === 'districts') {
      api.districts(year).then(districts => {
        const layer = L.layerGroup();
        districts.forEach(d => {
          const color = getRiskColor(d.crime_rate_per_100k);
          L.circleMarker([d.latitude, d.longitude], {
            radius: Math.max(12, Math.min(40, d.crime_rate_per_100k / 12)),
            fillColor: color, color: '#fff', weight: 1.5, fillOpacity: 0.8
          })
          .bindPopup(popupShell(d.name, 'District risk profile', [
            ['Total Crimes', d.total_crimes],
            ['Rate per 100k', d.crime_rate_per_100k, color],
            ['Solve Rate', `${(d.solve_rate*100).toFixed(1)}%`],
            ['Avg Severity', (d.avg_severity || 0).toFixed(1)],
            ['SEI', d.socio_economic_index],
          ]))
          .on('click', () => setInfo(d))
          .addTo(layer);
          // Label
          L.marker([d.latitude, d.longitude], {
            icon: L.divIcon({
              html: `<div style="font-size:9px;color:#fff;text-align:center;white-space:nowrap;font-weight:bold;text-shadow:0 0 3px #000">${d.name.split(' ')[0]}</div>`,
              iconSize: [80, 16], iconAnchor: [40, -5], className: ''
            })
          }).addTo(layer);
        });
        distRef.current = layer.addTo(mapInst.current);
        setLoading(false);
      }).catch(() => setLoading(false));

    } else if (mode === 'stations') {
      api.stations().then(stations => {
        const layer = L.layerGroup();
        const icon = L.divIcon({
          html: '<div style="width:10px;height:10px;background:#20c7e8;border:2px solid #f7f8fc;border-radius:50%"></div>',
          iconSize: [10,10], iconAnchor: [5,5], className: ''
        });
        stations.forEach(s => {
          L.marker([s.latitude, s.longitude], { icon })
            .bindPopup(popupShell(s.name, 'Police station', [
              ['Officers', s.officer_count],
              ['Area Covered', `${s.area_covered_sqkm} km²`],
            ]))
            .addTo(layer);
        });
        distRef.current = layer.addTo(mapInst.current);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [year, month, crimeType, mode]);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap gap-3 items-center">
        <h2 className="text-sm font-semibold text-white mr-2">Crime Map</h2>

        {/* Mode */}
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {[['heatmap','Heatmap'], ['districts','Districts'], ['stations','Stations']].map(([v,l]) => (
            <button key={v} onClick={() => setMode(v)}
              className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${mode===v ? 'bg-blue-600 text-white':'text-slate-400 hover:text-white'}`}
            >{l}</button>
          ))}
        </div>

        {/* Year */}
        <select value={year} onChange={e => setYear(+e.target.value)}
          className="bg-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 border border-slate-700">
          {[2020,2021,2022,2023,2024,2025].map(y => <option key={y}>{y}</option>)}
        </select>

        {/* Month */}
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="bg-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 border border-slate-700">
          <option value="">All Months</option>
          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => (
            <option key={m} value={i+1}>{m}</option>
          ))}
        </select>

        {/* Crime type */}
        {mode !== 'stations' && (
          <select value={crimeType} onChange={e => setCrimeType(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 border border-slate-700">
            {CRIME_TYPES.map(ct => <option key={ct}>{ct}</option>)}
          </select>
        )}

        {loading && <Loader2 size={16} className="animate-spin text-blue-400" />}

        {/* Legend */}
        <div className="ml-auto flex gap-3 items-center text-xs text-slate-400">
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Low</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />Medium</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />High</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Critical</div>
        </div>
      </div>

      {/* Map + Side panel */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={mapRef} className="flex-1" />
        {info && (
          <div className="w-64 bg-slate-900 border-l border-slate-800 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">{info.name}</h3>
              <button onClick={() => setInfo(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
            </div>
            {[
              ['Total Crimes',    info.total_crimes],
              ['Rate / 100k',     info.crime_rate_per_100k],
              ['Solved',          `${(info.solve_rate*100).toFixed(1)}%`],
              ['Population',      info.population?.toLocaleString()],
              ['SEI',             info.socio_economic_index],
              ['Urbanization',    `${(info.urbanization_index*100).toFixed(0)}%`],
              ['Unemployment',    `${(info.unemployment_rate*100).toFixed(1)}%`],
              ['Literacy',        `${(info.literacy_rate*100).toFixed(0)}%`],
            ].map(([l,v]) => (
              <div key={l} className="flex justify-between py-1.5 border-b border-slate-800 text-xs">
                <span className="text-slate-400">{l}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
