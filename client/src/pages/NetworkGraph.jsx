import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Loader2, Users, AlertCircle, Filter } from 'lucide-react';
import { api } from '../api';

const GROUP_COLORS = {
  'None':             '#20c7e8',
  'Local Gang':       '#c29b68',
  'Organized Crime':  '#df4f61',
  'Drug Cartel':      '#8d89aa',
};

const STATUS_COLORS = {
  'Arrested':   '#58c095',
  'Absconding': '#df4f61',
  'Bail':       '#d2a552',
  'Convicted':  '#8fa8d8',
  'Acquitted':  '#9aa4ba',
  'Juvenile':   '#5aa8c0',
};

function Legend({ items, title }) {
  return (
    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
      <div className="text-xs font-semibold text-slate-300 mb-2">{title}</div>
      {items.map(([k, c]) => (
        <div key={k} className="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c }} />
          {k}
        </div>
      ))}
    </div>
  );
}

export default function NetworkGraph() {
  const svgRef  = useRef(null);
  const [data,   setData]   = useState(null);
  const [limit,  setLimit]  = useState(80);
  const [filter, setFilter] = useState('all');   // all | gang | high-risk
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    setLoading(true);
    api.network(limit)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [limit]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const el = svgRef.current;
    const W  = el.clientWidth  || 900;
    const H  = el.clientHeight || 600;

    d3.select(el).selectAll('*').remove();

    // Filter nodes
    let nodes = data.nodes;
    if (filter === 'gang')      nodes = nodes.filter(n => n.group !== 'None');
    if (filter === 'high-risk') nodes = nodes.filter(n => n.risk >= 0.7);

    const nodeIds = new Set(nodes.map(n => n.id));
    const edges   = data.edges.filter(e => nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)));

    const svg = d3.select(el)
      .attr('width', W).attr('height', H);

    // Zoom
    const g = svg.append('g');
    svg.call(d3.zoom().scaleExtent([0.3, 4])
      .on('zoom', ev => g.attr('transform', ev.transform)));

    // Simulation
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(80).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(W/2, H/2))
      .force('collision', d3.forceCollide(18));

    // Edges
    const link = g.append('g').selectAll('line')
      .data(edges).join('line')
      .attr('stroke', d => d.type === 'Gang member' ? '#df4f61' : '#505a72')
      .attr('stroke-width', d => Math.max(0.5, (d.weight || 0.5) * 2))
      .attr('stroke-opacity', 0.6);

    // Edge labels
    const edgeLabel = g.append('g').selectAll('text')
      .data(edges.filter(e => e.type !== 'Known associate')).join('text')
      .text(d => d.type)
      .attr('font-size', 8)
      .attr('fill', '#64748b')
      .attr('text-anchor', 'middle');

    // Nodes
    const node = g.append('g').selectAll('g')
      .data(nodes).join('g')
      .call(d3.drag()
        .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
        .on('drag',  (ev, d) => { d.fx=ev.x; d.fy=ev.y; })
        .on('end',   (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx=null; d.fy=null; })
      )
      .on('click', (ev, d) => { ev.stopPropagation(); setSelected(d); });

    // Circle
    node.append('circle')
      .attr('r', d => 8 + (d.prior || 0) * 1.5)
      .attr('fill', d => GROUP_COLORS[d.group] || '#20c7e8')
      .attr('stroke', d => STATUS_COLORS[d.status] || '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9);

    // Risk ring (pulse for high risk)
    node.filter(d => d.risk >= 0.8).append('circle')
      .attr('r', d => 14 + (d.prior || 0) * 1.5)
      .attr('fill', 'none')
      .attr('stroke', '#df4f61')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.5)
      .attr('stroke-dasharray', '3,3');

    // Label
    node.append('text')
      .text(d => d.label.split(' ')[0])
      .attr('font-size', 9)
      .attr('fill', '#dde1ec')
      .attr('text-anchor', 'middle')
      .attr('dy', d => 18 + (d.prior || 0) * 1.5);

    // Alias
    node.filter(d => d.alias)
      .append('text')
      .text(d => d.alias)
      .attr('font-size', 7)
      .attr('fill', '#94a3b8')
      .attr('text-anchor', 'middle')
      .attr('dy', d => 27 + (d.prior || 0) * 1.5);

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      edgeLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    svg.on('click', () => setSelected(null));
  }, [data, filter]);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap gap-3 items-center">
        <h2 className="text-sm font-semibold text-white mr-2">Criminal Link Analysis</h2>

        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {[['all','All'],['gang','Gangs Only'],['high-risk','High Risk (≥0.7)']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${filter===v?'bg-blue-600 text-white':'text-slate-400 hover:text-white'}`}
            >{l}</button>
          ))}
        </div>

        <select value={limit} onChange={e => setLimit(+e.target.value)}
          className="bg-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 border border-slate-700">
          {[50,80,120,200].map(n => <option key={n} value={n}>{n} nodes</option>)}
        </select>

        {loading && <Loader2 size={16} className="animate-spin text-blue-400" />}

        <div className="ml-auto text-xs text-slate-500">
          {data ? `${data.nodes.length} offenders · ${data.edges.length} connections` : ''}
        </div>
      </div>

      {/* Graph + Legends + Detail panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Legends */}
        <div className="w-44 bg-slate-900 border-r border-slate-800 p-3 space-y-3 overflow-y-auto flex-shrink-0">
          <Legend title="Affiliation" items={Object.entries(GROUP_COLORS)} />
          <Legend title="Status (ring)" items={Object.entries(STATUS_COLORS)} />
          <div className="text-xs text-slate-500 mt-2">
            <div>Node size = prior convictions</div>
            <div className="mt-1">Red dashed ring = risk ≥ 0.8</div>
            <div className="mt-1">Red edge = gang relationship</div>
            <div className="mt-1">Drag to rearrange</div>
          </div>
        </div>

        {/* SVG */}
        {error ? (
          <div className="flex-1 flex items-center justify-center text-red-400">
            <AlertCircle className="mr-2" /> {error}
          </div>
        ) : (
          <svg ref={svgRef} className="flex-1 cursor-grab active:cursor-grabbing" />
        )}

        {/* Detail panel */}
        {selected && (
          <div className="w-56 bg-slate-900 border-l border-slate-800 p-4 overflow-y-auto flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">{selected.label}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
            </div>
            {selected.alias && <div className="text-xs text-slate-400 mb-3">aka "{selected.alias}"</div>}
            {[
              ['Status',      selected.status],
              ['Risk Score',  (selected.risk*100).toFixed(0) + '%'],
              ['Prior Conv.', selected.prior],
              ['Age',         selected.age],
              ['Affiliation', selected.group],
            ].map(([l,v]) => (
              <div key={l} className="flex justify-between py-1.5 border-b border-slate-800 text-xs">
                <span className="text-slate-400">{l}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
            <div className="mt-3">
              <div className="text-xs font-semibold text-slate-300 mb-1">Risk Level</div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${(selected.risk||0)*100}%`,
                  background: selected.risk>=0.8?'#ef4444':selected.risk>=0.5?'#f59e0b':'#22c55e'
                }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
