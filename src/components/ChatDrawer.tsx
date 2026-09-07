import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, Lock, Hash } from 'lucide-react';
import { useStore } from '../store';
import { sendChat, setLegalHold } from '../engine/platform';
import { userById } from '../engine/engine';

export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, run } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const listEndRef = useRef<HTMLDivElement>(null);

  const convs = useMemo(
    () => [...state.conversations].sort((a, b) => {
      const aLast = a.messages?.[a.messages.length - 1]?.at ?? '';
      const bLast = b.messages?.[b.messages.length - 1]?.at ?? '';
      return bLast.localeCompare(aLast);
    }),
    [state.conversations],
  );
  const active = convs.find((c) => c.id === sel) ?? convs[0];

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [active?.messages?.length, open, sel]);

  const send = () => {
    if (!active || !draft.trim()) return;
    run((s) => sendChat(s, active.id, draft, s.userId));
    setDraft('');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-ink/30 z-40" onClick={onClose} />
          <motion.aside
            initial={{ x: 380, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 380, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 w-[360px] max-w-[92vw] bg-panel border-l border-line z-50 flex flex-col shadow-2xl"
          >
            <div className="hazard h-[4px] shrink-0" />
            <div className="px-4 py-3 border-b border-line flex items-center gap-2.5 shrink-0">
              <span className="w-8 h-8 rounded-lg bg-side grid place-items-center text-acc"><MessageSquare size={16} /></span>
              <div className="flex-1 min-w-0">
                <div className="font-disp font-extrabold text-[14px] tracking-tight leading-none">Record-bound threads</div>
                <div className="text-[10.5px] text-mute mt-1">Every discussion attaches to the document it concerns — searchable, auditable, never lost in a chat app.</div>
              </div>
              <button className="btn btn-sm" onClick={onClose}><X size={13} /></button>
            </div>

            <div className="flex-1 flex min-h-0">
              {/* thread list */}
              <div className="w-[128px] shrink-0 border-r border-line overflow-y-auto bg-paper/50">
                {convs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSel(c.id)}
                    className={`w-full text-left px-2.5 py-2 border-b border-line/70 transition-colors ${active?.id === c.id ? 'bg-acc-soft shadow-[inset_2.5px_0_0_var(--color-acc)]' : 'hover:bg-white'}`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="chip !py-0 !px-1 !text-[8.5px] !tracking-normal">{c.module}</span>
                      {c.legalHold && <Lock size={9} className="text-warn" />}
                    </div>
                    <div className="font-mono text-[10px] font-semibold mt-1 truncate">{c.refNumber ?? c.refType}</div>
                    <div className="text-[9.5px] text-mute truncate">{c.messages?.length ?? 0} msgs</div>
                  </button>
                ))}
                {convs.length === 0 && <div className="p-3 text-[10.5px] text-mute">Threads open automatically when documents are submitted.</div>}
              </div>

              {/* messages */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="px-3 py-2 border-b border-line flex items-center gap-2 shrink-0">
                  <Hash size={12} className="text-acc" />
                  <span className="font-mono text-[11px] font-bold truncate">{active?.title ?? '—'}</span>
                  {active && (
                    <button
                      className="btn btn-sm ml-auto !px-1.5 !py-1"
                      title={active.legalHold ? 'Release legal hold' : 'Apply legal hold'}
                      onClick={() => run((s) => setLegalHold(s, active.id, !active.legalHold, s.userId))}
                    >
                      <Lock size={11} className={active.legalHold ? 'text-warn' : 'text-mute'} />
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
                  {active?.messages?.map((m) => {
                    const mine = m.user === state.userId;
                    const u = m.system ? null : userById(m.user);
                    return m.system ? (
                      <div key={m.id} className="font-mono text-[10px] text-mute border-l-2 border-acc/50 pl-2 py-0.5 leading-relaxed">
                        <span className="text-acc/80 font-bold">SYSTEM</span> · {m.at.slice(11)} — {m.text}
                      </div>
                    ) : (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11.5px] leading-snug ${mine ? 'bg-side text-white rounded-br-sm' : 'bg-paper border border-line rounded-bl-sm'}`}>
                          {!mine && <span className="block text-[9.5px] font-bold font-mono mb-0.5" style={{ color: u?.color }}>{u?.name}</span>}
                          {m.text}
                          <span className={`block text-[8.5px] font-mono mt-0.5 ${mine ? 'text-white/50' : 'text-mute'}`}>{m.at.slice(11)}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={listEndRef} />
                </div>
                <div className="p-2.5 border-t border-line shrink-0">
                  <div className="flex gap-1.5">
                    <input
                      className="inp !py-1.5 !text-[12px]"
                      placeholder={active?.legalHold ? 'Legal hold — deletions blocked, posting allowed' : 'Message this thread…'}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && send()}
                    />
                    <button className="btn btn-acc !px-2.5" onClick={send} disabled={!draft.trim()}><Send size={13} /></button>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
