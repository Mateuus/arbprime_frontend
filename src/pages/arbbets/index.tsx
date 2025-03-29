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
  const [darkMode, setDarkMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | number>(0);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [selectedSurebetIndex, setSelectedSurebetIndex] = useState(0);

  const selectedEvent = dataBet.find((e) => e.id === selectedId) || null;

  const [filters, setFiltersState] = useState({
    arbType: 'prematch',
    autoUpdate: autoUpdate,
    zoom: '100%',
    sortBy: 'Percent',
  });

  const setFilters = (updates: Partial<typeof filters>) => {
    setFiltersState((prev) => ({ ...prev, ...updates }));
  };

    useEffect(() => {
      setAutoUpdate(filters.autoUpdate);
    }, [dataBet, autoUpdate, filters.autoUpdate, setAutoUpdate]);

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="flex flex-col bg-gray-800 dark:bg-gray-900 min-h-screen py-3">
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
              {/* Lista de eventos - escondido no mobile quando detalhes estão visíveis */}
              <div className={`overflow-y-auto ${showMobileDetails ? 'hidden' : 'block'}`}>
                <SportsArbList
                  data={dataBet}
                  selectedId={selectedId}
                  onSelect={(eventId) => setSelectedId(eventId)}
                  sortBy={filters.sortBy}
                />
              </div>

              {/* Desktop ArbCalc e ArbsSelected */}
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
