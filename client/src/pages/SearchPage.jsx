import React, { useMemo, useState } from 'react';
import {
  AlertCircle, Bot, CheckCircle2, ChevronDown, Code2, Database, GitBranch, Loader2,
  Maximize2, MessageSquare, Search, Send, Table2, User, X
} from 'lucide-react';
import { api } from '../api';

const EXAMPLES = [
  'offenders part of Organized Crime with prior convictions',
  'high risk offenders from Organized Crime in Bengaluru Rural',
  'offenders from Local Gang with prior convictions above 5',
  'theft cases in Bengaluru Rural',
  'victims of Theft cases in Bengaluru Rural',
  'cybercrime cases in Bengaluru Urban in 2024',
];

function ResultCell({ value }) {
  const text = value === null || value === undefined || value === '' ? '-' : String(value);
  return (
    <td className="max-w-[220px] border-b border-slate-800 px-3 py-2 align-top text-xs text-slate-300">
      <div className="truncate" title={text}>{text}</div>
    </td>
  );
}

function ResultsTable({ rows }) {
  const columns = useMemo(() => Object.keys(rows?.[0] || {}).slice(0, 10), [rows]);
  if (!rows?.length) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-sm text-slate-500">
        No rows matched the generated query.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700">
      <div className="max-h-[520px] overflow-auto">
        <table className="min-w-full border-collapse bg-slate-900">
          <thead className="sticky top-0 z-10 bg-slate-800">
            <tr>
              {columns.map(column => (
                <th key={column} className="border-b border-slate-700 px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-400">
                  {column.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.offender_id || row.crime_id || 'row'}-${index}`} className="hover:bg-slate-800/70">
                {columns.map(column => <ResultCell key={column} value={row[column]} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function truncateLabel(value, length = 24) {
  const text = String(value || '-');
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function valuePresent(value) {
  return value !== null && value !== undefined && value !== '' && value !== 'None';
}

function mergeRows(existingRows = [], incomingRows = []) {
  const seen = new Set();
  return [...existingRows, ...incomingRows]
    .filter(Boolean)
    .filter(row => {
      const id = [
        row.offender_id,
        row.victim_id,
        row.crime_id,
        row.fir_number,
        row.name,
        row.role
      ].filter(valuePresent).join('|') || JSON.stringify(row);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 16);
}

function addNode(map, node) {
  const nodeRows = node.rows || (node.row ? [node.row] : []);
  if (!map.has(node.id)) {
    map.set(node.id, { ...node, rows: nodeRows });
    return;
  }

  const existing = map.get(node.id);
  map.set(node.id, {
    ...existing,
    count: (existing.count || 1) + (node.countIncrement || 1),
    rows: mergeRows(existing.rows, nodeRows)
  });
}

function addLink(links, source, target) {
  const id = `${source}->${target}`;
  if (!links.some(link => link.id === id)) links.push({ id, source, target });
}

function buildGraph(answer, question) {
  const rows = (answer?.rows || []).slice(0, 28);
  const nodes = new Map();
  const links = [];
  const centralLabel = question || answer?.intent || 'Search query';

  addNode(nodes, {
    id: 'query',
    label: truncateLabel(centralLabel, 38),
    title: centralLabel,
    type: 'query',
    level: 0,
    count: rows.length,
    rows
  });

  rows.forEach((row, index) => {
    const entityType = row.offender_id ? 'offender' : row.victim_id ? 'victim' : row.crime_id ? 'crime' : 'record';
    const entityId = row.offender_id || row.victim_id || row.crime_id || index + 1;
    const entityLabel = row.name || row.fir_number || `${entityType} ${entityId}`;
    const nodeId = `${entityType}:${entityId}`;

    addNode(nodes, {
      id: nodeId,
      label: truncateLabel(entityLabel),
      title: entityLabel,
      type: entityType,
      level: 1,
      count: 1,
      row
    });
    addLink(links, 'query', nodeId);

    const attributes = [
      ['gang', row.gang_affiliation],
      ['crime', row.crime_type],
      ['district', row.district || row.district_of_origin],
      ['status', row.status],
      ['occupation', row.occupation],
      ['gender', row.gender],
      ['year', row.incident_year],
      ['role', row.role],
      ['risk', row.risk_score !== undefined ? `risk ${Number(row.risk_score).toFixed(2)}` : null],
      ['convictions', row.prior_convictions !== undefined ? `${row.prior_convictions} prior convictions` : null],
    ];

    attributes.forEach(([field, value]) => {
      if (!valuePresent(value)) return;
      const attrId = `${field}:${String(value).toLowerCase()}`;
      addNode(nodes, {
        id: attrId,
        label: truncateLabel(String(value)),
        title: `${field}: ${value}`,
        type: field,
        level: 2,
        count: 1,
        row
      });
      addLink(links, nodeId, attrId);
    });
  });

  const graphNodes = [...nodes.values()];
  const entityNodes = graphNodes.filter(node => node.level === 1);
  const attributeNodes = graphNodes.filter(node => node.level === 2)
    .sort((a, b) => (b.count || 1) - (a.count || 1))
    .slice(0, 44);
  const visibleIds = new Set(['query', ...entityNodes.map(node => node.id), ...attributeNodes.map(node => node.id)]);
  const visibleNodes = graphNodes.filter(node => visibleIds.has(node.id));
  const visibleLinks = links.filter(link => visibleIds.has(link.source) && visibleIds.has(link.target));

  return { nodes: visibleNodes, links: visibleLinks, hidden: graphNodes.length - visibleNodes.length };
}

function getPrimaryResultGraph(graph) {
  const visibleIds = new Set(['query']);
  graph.nodes.filter(node => node.level === 1).forEach(node => visibleIds.add(node.id));

  return {
    ...graph,
    nodes: graph.nodes.filter(node => visibleIds.has(node.id)),
    links: graph.links.filter(link => visibleIds.has(link.source) && visibleIds.has(link.target)),
    hidden: graph.nodes.filter(node => node.level === 2).length
  };
}

function getVisibleInteractiveGraph(graph, expandedNodeId) {
  const visibleIds = new Set(['query']);
  graph.nodes.filter(node => node.level === 1).forEach(node => visibleIds.add(node.id));
  const expandedNode = graph.nodes.find(node => node.id === expandedNodeId);

  if (expandedNodeId) {
    visibleIds.add(expandedNodeId);
    graph.links.forEach(link => {
      if (link.source === expandedNodeId || link.target === expandedNodeId) {
        visibleIds.add(link.source);
        visibleIds.add(link.target);
      }
    });
  }

  return {
    ...graph,
    nodes: graph.nodes.filter(node => visibleIds.has(node.id)),
    links: graph.links.filter(link => {
      if (!visibleIds.has(link.source) || !visibleIds.has(link.target)) return false;
      if (link.source === 'query' || link.target === 'query') return true;
      if (!expandedNodeId) return false;
      if (expandedNode?.level === 1) return link.source === expandedNodeId || link.target === expandedNodeId;
      return link.source === expandedNodeId || link.target === expandedNodeId;
    })
  };
}

function getConnectedNodes(graph, nodeId) {
  const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
  return graph.links
    .filter(link => link.source === nodeId || link.target === nodeId)
    .map(link => nodeById.get(link.source === nodeId ? link.target : link.source))
    .filter(Boolean);
}

const DETAIL_FIELDS = {
  offender: [
    'offender_id',
    'name',
    'alias',
    'gang_affiliation',
    'status',
    'prior_convictions',
    'risk_score',
    'age',
    'gender',
    'district_of_origin',
    'occupation'
  ],
  victim: [
    'victim_id',
    'name',
    'age',
    'gender',
    'occupation',
    'district',
    'district_of_origin',
    'crime_type',
    'fir_number',
    'role'
  ],
  crime: [
    'crime_id',
    'fir_number',
    'crime_type',
    'district',
    'incident_date',
    'incident_year',
    'status',
    'modus_operandi',
    'location',
    'name',
    'alias',
    'gang_affiliation'
  ],
  gang: ['gang_affiliation', 'name', 'alias', 'status', 'prior_convictions', 'risk_score', 'crime_type', 'district'],
  district: ['district', 'district_of_origin', 'name', 'alias', 'crime_type', 'fir_number', 'incident_date', 'status'],
  crime_type: ['crime_type', 'fir_number', 'district', 'incident_date', 'name', 'alias', 'gang_affiliation'],
  status: ['status', 'name', 'alias', 'gang_affiliation', 'crime_type', 'fir_number'],
  occupation: ['occupation', 'name', 'gender', 'district_of_origin', 'crime_type'],
  gender: ['gender', 'name', 'age', 'occupation', 'district_of_origin'],
  year: ['incident_year', 'incident_date', 'fir_number', 'crime_type', 'district'],
  role: ['role', 'name', 'fir_number', 'crime_type', 'district'],
  risk: ['risk_score', 'name', 'alias', 'gang_affiliation', 'status', 'prior_convictions'],
  convictions: ['prior_convictions', 'name', 'alias', 'gang_affiliation', 'status', 'risk_score']
};

function formatFieldName(field) {
  return field.replace(/_/g, ' ');
}

function uniqueValues(rows, field, max = 6) {
  const values = [];
  const seen = new Set();
  rows.forEach(row => {
    const value = row?.[field];
    if (!valuePresent(value)) return;
    const key = String(value);
    if (seen.has(key)) return;
    seen.add(key);
    values.push(key);
  });
  const visible = values.slice(0, max);
  return values.length > max ? `${visible.join(', ')} +${values.length - max} more` : visible.join(', ');
}

function getNodeDetails(node) {
  const rows = node.rows || [];
  if (!rows.length) return [];

  if (node.type === 'query') {
    return [
      ['matched rows', rows.length],
      ['offenders', uniqueValues(rows, 'name')],
      ['crimes', uniqueValues(rows, 'crime_type')],
      ['districts', uniqueValues(rows, 'district') || uniqueValues(rows, 'district_of_origin')],
      ['gangs', uniqueValues(rows, 'gang_affiliation')]
    ].filter(([, value]) => valuePresent(value));
  }

  const fields = DETAIL_FIELDS[node.type] || Object.keys(rows[0] || {}).slice(0, 10);
  const details = fields
    .map(field => [formatFieldName(field), uniqueValues(rows, field)])
    .filter(([, value]) => valuePresent(value));

  if (node.level === 2) {
    details.unshift(['node value', node.title.replace(`${node.type}: `, '')]);
    details.push(...[
      ['matched rows', rows.length],
      ['related offenders', uniqueValues(rows, 'name')],
      ['related FIRs', uniqueValues(rows, 'fir_number')],
      ['related crime types', uniqueValues(rows, 'crime_type')],
      ['related districts', uniqueValues(rows, 'district') || uniqueValues(rows, 'district_of_origin')]
    ].filter(([, value]) => valuePresent(value)));
  }

  return details.slice(0, 18);
}

function colorForNode(type) {
  return ({
    query: ['#22d3ee', '#083344'],
    offender: ['#a78bfa', '#2e1065'],
    victim: ['#f472b6', '#500724'],
    crime: ['#fb923c', '#431407'],
    gang: ['#f87171', '#450a0a'],
    district: ['#38bdf8', '#082f49'],
    status: ['#4ade80', '#052e16'],
    crime_type: ['#fb923c', '#431407'],
  }[type] || ['#94a3b8', '#0f172a']);
}

function GraphCanvas({
  graph,
  interactive = false,
  fullscreen = false,
  selectedNodeId = '',
  expandedNodeId = '',
  onNodeClick = () => {}
}) {
  const positions = useMemo(() => {
    const width = fullscreen ? 1120 : 920;
    const height = fullscreen ? 720 : 560;
    const center = { x: width / 2, y: height / 2 };
    const map = new Map([['query', center]]);
    const entityNodes = graph.nodes.filter(node => node.level === 1);
    const attributeNodes = graph.nodes.filter(node => node.level === 2);
    const entityRadiusX = fullscreen ? 250 : 170;
    const entityRadiusY = fullscreen ? 210 : 150;
    const attrRadiusX = fullscreen ? 455 : 315;
    const attrRadiusY = fullscreen ? 305 : 235;

    entityNodes.forEach((node, index) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / Math.max(entityNodes.length, 1));
      map.set(node.id, {
        x: center.x + Math.cos(angle) * entityRadiusX,
        y: center.y + Math.sin(angle) * entityRadiusY
      });
    });

    attributeNodes.forEach((node, index) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / Math.max(attributeNodes.length, 1));
      map.set(node.id, {
        x: center.x + Math.cos(angle) * attrRadiusX,
        y: center.y + Math.sin(angle) * attrRadiusY
      });
    });

    return map;
  }, [graph, fullscreen]);

  const width = fullscreen ? 1120 : 920;
  const height = fullscreen ? 720 : 560;
  const nodeRadius = node => {
    if (fullscreen) return node.level === 0 ? 24 : node.level === 1 ? 12 : 9;
    return node.level === 0 ? 18 : node.level === 1 ? 9 : 7;
  };

  return (
    <div className="overflow-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className={`${fullscreen ? 'h-[calc(100vh-116px)] min-w-[980px]' : 'h-[500px] min-w-[920px]'} w-full`}>
        <rect width={width} height={height} fill="#020617" />
        {graph.links.map(link => {
          const source = positions.get(link.source);
          const target = positions.get(link.target);
          if (!source || !target) return null;
          const isSelectedLink = selectedNodeId && (link.source === selectedNodeId || link.target === selectedNodeId);
          return (
            <line
              key={link.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={isSelectedLink ? '#67e8f9' : '#334155'}
              strokeWidth={isSelectedLink ? '2' : '1'}
            />
          );
        })}
        {graph.nodes.map(node => {
          const position = positions.get(node.id);
          if (!position) return null;
          const [stroke, fill] = colorForNode(node.type);
          const radius = nodeRadius(node);
          const selected = selectedNodeId === node.id;
          const expanded = expandedNodeId === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${position.x} ${position.y})`}
              onClick={interactive ? () => onNodeClick(node) : undefined}
              className={interactive ? 'cursor-pointer' : ''}
            >
              <circle
                r={radius}
                fill={fill}
                stroke={selected ? '#f8fafc' : stroke}
                strokeWidth={selected ? '3' : '1.5'}
              />
              {expanded && !selected && <circle r={radius + 4} fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="3 4" opacity="0.55" />}
              <text
                y={radius + (fullscreen ? 13 : 11)}
                textAnchor="middle"
                className={`${fullscreen ? 'text-[9px]' : 'text-[8px]'} fill-slate-200 font-semibold`}
              >
                <title>{node.title}</title>
                {truncateLabel(node.label, fullscreen ? 22 : 18)}
              </text>
              {node.count > 1 && node.level > 1 && (
                <text y="3" textAnchor="middle" className="fill-white text-[8px] font-bold">
                  {node.count}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function NodeDetailsPanel({ graph, selectedNodeId, expandedNodeId }) {
  const selectedNode = graph.nodes.find(node => node.id === selectedNodeId) || graph.nodes.find(node => node.id === 'query');
  const connectedNodes = selectedNode ? getConnectedNodes(graph, selectedNode.id) : [];
  const details = selectedNode ? getNodeDetails(selectedNode) : [];

  if (!selectedNode) {
    return (
      <aside className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        Select a node to inspect its linked datapoints.
      </aside>
    );
  }

  return (
    <aside className="h-[calc(100vh-116px)] overflow-auto rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="text-[11px] font-semibold uppercase text-slate-500">{selectedNode.type}</div>
      <div className="mt-1 break-words text-lg font-semibold text-white">{selectedNode.title}</div>
      <div className="mt-4 text-xs text-slate-400">
        {expandedNodeId === selectedNode.id
          ? 'This node is expanded. Click it again to collapse its direct datapoints.'
          : 'Click the selected node in the graph to expand its direct datapoints.'}
      </div>
      <div className="mt-5 text-xs font-semibold uppercase text-slate-500">Details</div>
      <div className="mt-2 space-y-2">
        {details.map(([field, value]) => (
          <div key={field} className="rounded-md border border-slate-800 bg-slate-950 p-2">
            <div className="text-[10px] uppercase text-slate-500">{field}</div>
            <div className="mt-0.5 break-words text-xs text-slate-200">{String(value)}</div>
          </div>
        ))}
        {!details.length && (
          <div className="rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-500">
            No row details were returned for this node.
          </div>
        )}
      </div>
      <div className="mt-5 text-xs font-semibold uppercase text-slate-500">Connected datapoints</div>
      <div className="mt-2 space-y-2">
        {connectedNodes.slice(0, 18).map(node => (
          <div key={node.id} className="rounded-md border border-slate-800 bg-slate-950 p-2">
            <div className="text-[10px] uppercase text-slate-500">{node.type}</div>
            <div className="mt-0.5 break-words text-xs text-slate-200">{node.title}</div>
          </div>
        ))}
        {!connectedNodes.length && (
          <div className="rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-500">
            No direct links found for this node.
          </div>
        )}
      </div>
    </aside>
  );
}

function FullscreenGraphModal({ answer, question, onClose }) {
  const baseGraph = useMemo(() => buildGraph(answer, question), [answer, question]);
  const [selectedNodeId, setSelectedNodeId] = useState('query');
  const [expandedNodeId, setExpandedNodeId] = useState('');
  const visibleGraph = useMemo(
    () => getVisibleInteractiveGraph(baseGraph, expandedNodeId),
    [baseGraph, expandedNodeId]
  );

  const handleNodeClick = node => {
    setSelectedNodeId(node.id);
    if (node.level === 0) return;
    setExpandedNodeId(previous => previous === node.id ? '' : node.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 p-4">
      <div className="flex h-full flex-col rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-white">
              <GitBranch size={17} className="text-cyan-400" />
              Graph Explorer
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Click a node to select it. Entity and attribute nodes expand or collapse their direct links.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-200"
          >
            <X size={14} />
            exit full screen
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950">
            <GraphCanvas
              graph={visibleGraph}
              interactive
              fullscreen
              selectedNodeId={selectedNodeId}
              expandedNodeId={expandedNodeId}
              onNodeClick={handleNodeClick}
            />
          </div>
          <NodeDetailsPanel
            graph={baseGraph}
            selectedNodeId={selectedNodeId}
            expandedNodeId={expandedNodeId}
          />
        </div>
      </div>
    </div>
  );
}

function GraphExplorer({ answer, question }) {
  const baseGraph = useMemo(() => buildGraph(answer, question), [answer, question]);
  const graph = useMemo(() => getPrimaryResultGraph(baseGraph), [baseGraph]);

  if (!graph.nodes.length || !answer?.rows?.length) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-sm text-slate-500">
        No graph nodes available for this result set.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <GitBranch size={15} className="text-cyan-400" />
          Graph Explorer
        </div>
        <div className="text-xs text-slate-500">
          {graph.nodes.length} result nodes{graph.hidden > 0 ? `, ${graph.hidden} details available in full screen` : ''}
        </div>
      </div>
      <GraphCanvas graph={graph} />
    </div>
  );
}

function ResultsExplorer({ rows, answer, question, viewMode, onToggleView }) {
  const [fullscreenGraphOpen, setFullscreenGraphOpen] = useState(false);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          {viewMode === 'graph' ? <GitBranch size={15} className="text-cyan-400" /> : <Table2 size={15} className="text-blue-400" />}
          {viewMode === 'graph' ? 'Query Graph' : 'Query Results'}
        </div>
        <div className="flex items-center gap-3">
          {viewMode === 'graph' && (
            <button
              type="button"
              onClick={() => setFullscreenGraphOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline"
            >
              <Maximize2 size={12} />
              open in full screen
            </button>
          )}
          <button
            type="button"
            onClick={onToggleView}
            className="text-xs font-semibold text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline"
          >
            {viewMode === 'graph' ? 'tabular view' : 'graphical view'}
          </button>
        </div>
      </div>
      {viewMode === 'graph'
        ? <GraphExplorer answer={answer} question={question} />
        : <ResultsTable rows={rows} />}
      {fullscreenGraphOpen && (
        <FullscreenGraphModal
          answer={answer}
          question={question}
          onClose={() => setFullscreenGraphOpen(false)}
        />
      )}
    </div>
  );
}

function SchemaPanel({ schema }) {
  const tables = Object.entries(schema?.tables || {});
  if (!tables.length) return null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Database size={15} className="text-blue-400" />
        Database Context Used
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {tables.map(([name, info]) => (
          <div key={name} className="rounded-md border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs font-semibold text-white">{name}</div>
            <div className="mt-1 text-[11px] text-slate-500">{info.purpose}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(info.columns || {}).slice(0, 8).map(([column, type]) => (
                <span key={column} title={type} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-400">
                  {column}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [conversation, setConversation] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSql, setShowSql] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const handleAsk = async e => {
    e.preventDefault();
    const question = q.trim();
    if (!question) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setActiveQuestion(question);
    setShowSql(false);
    setViewMode('table');
    setConversation(items => [...items, { role: 'user', content: question }]);

    try {
      const data = await api.askSearchAssistant(question);
      setAnswer(data);
      setConversation(items => [...items, { role: 'assistant', content: data.message, sql: data.sql }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setQ('');
    }
  };

  const filters = answer?.filters || [];
  const rows = answer?.rows || [];

  return (
    <div className="min-h-full space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Bot size={20} className="text-blue-400" />
            Search Assistant
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Ask in plain English. The assistant generates safe ZCQL, runs it, and shows the query.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          <CheckCircle2 size={14} className="text-green-400" />
          Metadata-constrained queries
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="space-y-4">
          <form onSubmit={handleAsk} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <MessageSquare size={15} className="text-blue-400" />
              Natural Language Query
            </label>
            <textarea
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Example: criminals with a history of theft and associated with Organized Crime"
              rows={5}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !q.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Generate SQL and Search
            </button>
          </form>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-200">Try These</div>
            <div className="space-y-2">
              {EXAMPLES.map(example => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQ(example)}
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-left text-xs text-slate-400 transition-colors hover:border-blue-700 hover:text-slate-100"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {conversation.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-200">Conversation</div>
              <div className="space-y-3">
                {conversation.slice(-6).map((item, index) => (
                  <div key={index} className={`rounded-md px-3 py-2 text-xs ${item.role === 'user' ? 'bg-blue-950 text-blue-100' : 'bg-slate-950 text-slate-300'}`}>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.role}</div>
                    <div>{item.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-700 bg-red-950 p-3 text-sm text-red-300">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {!answer && !loading && !error && (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-center text-slate-500">
              <Search size={42} className="mb-3 opacity-30" />
              <div className="text-sm">Ask for offenders, cases, gangs, crime types, years, districts, or risk.</div>
            </div>
          )}

          {loading && (
            <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-sm text-slate-400">
              <Loader2 size={18} className="mr-2 animate-spin text-blue-400" />
              Generating ZCQL and searching the database...
            </div>
          )}

          {answer && (
            <>
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <User size={15} className="text-purple-400" />
                      {answer.intent}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{answer.message}</div>
                  </div>
                  <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200">
                    {answer.row_count || 0} rows
                  </div>
                </div>

                {filters.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {filters.map((filter, index) => (
                      <span key={`${filter.field}-${index}`} className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300">
                        {filter.field} {filter.operator} {String(filter.value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <button
                  type="button"
                  onClick={() => setShowSql(value => !value)}
                  className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-slate-200"
                  aria-expanded={showSql}
                >
                  <span className="flex items-center gap-2">
                    <Code2 size={15} className="text-green-400" />
                    Generated ZCQL
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform ${showSql ? 'rotate-180' : ''}`}
                  />
                </button>
                {showSql && (
                  <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-900 bg-black/40 p-3 text-xs leading-relaxed text-green-200">
                    <code>{answer.sql}</code>
                  </pre>
                )}
              </div>

              <ResultsExplorer
                rows={rows}
                answer={answer}
                question={activeQuestion}
                viewMode={viewMode}
                onToggleView={() => setViewMode(value => value === 'graph' ? 'table' : 'graph')}
              />

              <SchemaPanel
                schema={answer.schema_used}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
