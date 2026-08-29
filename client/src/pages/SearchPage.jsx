import React, { useMemo, useState } from 'react';
import {
  AlertCircle, Bot, CheckCircle2, Code2, Database, Loader2,
  MessageSquare, Search, Send, Table2, User
} from 'lucide-react';
import { api } from '../api';

const EXAMPLES = [
  'offenders part of Organized Crime with prior convictions',
  'victims of Drug Cartel theft cases in Bengaluru Rural',
  'high risk offenders from Local Gang linked to robbery in 2024',
  'active offenders linked to cybercrime in Bengaluru Urban',
  'theft cases in Belagavi involving Deepa Naik or alias Jade-83',
  'victims of Organized Crime in Mysuru district',
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAsk = async e => {
    e.preventDefault();
    const question = q.trim();
    if (!question) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
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
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Code2 size={15} className="text-green-400" />
                  Generated ZCQL
                </div>
                <pre className="overflow-auto rounded-lg border border-slate-900 bg-black/40 p-3 text-xs leading-relaxed text-green-200">
                  <code>{answer.sql}</code>
                </pre>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Table2 size={15} className="text-blue-400" />
                  Query Results
                </div>
                <ResultsTable rows={rows} />
              </div>

              <SchemaPanel schema={answer.schema_used} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
