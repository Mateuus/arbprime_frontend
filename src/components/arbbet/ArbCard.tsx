'use client';
import { SurebetData, SurebetOdd } from '@/interfaces/arbitragem.interface';
import { Calendar, Clock, Edit, Trash2 } from 'lucide-react';
import { format, isBefore, differenceInHours, differenceInMinutes, parseISO, isValid } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { capitalizeFirstLetter, getMarketName } from '@/utils/functions';
import { RenderPriceWithHistory } from './components/renderPriceWithHistory';
import Link from 'next/link';

interface Props {
  data: SurebetData;
  selected: boolean;
  onSelect?: () => void;
}

export default function ArbCard({ data, selected, onSelect }: Props) {
  if (!data || !data.surebets || data.surebets.length === 0) return null;

  const surebet = data.surebets[0]; // Sempre usando o primeiro (já filtrado na chamada)

  return (
    <div className="overflow-hidden shadow-sm text-sm">
      {/* Top Bar */}
      <div
        className={`
          flex items-center justify-between bg-slate-500 text-white font-semibold px-2 py-1 relative cursor-pointer
          ${selected ? 'bg-[repeating-linear-gradient(45deg,#92c5e6_0px,#92c5e6_10px,#a7d3f1_10px,#a7d3f1_20px)]' : ''}
        `}
        onClick={(e) => {
          // Impede que botões internos disparem seleção
          const target = e.target as HTMLElement;
          if (target.tagName !== 'BUTTON') {
            onSelect?.();
          }
        }}
      >
        {/* Profit */}
        <div className="bg-[#9adb52] text-black px-2 h-full flex items-center font-bold absolute left-0 top-0 bottom-0">
          {(surebet.profitMargin * 1).toFixed(2)}%
        </div>

        {/* Sport */}
        <div className="ml-[70px] flex items-center gap-1">
          {capitalizeFirstLetter(data.sport)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 text-xs text-gray-800">
          <Calendar size={14} />
          {formatTime2(data.date)}
          <Clock size={14} />
          {formatAge(surebet.create_at)}
          <button type="button">
            <Trash2 size={14} className="hover:text-red-500" />
          </button>
          <button type="button">
            <Edit size={14} className="hover:text-blue-400" />
          </button>
        </div>
      </div>

      {/* Body - Lista de apostas da surebet */}
        <div className="bg-[#f9f9f9] text-black text-xs">
            {surebet.surebet.map((odd: SurebetOdd, idx) => (
                <div
                key={idx}
                className="flex justify-between items-start px-2 py-1 border-b border-gray-200"
                >
                <div className="flex flex-col w-[20%]">
                    <span className="font-bold text-[13px]">{odd.bookmaker}</span>
                </div>
                <div className="flex-1 text-left">
                    <Link
                      href={`${odd.link}`}
                      className="block text-blue-500 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {data.home} x {data.away}
                    </Link>
                    <span className="text-gray-500">{data.league}</span>
                </div>
                <div className="flex flex-col text-right">
                    <span className="text-green-600 font-semibold"><RenderPriceWithHistory odd={odd} /></span>
                    <span className="text-gray-600">{getMarketName(odd.market)}: {odd.option}</span>
                </div>
                </div>
            ))}
        </div>
    </div>
  );
}

export function formatTime2(dateString: string) {
  const utcDate = new Date(dateString);
  const gmtDate = utcDate.setHours(utcDate.getHours() + 3);

  return format(gmtDate, 'dd/MM HH:mm');
}

export function formatTime(dateString: string) {
  const timeZone = 'America/Sao_Paulo'; // GMT-3
  const eventDate = toZonedTime(dateString, timeZone);
  const utcDate = new Date();
  const gmtDate = utcDate.setHours(utcDate.getHours() - 3); // GMT-3 //TEMP FIX

  if (isBefore(eventDate, utcDate)) {
    return `${eventDate.toISOString()} - ${gmtDate}`;
  }

  const diffHours = differenceInHours(eventDate, utcDate);
  const diffMinutes = differenceInMinutes(eventDate, utcDate);

  if (diffHours >= 24) {
    return format(eventDate, 'dd/MM HH:mm');
  }

  if (diffHours >= 1) {
    return `${diffHours} h`;
  }

  return `${diffMinutes} min`;
}

export function formatAge(dateString: string): string {
  if (!dateString) return '-';
  
  const date = parseISO(dateString);
  if (!isValid(date)) return '-';

  const now = new Date();
  const diffMinutes = differenceInMinutes(now, date);
  const diffHours = differenceInHours(now, date);

  if (diffHours >= 24) {
    return format(date, 'dd/MM HH:mm'); // Ex: 25/03 14:00
  }

  if (diffHours >= 1) {
    return `${diffHours} h`;
  }

  return `${diffMinutes} min`;
}