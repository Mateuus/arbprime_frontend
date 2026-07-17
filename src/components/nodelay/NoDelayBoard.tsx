import { useState } from 'react';
import { LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';
import { maxStakeOf } from '@/services/nodelay/maxStake';
import { selectionLabel, fmtOdd, fmtMaxStake } from '@/utils/nodelayLive';
import { useNoDelayBoard, marketKeyOf, BoardColumn } from '@/hooks/useNoDelayBoard';
import { Lock, Plus, Trash2, GripVertical, ChevronLeft, ChevronRight, X, Check, FolderInput } from 'lucide-react';

/**
 * Quadro estilo Trello da Aposta Rápida: colunas nomeadas (o cabeçalho é o "card
 * de título", ex.: "Somente 1º Tempo") e cards de mercado que o usuário ARRASTA
 * entre colunas. Salvo por MarketTypeId (chave estável) via useNoDelayBoard —
 * o mercado reaparece no mesmo lugar em qualquer jogo. Desktop = drag nativo;
 * toque/mobile = menu "mover para". Só entram os mercados apostáveis agora.
 */
interface Props {
  markets: LiveMarket[]; // favoritos apostáveis agora (o QuickBet já filtra)
  changed: Set<string>;
  k?: number | null;
  onFire: (m: LiveMarket, s: LiveSelection) => void;
}

const gridCols = (n: number): number => (n % 3 === 0 ? 3 : n % 2 === 0 ? 2 : n <= 3 ? n : 3);

export function NoDelayBoard({ markets, changed, k, onFire }: Props) {
  const board = useNoDelayBoard();
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null); // marketKey com menu "mover" aberto

  const byKey = new Map(markets.map((m) => [marketKeyOf(m), m]));
  const assignedKeys = new Set(board.columns.flatMap((c) => c.keys));
  // Mercado favoritado ainda sem coluna → cai na 1ª coluna até ser arrastado.
  const unassigned = markets.filter((m) => !assignedKeys.has(marketKeyOf(m)));

  const marketsOf = (col: BoardColumn, idx: number): LiveMarket[] => {
    const assigned = col.keys.map((key) => byKey.get(key)).filter((m): m is LiveMarket => !!m);
    return idx === 0 ? [...assigned, ...unassigned] : assigned;
  };

  const drop = (colId: string) => {
    if (dragKey) board.assign(dragKey, colId);
    setDragKey(null);
    setOverCol(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {board.columns.map((col, idx) => (
        <Column
          key={col.id}
          col={col}
          idx={idx}
          total={board.columns.length}
          markets={marketsOf(col, idx)}
          changed={changed}
          k={k}
          onFire={onFire}
          over={overCol === col.id}
          onDragOverCol={() => setOverCol(col.id)}
          onDropCol={() => drop(col.id)}
          onDragStartCard={setDragKey}
          onDragEndCard={() => { setDragKey(null); setOverCol(null); }}
          menuColumns={board.columns}
          menuFor={menuFor}
          setMenuFor={setMenuFor}
          onMove={(key, toCol) => { board.assign(key, toCol); setMenuFor(null); }}
          onRemoveCard={(key) => { board.unassign(key); setMenuFor(null); }}
          onRename={(name) => board.renameColumn(col.id, name)}
          onDelete={() => board.removeColumn(col.id)}
          onMoveCol={(dir) => board.moveColumn(col.id, dir)}
        />
      ))}

      {/* Nova coluna */}
      <AddColumn onAdd={board.addColumn} />
    </div>
  );
}

function Column({
  col, idx, total, markets, changed, k, onFire, over, onDragOverCol, onDropCol,
  onDragStartCard, onDragEndCard, menuColumns, menuFor, setMenuFor, onMove, onRemoveCard,
  onRename, onDelete, onMoveCol,
}: {
  col: BoardColumn; idx: number; total: number; markets: LiveMarket[];
  changed: Set<string>; k?: number | null; onFire: Props['onFire'];
  over: boolean; onDragOverCol: () => void; onDropCol: () => void;
  onDragStartCard: (key: string) => void; onDragEndCard: () => void;
  menuColumns: BoardColumn[]; menuFor: string | null; setMenuFor: (k: string | null) => void;
  onMove: (key: string, toCol: string) => void; onRemoveCard: (key: string) => void;
  onRename: (name: string) => void; onDelete: () => void; onMoveCol: (dir: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(col.name);

  const saveName = () => {
    setEditing(false);
    const v = name.trim();
    if (v && v !== col.name) onRename(v); else setName(col.name);
  };

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-white/[0.02] transition ${over ? 'border-lime-500/60 bg-lime-500/[0.06]' : 'border-white/10'}`}
      onDragOver={(e) => { e.preventDefault(); onDragOverCol(); }}
      onDrop={(e) => { e.preventDefault(); onDropCol(); }}
    >
      {/* Cabeçalho = card de título editável */}
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
        {editing ? (
          <input
            value={name} autoFocus
            onChange={(e) => setName(e.target.value)} onBlur={saveName}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setName(col.name); setEditing(false); } }}
            className="min-w-0 flex-1 rounded bg-black/40 px-1.5 py-0.5 text-xs font-bold text-white ring-1 ring-lime-500/40 focus:outline-none"
          />
        ) : (
          <button onClick={() => { setName(col.name); setEditing(true); }} className="min-w-0 flex-1 truncate text-left text-xs font-bold text-white hover:text-lime-200" title="Renomear coluna">
            {col.name} <span className="ml-1 text-[10px] font-normal text-gray-500">{markets.length}</span>
          </button>
        )}
        {editing ? (
          <button onMouseDown={(e) => e.preventDefault()} onClick={saveName} className="grid h-6 w-6 place-items-center rounded text-lime-300 hover:bg-white/10"><Check size={13} /></button>
        ) : (
          <>
            <button onClick={() => onMoveCol(-1)} disabled={idx === 0} className="grid h-6 w-6 place-items-center rounded text-gray-500 hover:bg-white/10 hover:text-gray-200 disabled:opacity-30" title="Mover coluna p/ esquerda"><ChevronLeft size={13} /></button>
            <button onClick={() => onMoveCol(1)} disabled={idx === total - 1} className="grid h-6 w-6 place-items-center rounded text-gray-500 hover:bg-white/10 hover:text-gray-200 disabled:opacity-30" title="Mover coluna p/ direita"><ChevronRight size={13} /></button>
            <button onClick={() => { if (window.confirm(`Remover a coluna "${col.name}"? Os mercados voltam ao pool.`)) onDelete(); }} className="grid h-6 w-6 place-items-center rounded text-gray-500 hover:bg-rose-500/20 hover:text-rose-300" title="Remover coluna"><Trash2 size={12} /></button>
          </>
        )}
      </div>

      {/* Cards de mercado */}
      <div className="flex-1 space-y-2 p-2">
        {markets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 py-6 text-center text-[10px] text-gray-600">
            Arraste mercados para cá
          </div>
        ) : (
          markets.map((m) => (
            <BoardMarketCard
              key={m.id}
              market={m}
              changed={changed}
              k={k}
              onFire={onFire}
              onDragStart={() => onDragStartCard(marketKeyOf(m))}
              onDragEnd={onDragEndCard}
              menuOpen={menuFor === marketKeyOf(m)}
              onToggleMenu={() => setMenuFor(menuFor === marketKeyOf(m) ? null : marketKeyOf(m))}
              columns={menuColumns}
              currentCol={col.id}
              onMove={(toCol) => onMove(marketKeyOf(m), toCol)}
              onRemove={() => onRemoveCard(marketKeyOf(m))}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BoardMarketCard({
  market, changed, k, onFire, onDragStart, onDragEnd, menuOpen, onToggleMenu, columns, currentCol, onMove, onRemove,
}: {
  market: LiveMarket; changed: Set<string>; k?: number | null; onFire: Props['onFire'];
  onDragStart: () => void; onDragEnd: () => void;
  menuOpen: boolean; onToggleMenu: () => void; columns: BoardColumn[]; currentCol: string;
  onMove: (toCol: string) => void; onRemove: () => void;
}) {
  const m = market;
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={`rounded-xl border bg-white/[0.03] ${m.suspended ? 'border-rose-500/40' : 'border-white/10'}`}
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        <GripVertical size={13} className="shrink-0 cursor-grab text-gray-600" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-gray-200">{m.name}</span>
        {m.suspended && <Lock size={11} className="shrink-0 text-rose-400" />}
        {/* Menu "mover para" — funciona no toque (mobile) */}
        <div className="relative">
          <button onClick={onToggleMenu} className="grid h-5 w-5 place-items-center rounded text-gray-500 hover:bg-white/10 hover:text-gray-200" title="Mover para coluna"><FolderInput size={12} /></button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-20 w-40 rounded-lg border border-white/10 bg-brand-dark p-1 shadow-2xl">
              <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-gray-500">Mover para</div>
              {columns.filter((c) => c.id !== currentCol).map((c) => (
                <button key={c.id} onClick={() => onMove(c.id)} className="block w-full truncate rounded px-2 py-1.5 text-left text-[11px] text-gray-200 hover:bg-white/10">{c.name}</button>
              ))}
              <button onClick={onRemove} className="mt-0.5 flex w-full items-center gap-1.5 rounded border-t border-white/5 px-2 py-1.5 text-left text-[11px] text-rose-300 hover:bg-rose-500/10"><X size={11} /> Tirar do quadro</button>
            </div>
          )}
        </div>
      </div>

      <div className="px-2 pb-2">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${gridCols(m.selections.length)}, minmax(0,1fr))` }}>
          {m.selections.map((s) => {
            const susp = m.suspended;
            const dead = susp || s.disabled || s.price <= 0;
            const flash = changed.has(s.id);
            const msRaw = !dead && k ? maxStakeOf(s, m, k) : null;
            const ms = msRaw != null && msRaw >= 1 ? msRaw : null;
            return (
              <button
                key={s.id}
                disabled={dead}
                onClick={() => onFire(m, s)}
                className={`flex flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left ring-1 transition ${
                  susp
                    ? 'cursor-not-allowed bg-rose-500/10 ring-rose-500/30'
                    : dead
                      ? 'cursor-not-allowed bg-black/20 text-gray-600 ring-white/5'
                      : flash
                        ? 'bg-lime-500/30 ring-lime-400/70'
                        : 'bg-black/25 ring-white/10 hover:bg-lime-500/15 hover:ring-lime-500/40 active:scale-[0.98]'
                }`}
              >
                <span className={`w-full truncate text-[10px] ${susp ? 'text-rose-300/80' : 'text-gray-300'}`}>{selectionLabel(s.name, s.points)}</span>
                <span className="flex w-full items-center justify-between gap-1">
                  <span className="text-sm font-bold tabular-nums text-white">
                    {susp ? <Lock size={13} className="text-rose-400" /> : dead ? '—' : fmtOdd(s.price)}
                  </span>
                  {ms != null && ms > 0 && (
                    <span className="rounded bg-lime-500/10 px-1 py-px text-[8.5px] font-bold tabular-nums text-lime-300/90 ring-1 ring-lime-500/25">
                      máx {fmtMaxStake(ms)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AddColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const save = () => { const v = name.trim(); if (v) onAdd(v); setName(''); setAdding(false); };
  return (
    <div className="w-56 shrink-0">
      {adding ? (
        <div className="rounded-xl border border-lime-500/40 bg-white/[0.03] p-2">
          <input
            value={name} autoFocus placeholder="Ex.: Somente 1º Tempo"
            onChange={(e) => setName(e.target.value)} onBlur={() => { if (!name.trim()) setAdding(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setName(''); setAdding(false); } }}
            className="w-full rounded bg-black/40 px-2 py-1.5 text-xs text-white ring-1 ring-lime-500/40 focus:outline-none"
          />
          <button onClick={save} className="mt-1.5 w-full rounded-lg bg-lime-500 py-1.5 text-[11px] font-bold text-slate-900 hover:bg-lime-400">Criar coluna</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-3 text-xs font-medium text-gray-400 transition hover:border-lime-500/40 hover:text-lime-300">
          <Plus size={14} /> Nova coluna
        </button>
      )}
    </div>
  );
}
