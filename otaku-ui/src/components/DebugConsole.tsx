import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'log' | 'error' | 'warn';
  message: string;
}

declare global {
  interface Window {
    __OTAKU_LOGS__: LogEntry[];
    __OTAKU_LOG_LISTENERS__: ((log: LogEntry) => void)[];
    __ORIGINAL_CONSOLE_LOG__?: (...args: any[]) => void;
    __ORIGINAL_CONSOLE_ERROR__?: (...args: any[]) => void;
    __ORIGINAL_CONSOLE_WARN__?: (...args: any[]) => void;
  }
}

window.__OTAKU_LOGS__ = window.__OTAKU_LOGS__ || [];
window.__OTAKU_LOG_LISTENERS__ = window.__OTAKU_LOG_LISTENERS__ || [];

if (!window.__ORIGINAL_CONSOLE_LOG__) {
  window.__ORIGINAL_CONSOLE_LOG__ = console.log;
  window.__ORIGINAL_CONSOLE_ERROR__ = console.error;
  window.__ORIGINAL_CONSOLE_WARN__ = console.warn;

  const addLog = (type: 'log' | 'error' | 'warn', ...args: any[]) => {
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return arg.stack || arg.message || String(arg);
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };

    window.__OTAKU_LOGS__.push(entry);
    window.__OTAKU_LOG_LISTENERS__.forEach(listener => listener(entry));
  };

  console.log = (...args: any[]) => {
    window.__ORIGINAL_CONSOLE_LOG__?.(...args);
    addLog('log', ...args);
  };

  console.error = (...args: any[]) => {
    window.__ORIGINAL_CONSOLE_ERROR__?.(...args);
    addLog('error', ...args);
  };

  console.warn = (...args: any[]) => {
    window.__ORIGINAL_CONSOLE_WARN__?.(...args);
    addLog('warn', ...args);
  };
}

const DebugConsole: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'log' | 'error' | 'warn'>('all');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs([...window.__OTAKU_LOGS__]);

    const listener = (entry: LogEntry) => {
      setLogs(prev => [...prev, entry]);
    };

    window.__OTAKU_LOG_LISTENERS__.push(listener);

    return () => {
      window.__OTAKU_LOG_LISTENERS__ = window.__OTAKU_LOG_LISTENERS__.filter(l => l !== listener);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const clearLogs = () => {
    window.__OTAKU_LOGS__ = [];
    setLogs([]);
  };

  const filteredLogs = logs.filter(l => filter === 'all' ? true : l.type === filter);

  const content = (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{ zIndex: 999999, position: 'fixed', bottom: '120px', right: '16px', backgroundColor: '#0f172a', color: '#f48fb1', border: '2px solid #c2185b', padding: '12px 20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 0 25px rgba(194,24,91,0.8)', cursor: 'pointer' }}
        className="hover:scale-105 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-lg animate-pulse" style={{ color: '#c2185b' }}>terminal</span>
        <span>Terminal ({logs.length})</span>
      </button>

      {/* Terminal Overlay Modal */}
      {isOpen && (
        <div style={{ zIndex: 9999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '1024px', height: '85vh', backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '24px', boxShadow: '0 0 50px rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Terminal Header */}
            <div style={{ backgroundColor: '#0f172a', padding: '12px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#eab308', display: 'inline-block' }}></span>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }}></span>
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#94a3b8', fontWeight: 'bold' }}>Android Web/Native Terminal</span>
              </div>

              {/* Filter Tabs & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', backgroundColor: '#020617', padding: '4px', borderRadius: '12px', border: '1px solid #1e293b', fontSize: '12px', fontFamily: 'monospace' }}>
                  <button onClick={() => setFilter('all')} style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: filter === 'all' ? 'rgba(194,24,91,0.2)' : 'transparent', color: filter === 'all' ? '#f48fb1' : '#94a3b8', border: filter === 'all' ? '1px solid rgba(194,24,91,0.4)' : 'none', cursor: 'pointer' }}>All ({logs.length})</button>
                  <button onClick={() => setFilter('log')} style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: filter === 'log' ? 'rgba(59,130,246,0.2)' : 'transparent', color: filter === 'log' ? '#93c5fd' : '#94a3b8', border: filter === 'log' ? '1px solid rgba(59,130,246,0.4)' : 'none', cursor: 'pointer' }}>Logs</button>
                  <button onClick={() => setFilter('warn')} style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: filter === 'warn' ? 'rgba(234,179,8,0.2)' : 'transparent', color: filter === 'warn' ? '#fde047' : '#94a3b8', border: filter === 'warn' ? '1px solid rgba(234,179,8,0.4)' : 'none', cursor: 'pointer' }}>Warns</button>
                  <button onClick={() => setFilter('error')} style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: filter === 'error' ? 'rgba(239,68,68,0.2)' : 'transparent', color: filter === 'error' ? '#fca5a5' : '#94a3b8', border: filter === 'error' ? '1px solid rgba(239,68,68,0.4)' : 'none', cursor: 'pointer' }}>Errors</button>
                </div>
                <button onClick={clearLogs} style={{ backgroundColor: '#1e293b', color: '#cbd5e1', padding: '6px 14px', borderRadius: '12px', fontSize: '12px', fontFamily: 'monospace', border: 'none', cursor: 'pointer' }}>Clear</button>
                <button onClick={() => setIsOpen(false)} style={{ backgroundColor: '#c2185b', color: '#ffffff', padding: '6px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(194,24,91,0.4)' }}>Close</button>
              </div>
            </div>

            {/* Terminal Body */}
            <div style={{ flex: 1, padding: '16px', fontFamily: 'monospace', fontSize: '12px', overflowY: 'auto', backgroundColor: '#020617', color: '#cbd5e1' }}>
              {filteredLogs.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontStyle: 'italic' }}>No logs captured yet...</div>
              ) : (
                filteredLogs.map(log => (
                  <div key={log.id} style={{ padding: '10px 14px', marginBottom: '8px', borderRadius: '12px', border: log.type === 'error' ? '1px solid rgba(239,68,68,0.3)' : log.type === 'warn' ? '1px solid rgba(234,179,8,0.3)' : '1px solid #1e293b', backgroundColor: log.type === 'error' ? 'rgba(69,10,10,0.2)' : log.type === 'warn' ? 'rgba(66,32,6,0.2)' : 'rgba(15,23,42,0.5)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '10px', opacity: 0.6 }}>
                      <span>[{log.timestamp}]</span>
                      <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: log.type === 'error' ? '#fca5a5' : log.type === 'warn' ? '#fde047' : '#93c5fd' }}>{log.type}</span>
                    </div>
                    <div>{log.message}</div>
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>

            {/* Terminal Footer / Quick Actions */}
            <div style={{ backgroundColor: '#0f172a', padding: '10px 20px', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }}>
              <div>💡 Tip: Open this terminal anytime to inspect background sync & API calls on Android.</div>
              <button onClick={() => {
                console.log('[Terminal] Test log generated manually!');
                console.warn('[Terminal] Test warning!');
                console.error('[Terminal] Test error!');
              }} style={{ background: 'none', border: 'none', color: '#f48fb1', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px' }}>Test Logs</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(content, document.body);
};

export default DebugConsole;
