'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { QueryResultAttachment } from '@/context/ChatContext';
import { useTextToSpeech } from '@/lib/useTextToSpeech';
import { useChat } from '@/context/ChatContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['var(--purple)', '#10b981', '#f5a623', '#e86fa8', '#06b6d4'];

interface Props {
  role: 'user' | 'assistant';
  content: string;
  queryResult?: QueryResultAttachment;
}

function QueryDataViewer({ result }: { result: QueryResultAttachment }) {
  const { columns, rows, row_count, message } = result;
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('chart');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'pie'>('bar');

  if (!columns.length && !rows.length) {
    return (
      <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
        {message ?? 'Query returned no rows.'}
      </div>
    );
  }

  let chartData: any[] = [];
  let numericCols: {key: string, index: number}[] = [];
  let categoryCol: {key: string, index: number} | null = null;

  if (rows.length > 0) {
    columns.forEach((col, idx) => {
      let isNum = false;
      let isStr = false;
      for (let r = 0; r < Math.min(rows.length, 5); r++) {
        const val = rows[r][idx];
        if (val === null || val === undefined) continue;
        if (typeof val === 'number') {
          isNum = true; break;
        }
        if (typeof val === 'string') {
          if (val.trim() !== '' && !isNaN(Number(val))) {
            isNum = true; break;
          }
          isStr = true;
        }
      }
      if (isNum) {
        numericCols.push({ key: col, index: idx });
      } else if (isStr && !categoryCol && col.length < 30) {
        categoryCol = { key: col, index: idx };
      }
    });

    if (numericCols.length > 0) {
      chartData = rows.map((row, i) => {
        const obj: any = {};
        if (categoryCol) {
          obj[categoryCol.key] = row[categoryCol.index];
        } else {
          obj['index'] = i + 1;
        }
        numericCols.forEach(nc => {
          obj[nc.key] = row[nc.index];
        });
        return obj;
      });
    }
  }

  const canChart = numericCols.length > 0 && rows.length > 0;

  const renderTable = () => (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: 'var(--bg-card)' }}>
            {columns.map((col, idx) => (
              <th key={`${col}-${idx}`} style={{
                padding: '7px 10px', textAlign: 'left',
                color: 'var(--purple)', fontWeight: 600, letterSpacing: 0.3,
                borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'var(--bg-hover)' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '6px 10px', color: 'var(--text-primary)',
                  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                  maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {cell ?? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>null</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Automatically set initial chart type based on numeric columns if not explicitly set
  // (We use a simple effect to do this once on mount if we want, but doing it in state init is better)
  // For simplicity, we just leave default as 'bar' but they can switch.

  const renderChart = () => {
    let chartContent;
    
    if (chartType === 'pie') {
      chartContent = (
        <PieChart>
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <Pie data={chartData} dataKey={numericCols[0]?.key} nameKey={categoryCol ? categoryCol.key : 'index'} cx="50%" cy="50%" outerRadius={80} fill="var(--purple)" label>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      );
    } else if (chartType === 'area') {
      chartContent = (
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,150,0.15)" vertical={false} />
          <XAxis dataKey={categoryCol ? categoryCol.key : 'index'} stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          {numericCols.map((nc, i) => (
            <Area type="monotone" dataKey={nc.key} fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} key={nc.key} fillOpacity={0.3} />
          ))}
        </AreaChart>
      );
    } else if (chartType === 'line') {
      chartContent = (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,150,0.15)" vertical={false} />
          <XAxis dataKey={categoryCol ? categoryCol.key : 'index'} stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
            itemStyle={{ color: 'var(--text-primary)' }} 
          />
          {numericCols.map((nc, i) => (
            <Line type="monotone" dataKey={nc.key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} key={nc.key} dot={{ r: 3, fill: COLORS[i % COLORS.length] }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      );
    } else {
      chartContent = (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,150,0.15)" vertical={false} />
          <XAxis dataKey={categoryCol ? categoryCol.key : 'index'} stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            cursor={{ fill: 'var(--bg-hover)' }}
          />
          {numericCols.map((nc, i) => (
            <Bar key={nc.key} dataKey={nc.key} fill={COLORS[i % COLORS.length]} radius={[4,4,0,0]} />
          ))}
        </BarChart>
      );
    }

    return (
      <div style={{ width: '100%', marginTop: 10, background: 'var(--bg-card)', padding: '16px 16px 4px 0', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ paddingLeft: 16, marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['bar', 'line', 'area', 'pie'] as const).map(type => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              style={{
                padding: '3px 10px', fontSize: 10, fontWeight: 600, borderRadius: 12, border: '1px solid var(--border)',
                background: chartType === type ? 'var(--purple)' : 'transparent',
                color: chartType === type ? '#fff' : 'var(--text-muted)', cursor: 'pointer',
                transition: 'all 0.2s', textTransform: 'capitalize'
              }}
            >
              {type}
            </button>
          ))}
        </div>
        <div style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartContent}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-table" style={{ fontSize: 11, color: 'var(--purple)' }} />
          Query result — {row_count} row{row_count !== 1 ? 's' : ''}
        </div>
        {canChart && (
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-deep)', padding: 3, borderRadius: 6, border: '1px solid var(--border)' }}>
            <button 
              onClick={() => setViewMode('table')} 
              style={{ padding: '3px 10px', fontSize: 10, fontWeight: 600, borderRadius: 4, background: viewMode === 'table' ? 'var(--bg-hover)' : 'transparent', color: viewMode === 'table' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <i className="ti ti-table" style={{ marginRight: 4 }} /> Table
            </button>
            <button 
              onClick={() => setViewMode('chart')} 
              style={{ padding: '3px 10px', fontSize: 10, fontWeight: 600, borderRadius: 4, background: viewMode === 'chart' ? 'var(--bg-hover)' : 'transparent', color: viewMode === 'chart' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <i className="ti ti-chart-bar" style={{ marginRight: 4 }} /> Chart
            </button>
          </div>
        )}
      </div>
      {viewMode === 'chart' && canChart ? renderChart() : renderTable()}
    </div>
  );
}

export default function MessageBubble({ role, content, queryResult }: Props) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);
  const { speak, stop, isSpeaking, supported } = useTextToSpeech();
  const { language } = useChat();

  const langCode = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-IN';
  
  // Strip out JSON blocks from assistant messages so they don't render empty boxes
  const displayContent = isUser ? content : content.replace(/```(?:json)?[\s\S]*?```/g, '').trim();

  const copyText = () => {
    navigator.clipboard.writeText(displayContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const CopyBtn = ({ leftPos }: { leftPos?: number }) => (
    <button
      onClick={copyText}
      title="Copy"
      style={{
        width: 22, height: 22, borderRadius: 6,
        background: copied ? 'rgba(37,99,235,0.1)' : 'transparent',
        border: '1px solid transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: copied ? 'var(--purple-dark)' : 'var(--text-muted)', fontSize: 11,
        transition: 'all 0.2s ease', opacity: 0.6,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-bright)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
    >
      <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} />
    </button>
  );

  return (
    <div className="fade-up msg-bubble" style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800,
        background: isUser ? 'var(--bg-hover)' : 'linear-gradient(135deg,var(--purple-light),var(--purple))',
        color: isUser ? 'var(--purple-dark)' : '#fff',
        boxShadow: isUser ? 'none' : '0 3px 12px rgba(37,99,235,0.2)',
        border: isUser ? '1px solid var(--border-bright)' : 'none',
      }}>
        {isUser ? 'U' : '₳'}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%', position: 'relative' }}>
        <div style={{
          padding: '11px 15px',
          borderRadius: isUser ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
          fontSize: 13, lineHeight: 1.7,
          background: isUser ? 'rgba(37,99,235,0.05)' : 'var(--bg-card)',
          border: isUser ? '1px solid rgba(37,99,235,0.1)' : '1px solid var(--border)',
          color: isUser ? 'var(--purple-dark)' : 'var(--text-primary)',
          boxShadow: isUser ? '0 3px 12px rgba(37,99,235,0.05)' : '0 3px 12px rgba(0,0,0,0.05)',
        }}>
          {isUser ? (
            <span style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</span>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({node, ...props}) => (
                    <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', marginBottom: '10px' }}>
                      <table {...props} />
                    </div>
                  )
                }}
              >
                {displayContent}
              </ReactMarkdown>
              {queryResult && <QueryDataViewer result={queryResult} />}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {isUser ? (
           <div style={{ position: 'absolute', top: 6, left: -30, display: 'flex', gap: 4 }}>
             <CopyBtn />
           </div>
        ) : (
          <div style={{ position: 'absolute', top: 6, right: supported ? -60 : -30, display: 'flex', gap: 4 }}>
            {supported && (
              <button
                onClick={() => {
                  if (isSpeaking) stop();
                  else speak(displayContent, langCode);
                }}
                title={isSpeaking ? 'Stop reading' : 'Read aloud'}
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: isSpeaking ? 'rgba(37,99,235,0.1)' : 'transparent',
                  border: '1px solid transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isSpeaking ? 'var(--purple-dark)' : 'var(--text-muted)', fontSize: 11,
                  transition: 'all 0.2s ease', opacity: 0.6,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-bright)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
              >
                <i className={`ti ${isSpeaking ? 'ti-player-stop' : 'ti-volume'}`} />
              </button>
            )}
            <CopyBtn />
          </div>
        )}
      </div>
    </div>
  );
}
