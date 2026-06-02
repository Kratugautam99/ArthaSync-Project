'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { QueryResultAttachment } from '@/context/ChatContext';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  queryResult?: QueryResultAttachment;
}

function QueryTable({ result }: { result: QueryResultAttachment }) {
  const { columns, rows, row_count, message } = result;

  if (!columns.length && !rows.length) {
    return (
      <div style={{ marginTop: 10, padding: '8px 12px', background: '#0c0b18', border: '1px solid #1e1b3a', borderRadius: 8, fontSize: 12, color: '#6c6a8a' }}>
        {message ?? 'Query returned no rows.'}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        fontSize: 10, color: '#444260', letterSpacing: 1, textTransform: 'uppercase',
        marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <i className="ti ti-table" style={{ fontSize: 11, color: '#7c5cfc' }} />
        Query result — {row_count} row{row_count !== 1 ? 's' : ''}
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #1e1b3a' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#13112a' }}>
              {columns.map(col => (
                <th key={col} style={{
                  padding: '7px 10px', textAlign: 'left',
                  color: '#7c5cfc', fontWeight: 600, letterSpacing: 0.3,
                  borderBottom: '1px solid #1e1b3a', whiteSpace: 'nowrap',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                style={{ background: ri % 2 === 0 ? 'transparent' : '#0c0b1899' }}
              >
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '6px 10px', color: '#c8c6e8',
                    borderBottom: '1px solid #1e1b3a22', whiteSpace: 'nowrap',
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {cell ?? <span style={{ color: '#444260', fontStyle: 'italic' }}>null</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MessageBubble({ role, content, queryResult }: Props) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);

  const copyText = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
        background: isUser ? '#1e1b3a' : 'linear-gradient(135deg,#7c5cfc,#00d4aa)',
        color: isUser ? '#a08fff' : '#fff',
        boxShadow: isUser ? 'none' : '0 3px 12px #7c5cfc33',
        border: isUser ? '1px solid #2e2b5a' : 'none',
      }}>
        {isUser ? 'U' : '₳'}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%', position: 'relative' }}>
        <div style={{
          padding: '11px 15px',
          borderRadius: isUser ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
          fontSize: 13, lineHeight: 1.7,
          background: isUser ? 'linear-gradient(135deg,#7c5cfc22,#5a3ee810)' : '#13112a',
          border: isUser ? '1px solid #7c5cfc44' : '1px solid #1e1b3a',
          color: isUser ? '#d4caff' : '#c8c6e8',
          boxShadow: isUser ? '0 3px 12px #7c5cfc15' : '0 3px 12px rgba(0,0,0,0.25)',
        }}>
          {isUser ? (
            <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown>{content}</ReactMarkdown>
              {queryResult && <QueryTable result={queryResult} />}
            </div>
          )}
        </div>

        {/* Copy button (assistant only) */}
        {!isUser && (
          <button
            onClick={copyText}
            title="Copy"
            style={{
              position: 'absolute', top: 6, right: -30,
              width: 22, height: 22, borderRadius: 6,
              background: copied ? '#7c5cfc22' : 'transparent',
              border: '1px solid transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: copied ? '#a08fff' : '#333260', fontSize: 11,
              transition: 'all 0.2s ease', opacity: 0.6,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2b5a'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
          >
            <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} />
          </button>
        )}
      </div>
    </div>
  );
}
