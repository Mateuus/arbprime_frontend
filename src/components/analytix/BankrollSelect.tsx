import React from 'react';
import { BankrollDTO } from '@/gateways/api.gateway';
import { Select } from '@/components/ui/Select';
import { BRL } from './format';

interface Props {
  bankrolls: BankrollDTO[];
  selectedId: string;
  onChange: (id: string) => void;
  includeAll?: boolean;
  className?: string;
}

/** Seletor de banca estilizado (com opção "Todas as bancas"). */
export default function BankrollSelect({ bankrolls, selectedId, onChange, includeAll = true, className = '' }: Props) {
  const options = [
    ...(includeAll ? [{ value: '', label: 'Todas as bancas' }] : []),
    ...bankrolls.map((b) => ({ value: b.id, label: `${b.name} — ${BRL(b.currentBalance)}` })),
  ];
  return (
    <Select
      value={selectedId}
      onChange={onChange}
      options={options}
      placeholder="Banca"
      className={className || 'min-w-[180px]'}
      buttonClassName="bg-black/20 py-1.5"
    />
  );
}
