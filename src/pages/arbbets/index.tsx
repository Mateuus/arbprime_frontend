'use client';
import React, { useState } from 'react';
import SportsSidebar from '@/components/arbbet/SportsSidebar';
import SportsArbList from '@/components/arbbet/SportsArbList';
import ArbCalc from '@/components/arbbet/ArbCalc';
import ArbsSelected from '@/components/arbbet/ArbsSelected';
import HeaderTop from '@/components/arbbet/HeaderTop';
import { SurebetData } from '@/interfaces/arbitragem.interface';

const mockEvents: SurebetData[] = [
  {
    id: '67d7d38a726624b7c18ab94c',
    sport: 'Soccer',
    league: 'CAF - Copa do Mundo 2026 - Qualificações',
    home: 'Costa do Marfim',
    away: 'Gâmbia',
    date: '2025-03-24T16:00:00.000Z',
    update_at: '2025-03-24T03:15:36.918Z',
    create_at: '2025-03-21T23:06:13.143Z',
    surebets: [
      {
        coefficient: 0.995,
        profitMargin: 0.49,
        marketTypes: ['match-winner:1'],
        surebet: [
          {
            option: 'home',
            price: 1.5,
            bookmaker: 'betano',
            eventId: '64901663',
            historyPrice: [{ timestamp: 1742786136, price: 1.5 }],
            otherOdds: [],
          },
          {
            option: 'draw',
            price: 4.29,
            bookmaker: 'mrjack',
            eventId: '48855713',
            historyPrice: [{ timestamp: 1742786136, price: 4.29 }],
            otherOdds: [],
          },
          {
            option: 'away',
            price: 10.5,
            bookmaker: 'betano',
            eventId: '64901663',
            historyPrice: [{ timestamp: 1742786136, price: 10.5 }],
            otherOdds: [],
          },
        ],
      },
    ],
  },
  {
    id: '67da7fa8726624b7c1988fe0',
    sport: 'futebol',
    league: 'La Liga',
    home: 'FC Barcelona',
    away: 'CA Osasuna',
    date: '2025-03-27T17:00:00.000Z',
    update_at: '2025-03-24T18:50:07.982Z',
    create_at: '2025-03-21T23:23:34.889Z',
    surebets: [
      {
        coefficient: 0.9917027417027416,
        profitMargin: 0.8297258297258359,
        marketTypes: ['match-winner:1'],
        surebet: [
          {
            option: 'home',
            price: 1.32,
            bookmaker: 'marjosports',
            eventId: '67da7fa8726624b7c1988fe0',
            historyPrice: [
              {
                timestamp: 1742842207,
                price: 1.32,
              },
            ],
            otherOdds: [
              { eventId: '67da7fa8726624b7c1988fe0', bookmaker: 'marjosports', price: 1.32 },
              { eventId: '29659325063900061', bookmaker: 'betbra', price: 1.3 },
              { eventId: '1606348728', bookmaker: 'pinnacle', price: 1.28 },
            ],
          },
          {
            option: 'draw',
            price: 7.2,
            bookmaker: 'betbra',
            eventId: '29659325063900061',
            historyPrice: [
              {
                timestamp: 1742842207,
                price: 7.2,
              },
            ],
            otherOdds: [
              { eventId: '29659325063900061', bookmaker: 'betbra', price: 7.2 },
              { eventId: '1606348728', bookmaker: 'pinnacle', price: 6.5 },
              { eventId: '67da7fa8726624b7c1988fe0', bookmaker: 'marjosports', price: 5.8 },
            ],
          },
          {
            option: 'away',
            price: 10.5,
            bookmaker: 'betbra',
            eventId: '29659325063900061',
            historyPrice: [
              {
                timestamp: 1742842207,
                price: 10.5,
              },
            ],
            otherOdds: [
              { eventId: '29659325063900061', bookmaker: 'betbra', price: 10.5 },
              { eventId: '1606348728', bookmaker: 'pinnacle', price: 9.16 },
              { eventId: '67da7fa8726624b7c1988fe0', bookmaker: 'marjosports', price: 9 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: '67dc04fa726624b7c1a10507',
    sport: 'futebol',
    league: 'Copa do Mundo - Eliminatórias da UEFA',
    home: 'Albânia',
    away: 'Andorra',
    date: '2025-03-24T16:45:00.000Z',
    surebets: [
      {
        coefficient: 0.9898110200364298,
        profitMargin: 1.0188979963570155,
        marketTypes: ['match-winner:1'],
        surebet: [
          {
            option: 'home',
            price: 1.22,
            bookmaker: 'betano',
            eventId: '64897607',
            historyPrice: [{ timestamp: 1742842207, price: 1.22 }],
            otherOdds: [
              { eventId: '64897607', bookmaker: 'betano', price: 1.22 },
              { eventId: '67dc04fa726624b7c1a10507', bookmaker: 'marjosports', price: 1.21 },
              { eventId: '7175654', bookmaker: 'superbet', price: 1.21 },
              { eventId: '29667212548500061', bookmaker: 'betbra', price: 1.2 },
              { eventId: '56418701', bookmaker: 'mrjack', price: 1.19 },
              { eventId: '1606266111', bookmaker: 'pinnacle', price: 1.181 },
              { eventId: '1023168662', bookmaker: 'betmgm', price: 1.18 },
              { eventId: '12056847', bookmaker: 'estrelabet', price: 1.1765 }
            ]
          },
          {
            option: 'draw',
            price: 7.2,
            bookmaker: 'betbra',
            eventId: '29667212548500061',
            historyPrice: [{ timestamp: 1742842207, price: 7.2 }],
            otherOdds: [
              { eventId: '29667212548500061', bookmaker: 'betbra', price: 7.2 },
              { eventId: '1606266111', bookmaker: 'pinnacle', price: 6.59 },
              { eventId: '1023168662', bookmaker: 'betmgm', price: 6.5 },
              { eventId: '64897607', bookmaker: 'betano', price: 6.3 },
              { eventId: '7175654', bookmaker: 'superbet', price: 6.3 },
              { eventId: '56418701', bookmaker: 'mrjack', price: 6.23 },
              { eventId: '67dc04fa726624b7c1a10507', bookmaker: 'marjosports', price: 6 },
              { eventId: '12056847', bookmaker: 'estrelabet', price: 6 }
            ]
          },
          {
            option: 'away',
            price: 32,
            bookmaker: 'betbra',
            eventId: '29667212548500061',
            historyPrice: [{ timestamp: 1742842207, price: 32 }],
            otherOdds: [
              { eventId: '29667212548500061', bookmaker: 'betbra', price: 32 },
              { eventId: '1606266111', bookmaker: 'pinnacle', price: 23.56 },
              { eventId: '67dc04fa726624b7c1a10507', bookmaker: 'marjosports', price: 22 },
              { eventId: '12056847', bookmaker: 'estrelabet', price: 21 },
              { eventId: '1023168662', bookmaker: 'betmgm', price: 21 },
              { eventId: '64897607', bookmaker: 'betano', price: 21 },
              { eventId: '56418701', bookmaker: 'mrjack', price: 19.03 },
              { eventId: '7175654', bookmaker: 'superbet', price: 18 }
            ]
          }
        ]
      },
      {
        coefficient: 0.99541909124675,
        profitMargin: 0.45809087532500126,
        marketTypes: ['total-goals:6'],
        surebet: [
          {
            option: 'Mais de 1',
            price: 1.97,
            bookmaker: 'pinnacle',
            eventId: '1606266111',
            historyPrice: [{ timestamp: 1742842207, price: 1.97 }],
            otherOdds: [
              { eventId: '1606266111', bookmaker: 'pinnacle', price: 1.97 },
              { eventId: '56418701', bookmaker: 'mrjack', price: 1.72 }
            ]
          },
          {
            option: 'Menos de 1',
            price: 2.05,
            bookmaker: 'mrjack',
            eventId: '56418701',
            historyPrice: [{ timestamp: 1742842207, price: 2.05 }],
            otherOdds: [
              { eventId: '56418701', bookmaker: 'mrjack', price: 2.05 },
              { eventId: '1606266111', bookmaker: 'pinnacle', price: 1.884 }
            ]
          }
        ]
      },
      {
        coefficient: 0.9927884615384615,
        profitMargin: 0.7211538461538547,
        marketTypes: ['match-winner:1', 'double-chance:11'],
        surebet: [
          {
            option: '1X',
            price: 1.04,
            bookmaker: 'mrjack',
            eventId: '56418701',
            historyPrice: [{ timestamp: 1742842207, price: 1.04 }],
            otherOdds: [
              { eventId: '56418701', bookmaker: 'mrjack', price: 1.04 },
              { eventId: '67dc04fa726624b7c1a10507', bookmaker: 'marjosports', price: 1.03 },
              { eventId: '29667212548500061', bookmaker: 'betbra', price: 1.03 },
              { eventId: '64897607', bookmaker: 'betano', price: 1.03 },
              { eventId: '12056847', bookmaker: 'estrelabet', price: 1.02 },
              { eventId: '7175654', bookmaker: 'superbet', price: 1.02 },
              { eventId: '1023168662', bookmaker: 'betmgm', price: 0 }
            ]
          },
          {
            option: 'away',
            price: 32,
            bookmaker: 'betbra',
            eventId: '29667212548500061',
            historyPrice: [{ timestamp: 1742842207, price: 32 }],
            otherOdds: [
              { eventId: '29667212548500061', bookmaker: 'betbra', price: 32 },
              { eventId: '1606266111', bookmaker: 'pinnacle', price: 23.56 },
              { eventId: '67dc04fa726624b7c1a10507', bookmaker: 'marjosports', price: 22 },
              { eventId: '12056847', bookmaker: 'estrelabet', price: 21 },
              { eventId: '1023168662', bookmaker: 'betmgm', price: 21 },
              { eventId: '64897607', bookmaker: 'betano', price: 21 },
              { eventId: '56418701', bookmaker: 'mrjack', price: 19.03 },
              { eventId: '7175654', bookmaker: 'superbet', price: 18 }
            ]
          }
        ]
      }
    ],
    update_at: '2025-03-24T18:50:07.712Z',
    create_at: '2025-03-22T07:40:12.604Z'
  },
  {
    id: '67c96a0b726624b7c1f94ac1',
    sport: 'futebol',
    league: 'Copa do Mundo - Eliminatórias da UEFA',
    home: 'São Marino',
    away: 'Roménia',
    date: '2025-03-24T16:45:00.000Z',
    surebets: [
      {
        coefficient: 0.9976261964167407,
        profitMargin: 0.23738035832593374,
        marketTypes: ['match-winner:1'],
        surebet: [
          {
            option: 'home',
            price: 85,
            bookmaker: 'betbra',
            eventId: '29663105612900061',
            historyPrice: [{ timestamp: 1742842237, price: 85 }],
            otherOdds: [
              { eventId: '29663105612900061', bookmaker: 'betbra', price: 85 },
              { eventId: '67c96a0b726624b7c1f94ac1', bookmaker: 'marjosports', price: 70 },
              { eventId: '1606137626', bookmaker: 'pinnacle', price: 66 },
              { eventId: '7175575', bookmaker: 'superbet', price: 65 },
              { eventId: '56418583', bookmaker: 'mrjack', price: 58.8 },
              { eventId: '64897928', bookmaker: 'betano', price: 50 },
              { eventId: '11261801', bookmaker: 'estrelabet', price: 46 },
              { eventId: '1022335901', bookmaker: 'betmgm', price: 30 }
            ]
          },
          {
            option: 'draw',
            price: 19.5,
            bookmaker: 'betbra',
            eventId: '29663105612900061',
            historyPrice: [{ timestamp: 1742842237, price: 19.5 }],
            otherOdds: [
              { eventId: '29663105612900061', bookmaker: 'betbra', price: 19.5 },
              { eventId: '1606137626', bookmaker: 'pinnacle', price: 18.5 },
              { eventId: '7175575', bookmaker: 'superbet', price: 16 },
              { eventId: '1022335901', bookmaker: 'betmgm', price: 14 },
              { eventId: '64897928', bookmaker: 'betano', price: 13.5 },
              { eventId: '56418583', bookmaker: 'mrjack', price: 13.04 },
              { eventId: '67c96a0b726624b7c1f94ac1', bookmaker: 'marjosports', price: 13 },
              { eventId: '11261801', bookmaker: 'estrelabet', price: 11 }
            ]
          },
          {
            option: 'away',
            price: 1.07,
            bookmaker: 'betano',
            eventId: '64897928',
            historyPrice: [{ timestamp: 1742842237, price: 1.07 }],
            otherOdds: [
              { eventId: '64897928', bookmaker: 'betano', price: 1.07 },
              { eventId: '29663105612900061', bookmaker: 'betbra', price: 1.06 },
              { eventId: '67c96a0b726624b7c1f94ac1', bookmaker: 'marjosports', price: 1.05 },
              { eventId: '11261801', bookmaker: 'estrelabet', price: 1.05 },
              { eventId: '1022335901', bookmaker: 'betmgm', price: 1.05 },
              { eventId: '7175575', bookmaker: 'superbet', price: 1.05 },
              { eventId: '56418583', bookmaker: 'mrjack', price: 1.05 },
              { eventId: '1606137626', bookmaker: 'pinnacle', price: 1.04 }
            ]
          }
        ]
      }
    ],
    update_at: '2025-03-24T18:50:37.021Z',
    create_at: '2025-03-22T09:26:30.915Z'
  },
  {
    id: '67d32b2c726624b7c151bc9f',
    sport: 'futebol',
    league: 'Copa do Mundo - Eliminatórias da CONMEBOL',
    home: 'Argentina',
    away: 'Brasil',
    date: '2025-03-25T21:00:00.000Z',
    surebets: [
      {
        coefficient: 0.999386708296164,
        profitMargin: 0.06132917038359498,
        marketTypes: ['match-winner:1'],
        surebet: [
          {
            option: 'home',
            price: 2.36,
            bookmaker: 'betbra',
            eventId: '29608302734500061',
            historyPrice: [{ timestamp: 1742842237, price: 2.36 }],
            otherOdds: [
              { eventId: '29608302734500061', bookmaker: 'betbra', price: 2.36 },
              { eventId: '67d32b2c726624b7c151bc9f', bookmaker: 'marjosports', price: 2.32 },
              { eventId: '55623919', bookmaker: 'mrjack', price: 2.3 },
              { eventId: '1604723987', bookmaker: 'pinnacle', price: 2.27 },
              { eventId: '1022114370', bookmaker: 'betmgm', price: 2.16 },
              { eventId: '7064652', bookmaker: 'superbet', price: 2.15 }
            ]
          },
          {
            option: 'draw',
            price: 3.2,
            bookmaker: 'betmgm',
            eventId: '1022114370',
            historyPrice: [{ timestamp: 1742842237, price: 3.2 }],
            otherOdds: [
              { eventId: '1022114370', bookmaker: 'betmgm', price: 3.2 },
              { eventId: '29608302734500061', bookmaker: 'betbra', price: 3.15 },
              { eventId: '7064652', bookmaker: 'superbet', price: 3.15 },
              { eventId: '1604723987', bookmaker: 'pinnacle', price: 3.12 },
              { eventId: '55623919', bookmaker: 'mrjack', price: 3.11 },
              { eventId: '67d32b2c726624b7c151bc9f', bookmaker: 'marjosports', price: 3.05 }
            ]
          },
          {
            option: 'away',
            price: 3.8,
            bookmaker: 'betbra',
            eventId: '29608302734500061',
            historyPrice: [{ timestamp: 1742842237, price: 3.8 }],
            otherOdds: [
              { eventId: '29608302734500061', bookmaker: 'betbra', price: 3.8 },
              { eventId: '1022114370', bookmaker: 'betmgm', price: 3.75 },
              { eventId: '7064652', bookmaker: 'superbet', price: 3.75 },
              { eventId: '1604723987', bookmaker: 'pinnacle', price: 3.68 },
              { eventId: '67d32b2c726624b7c151bc9f', bookmaker: 'marjosports', price: 3.6 },
              { eventId: '55623919', bookmaker: 'mrjack', price: 3.29 }
            ]
          }
        ]
      }
    ],
    update_at: '2025-03-24T18:50:37.149Z',
    create_at: '2025-03-22T12:42:29.783Z'
  },
  {
    id: '67d32b2c726624b7c151bc9f',
    sport: 'futebol',
    league: 'Copa do Mundo - Eliminatórias da CONMEBOL',
    home: 'Argentina',
    away: 'Brasil',
    date: '2025-03-25T21:00:00.000Z',
    surebets: [
      {
        coefficient: 0.999386708296164,
        profitMargin: 0.06132917038359498,
        marketTypes: ['match-winner:1'],
        surebet: [
          {
            option: 'home',
            price: 2.36,
            bookmaker: 'betbra',
            eventId: '29608302734500061',
            historyPrice: [{ timestamp: 1742842237, price: 2.36 }],
            otherOdds: [
              { eventId: '29608302734500061', bookmaker: 'betbra', price: 2.36 },
              { eventId: '67d32b2c726624b7c151bc9f', bookmaker: 'marjosports', price: 2.32 },
              { eventId: '55623919', bookmaker: 'mrjack', price: 2.3 },
              { eventId: '1604723987', bookmaker: 'pinnacle', price: 2.27 },
              { eventId: '1022114370', bookmaker: 'betmgm', price: 2.16 },
              { eventId: '7064652', bookmaker: 'superbet', price: 2.15 }
            ]
          },
          {
            option: 'draw',
            price: 3.2,
            bookmaker: 'betmgm',
            eventId: '1022114370',
            historyPrice: [{ timestamp: 1742842237, price: 3.2 }],
            otherOdds: [
              { eventId: '1022114370', bookmaker: 'betmgm', price: 3.2 },
              { eventId: '29608302734500061', bookmaker: 'betbra', price: 3.15 },
              { eventId: '7064652', bookmaker: 'superbet', price: 3.15 },
              { eventId: '1604723987', bookmaker: 'pinnacle', price: 3.12 },
              { eventId: '55623919', bookmaker: 'mrjack', price: 3.11 },
              { eventId: '67d32b2c726624b7c151bc9f', bookmaker: 'marjosports', price: 3.05 }
            ]
          },
          {
            option: 'away',
            price: 3.8,
            bookmaker: 'betbra',
            eventId: '29608302734500061',
            historyPrice: [{ timestamp: 1742842237, price: 3.8 }],
            otherOdds: [
              { eventId: '29608302734500061', bookmaker: 'betbra', price: 3.8 },
              { eventId: '1022114370', bookmaker: 'betmgm', price: 3.75 },
              { eventId: '7064652', bookmaker: 'superbet', price: 3.75 },
              { eventId: '1604723987', bookmaker: 'pinnacle', price: 3.68 },
              { eventId: '67d32b2c726624b7c151bc9f', bookmaker: 'marjosports', price: 3.6 },
              { eventId: '55623919', bookmaker: 'mrjack', price: 3.29 }
            ]
          }
        ]
      }
    ],
    update_at: '2025-03-24T18:50:37.149Z',
    create_at: '2025-03-22T12:42:29.783Z'
  }     
];


const ArbitragemEsportivaPage = () => {
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedId, setSelectedId] = useState<string | number>(0);
  const selectedEvent = mockEvents.find((e) => e.id === selectedId) || null;


  const [filters, setFiltersState] = useState({
    arbType: 'live',
    autoUpdate: true,
    zoom: '100%',
  });

  const setFilters = (updates: Partial<typeof filters>) => {
    setFiltersState((prev) => ({ ...prev, ...updates }));
  };

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
                data={mockEvents}
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
