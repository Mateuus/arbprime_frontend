'use client';
import React, { useEffect, useState } from 'react';
import SportsSidebar from '@/components/arbbet/SportsSidebar';
import SportsArbList from '@/components/arbbet/SportsArbList';
import ArbCalc from '@/components/arbbet/ArbCalc';
import ArbsSelected from '@/components/arbbet/ArbsSelected';
import HeaderTop from '@/components/arbbet/HeaderTop';
import useWebSocket from '@/hooks/useWebSocket';

const ArbitragemEsportivaPage = () => {
  const { dataBet, setAutoUpdate, autoUpdate } = useWebSocket(1);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedId, setSelectedId] = useState<string | number>(0);
  const selectedEvent = dataBet.find((e) => e.id === selectedId) || null;

  const [filters, setFiltersState] = useState({
    arbType: 'live',
    autoUpdate: autoUpdate,
    zoom: '100%',
  });

  const setFilters = (updates: Partial<typeof filters>) => {
    setFiltersState((prev) => ({ ...prev, ...updates }));
  };

    useEffect(() => {
      setAutoUpdate(filters.autoUpdate);
    }, [dataBet, autoUpdate, filters.autoUpdate, setAutoUpdate]);

  return (
    <div className="flex flex-col bg-gray-800 min-h-screen py-3">
      <HeaderTop
        onToggleSidebar={() => setShowSidebar((prev) => !prev)}
        showSidebar={showSidebar}
      />

      <div className="flex flex-1">
        <SportsSidebar
          show={showSidebar}
          filters={filters}
          setFilters={setFilters}
        />

        <main className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr]">
            {/* Lista com o melhor surebet de cada evento */}
            <div className="overflow-y-auto">
              <SportsArbList
                data={dataBet}
                selectedId={selectedId}
                onSelect={(eventId) => setSelectedId(eventId)}
              />
            </div>

            {/* Detalhes do evento selecionado */}
            <div className="flex flex-col h-full gap-1">
              <div className="bg-white text-white shadow-md" style={{ height: '160px' }}>
                {selectedEvent && <ArbCalc data={selectedEvent} />}
              </div>
              <div className="bg-white text-white shadow-md min-h-[500px]">
                <div className="flex-1 overflow-y-auto">
                  <>
                  <ArbsSelected data={selectedEvent} />
                  </>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ArbitragemEsportivaPage;
