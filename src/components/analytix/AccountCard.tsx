import React from 'react';
import { Pencil, Trash2, ArrowDownUp, AlertTriangle, Users, Wallet } from 'lucide-react';
import { AccountDTO } from '@/gateways/api.gateway';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { useBookmakers } from '@/hooks/useBookmakers';
import { BRL, profitColor, accountDisplay } from './format';

interface Props {
  account: AccountDTO;
  onEdit: (a: AccountDTO) => void;
  onDelete: (a: AccountDTO) => void;
  onTransaction: (a: AccountDTO) => void;
}

/** Card de uma casa do usuário com saldo calculado. */
export default function AccountCard({ account, onEdit, onDelete, onTransaction }: Props) {
  const { getBookmaker } = useBookmakers();
  const disp = accountDisplay(account, getBookmaker(account.slug));
  const name = disp.name;
  const delta = account.balance - account.initialBalance;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20 transition">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookmakerLogo name={disp.name} slug={account.slug} logoUrl={disp.logoUrl} color={disp.color} size={28} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{name}</div>
            <div className="text-[11px] text-gray-500 truncate">{account.isCustom ? 'Personalizada' : (getBookmaker(account.slug)?.name || account.slug)}</div>
          </div>
        </div>
        {account.limited && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/30 rounded-full px-2 py-0.5 shrink-0">
            <AlertTriangle size={11} /> Limitada
          </span>
        )}
      </div>

      {(account.partnerName || account.bankrollName) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {account.partnerName && (
            <span className="inline-flex items-center gap-1 text-[10px] text-violet-300 bg-violet-500/10 ring-1 ring-violet-500/30 rounded-full px-2 py-0.5">
              <Users size={10} /> {account.partnerName}
            </span>
          )}
          {account.bankrollName && (
            <span className="inline-flex items-center gap-1 text-[10px] text-teal-300 bg-teal-500/10 ring-1 ring-teal-500/30 rounded-full px-2 py-0.5">
              <Wallet size={10} /> {account.bankrollName}
            </span>
          )}
        </div>
      )}

      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-wide text-zinc-400">Saldo atual</div>
        <div className="text-2xl font-semibold tabular-nums text-white">{BRL(account.balance)}</div>
        <div className={`text-xs tabular-nums ${profitColor(delta)}`}>
          {delta >= 0 ? '+' : ''}{BRL(delta)} desde o início
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <button onClick={() => onTransaction(account)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-xs text-gray-200 hover:bg-white/10">
          <ArrowDownUp size={13} /> Movimentar
        </button>
        <button onClick={() => onEdit(account)} className="p-1.5 rounded-lg text-gray-300 hover:bg-white/10 ml-auto"><Pencil size={15} /></button>
        <button onClick={() => onDelete(account)} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/15"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}
