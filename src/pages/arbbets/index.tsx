'use client';
import React, { useEffect, useRef, useState } from 'react';
import SportsSidebar from '@/components/arbbet/SportsSidebar';
import SportsArbList from '@/components/arbbet/SportsArbList';
import ArbCalc from '@/components/arbbet/ArbCalc';
import ArbsSelected from '@/components/arbbet/ArbsSelected';
import HeaderTop from '@/components/arbbet/HeaderTop';
import { wsManager } from '@/services/wsManager';

const ArbitragemEsportivaPage = () => {
  
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | number>(0);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [selectedSurebetIndex, setSelectedSurebetIndex] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dataBet, setDataBet] = useState<any[]>([]); // Pode tipar com SurebetData[]

  const [filters, setFiltersState] = useState({
    arbType: 'prematch',
    autoUpdate: true,
    zoom: '100%',
    sortBy: 'Percent',
  });

  const lastArbType = useRef(filters.arbType);

  const setFilters = (updates: Partial<typeof filters>) => {
    setFiltersState((prev) => ({ ...prev, ...updates }));
  };

  const selectedEvent = dataBet.find((e) => e.id === selectedId) || null;

useEffect(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (msg: any) => {
    if (msg.method === 'arbitrage_betting') {
      setDataBet(msg.data || []);
      setLoading(false);
    }
  };

  wsManager.subscribe(handler);

  // Ativa loading APENAS se o arbType mudou
  if (filters.arbType !== lastArbType.current) {
    setLoading(true);
    lastArbType.current = filters.arbType; // atualiza ref
  }

  wsManager.send({
    method: 'arbitrage_betting',
    options: {
      type: filters.arbType,
      autoUpdate: filters.autoUpdate
    }
  });

  return () => wsManager.unsubscribe(handler);
}, [filters.arbType, filters.autoUpdate]);

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="flex flex-col bg-gray-800 dark:bg-gray-900 min-h-screen">
        <HeaderTop
          onToggleSidebar={() => setShowSidebar((prev) => !prev)}
          showSidebar={showSidebar}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />

        <div className="flex flex-1">
          <SportsSidebar
            show={showSidebar}
            filters={filters}
            setFilters={setFilters}
          />

          <main className="flex-1 overflow-hidden">
            {/* Mobile-only ArbCalc */}
            <div className="lg:hidden">
              {selectedEvent && (
                <div className="bg-white dark:bg-gray-800 text-white min-h-[150px] h-full flex flex-col">
                  <ArbCalc
                    data={selectedEvent}
                    showToggleButton
                    showMobileDetails={showMobileDetails}
                    setShowMobileDetails={setShowMobileDetails}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-2">
              {/* Lista de eventos */}
              <div className={`overflow-y-auto ${showMobileDetails ? 'hidden' : 'block'}`}>
              {loading ? (
                  <div className="flex items-center justify-center h-full py-10 text-white">
                    <span className="animate-pulse">⏳ Carregando surebets...</span>
                  </div>
                ) : (
                  <SportsArbList
                    data={dataBet}
                    selectedId={selectedId}
                    onSelect={(eventId) =>
                      setSelectedId((prev) => (prev === eventId ? 0 : eventId))
                    }
                    sortBy={filters.sortBy}
                  />
              )}
              </div>

              {/* Desktop ArbCalc + ArbsSelected */}
              <div className="hidden lg:flex flex-col h-full gap-1">
                <div className="bg-white dark:bg-gray-800 text-white shadow-md min-h-[160px] flex flex-col justify-between">
                  {selectedEvent && (
                    <ArbCalc
                      data={selectedEvent}
                      showToggleButton={false}
                      selectedSurebetIndex={selectedSurebetIndex}
                    />
                  )}
                </div>
                <div className="bg-white dark:bg-gray-800 text-white shadow-md min-h-[500px]">
                  <div className="flex-1 overflow-y-auto">
                    <ArbsSelected
                      data={selectedEvent}
                      onSurebetSelect={setSelectedSurebetIndex}
                      selectedSurebetIndex={selectedSurebetIndex}
                    />
                  </div>
                </div>
              </div>

              {/* Mobile-only ArbsSelected */}
              <div className={`lg:hidden ${showMobileDetails ? 'block' : 'hidden'}`}>
                <ArbsSelected
                  data={selectedEvent}
                  onSurebetSelect={setSelectedSurebetIndex}
                  selectedSurebetIndex={selectedSurebetIndex}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ArbitragemEsportivaPage;
