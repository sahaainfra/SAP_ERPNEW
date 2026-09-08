import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, Package, Users, Building2, X } from 'lucide-react';
import { useStore, useNav } from '../store';
import { MATERIALS, PARTNERS } from '../engine/config';
import type { PageId } from '../store';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface SearchResult {
  type: 'PAGE' | 'DOCUMENT' | 'MATERIAL' | 'PARTNER' | 'COMMAND';
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  action: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { state, run } = useStore();
  const { go } = useNav();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Search results
  const results: SearchResult[] = [];

  // Command mode
  if (query.startsWith('/')) {
    const cmd = query.slice(1).toLowerCase();
    const commands = [
      { cmd: 'new po', label: 'Create Purchase Order', action: () => go('procurement') },
      { cmd: 'new dpr', label: 'Create Daily Progress Report', action: () => go('cockpit') },
      { cmd: 'new pr', label: 'Create Purchase Requisition', action: () => go('procurement') },
      { cmd: 'stock', label: 'View Stock Ledger', action: () => go('inventory') },
      { cmd: 'approvals', label: 'View Pending Approvals', action: () => go('cockpit') },
      { cmd: 'goto nh', label: 'Go to NH-47 Project', action: () => go('cockpit') },
    ];
    
    commands
      .filter((c) => c.cmd.includes(cmd))
      .forEach((c) => {
        results.push({
          type: 'COMMAND',
          id: c.cmd,
          title: c.label,
          subtitle: `/${c.cmd}`,
          icon: Search,
          action: c.action,
        });
      });
  } else {
    // Page navigation
    const pages: { id: PageId; label: string; icon: any }[] = [
      { id: 'launchpad', label: 'Launchpad', icon: Building2 },
      { id: 'cockpit', label: 'Operations Cockpit', icon: Building2 },
      { id: 'structure', label: 'Enterprise Structure', icon: Building2 },
      { id: 'masters', label: 'Master Data', icon: Package },
      { id: 'procurement', label: 'Procurement', icon: FileText },
      { id: 'inventory', label: 'Inventory & Stock', icon: Package },
      { id: 'plant', label: 'Plant & Machinery', icon: Building2 },
      { id: 'quality', label: 'Quality Management', icon: FileText },
      { id: 'simulator', label: 'Posting Simulator', icon: FileText },
      { id: 'config', label: 'Configuration', icon: Building2 },
      { id: 'audit', label: 'Audit & Control', icon: FileText },
    ];

    pages
      .filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
      .forEach((p) => {
        results.push({
          type: 'PAGE',
          id: p.id,
          title: p.label,
          subtitle: 'Navigate to page',
          icon: p.icon,
          action: () => go(p.id),
        });
      });

    // Document search
    if (query.length > 2) {
      state.docs
        .filter((d) => d.number?.toLowerCase().includes(query.toLowerCase()) || d.type.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5)
        .forEach((d) => {
          results.push({
            type: 'DOCUMENT',
            id: d.id,
            title: d.number || d.type,
            subtitle: `${d.type} · ${d.status}`,
            icon: FileText,
            action: () => {
              // TODO: Open document detail
              console.log('Open document:', d.id);
            },
          });
        });

      // Material search
      MATERIALS
        .filter((m) => m.code.toLowerCase().includes(query.toLowerCase()) || m.desc.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5)
        .forEach((m) => {
          results.push({
            type: 'MATERIAL',
            id: m.code,
            title: m.code,
            subtitle: m.desc,
            icon: Package,
            action: () => {
              // TODO: Open material detail
              console.log('Open material:', m.code);
            },
          });
        });

      // Partner search
      PARTNERS
        .filter((p) => p.id.toLowerCase().includes(query.toLowerCase()) || p.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5)
        .forEach((p) => {
          results.push({
            type: 'PARTNER',
            id: p.id,
            title: p.name,
            subtitle: `${p.roles.join(', ')} · ${p.id}`,
            icon: Users,
            action: () => {
              // TODO: Open partner detail
              console.log('Open partner:', p.id);
            },
          });
        });
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      results[selectedIndex].action();
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/50 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[600px] max-w-[90vw] max-h-[70vh] bg-panel rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
              <Search size={18} className="text-mute shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search or type a command (/)..."
                className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-mute"
              />
              <button onClick={onClose} className="text-mute hover:text-ink transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center text-mute text-[13px]">
                  {query.length === 0 ? 'Start typing to search...' : 'No results found'}
                </div>
              ) : (
                <div className="py-2">
                  {results.map((result, i) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        result.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                        i === selectedIndex ? 'bg-acc-soft' : 'hover:bg-paper'
                      }`}
                    >
                      <result.icon size={16} className="text-mute shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-[11px] text-mute truncate">{result.subtitle}</div>
                        )}
                      </div>
                      <div className="text-[10px] text-mute font-mono shrink-0">
                        {result.type}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-line flex items-center gap-4 text-[10px] text-mute font-mono">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>esc Close</span>
              <span className="ml-auto">Type / for commands</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
