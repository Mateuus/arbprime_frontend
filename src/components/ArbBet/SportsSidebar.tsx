interface Props {
  show: boolean;
  filters: {
    arbType: string;
    autoUpdate: boolean;
    zoom: string;
    sortBy: string;
  };
  setFilters: (filters: Partial<Props["filters"]>) => void;
}

const SportsSidebar: React.FC<Props> = ({ show, filters, setFilters }) => {
  return (
    <aside
      className={`
        bg-gray-800 text-xs text-white py-4 flex flex-col gap-4 border-r border-[#2c2f36]
        min-h-screen transition-all duration-300 ease-in-out
        ${show ? 'w-[160px] px-2 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full'}
        overflow-hidden
      `}
    >
      {/* Arbs Type */}
      <div>
        <div className="text-[10px] uppercase text-gray-400 mb-1">Arbs type:</div>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="arbType"
            value="prematch"
            checked={filters.arbType === 'prematch'}
            onChange={() => setFilters({ arbType: 'prematch' })}
          />
          <span>Prematch</span>
        </label>
        <label className="flex items-center gap-2 mb-1">
          <input
            type="radio"
            name="arbType"
            value="live"
            checked={filters.arbType === 'live'}
            onChange={() => setFilters({ arbType: 'live' })}
          />
          <span>Live</span>
        </label>
      </div>

      {/* Zoom 
      <div>
        <div className="text-[10px] uppercase text-gray-400 mb-1">Zoom:</div>
        <select
          className="w-full p-1 rounded bg-[#111318] text-white text-xs"
          value={filters.zoom}
          onChange={(e) => setFilters({ zoom: e.target.value })}
        >
          <option>100%</option>
          <option>80%</option>
          <option>60%</option>
        </select>
      </div>*/}

      {/* Sort */}
      <div>
        <div className="text-[10px] uppercase text-gray-400 mb-1">Sorted by:</div>
        <select
          className="w-full p-1 rounded bg-[#111318] text-white text-xs"
          value={filters.sortBy}
          onChange={(e) => setFilters({ sortBy: e.target.value })}
        >
          <option>Percent</option>
          <option>Time</option>
          <option>Age</option>
        </select>
      </div>

      {/* Settings */}
      <div>
        <div className="text-[10px] uppercase text-gray-400 mb-1">Settings:</div>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.autoUpdate}
              onChange={() => setFilters({ autoUpdate: !filters.autoUpdate })}
            />
            Auto update
          </label>
           {/*
          <label className="flex items-center gap-2">
            <input type="checkbox" />
            Sound alerts
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked />
            Show popups
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" />
            Group arbs
          </label>
          */}
        </div>
      </div>

      {/* Arbs on page */}
      <div>
        <div className="text-[10px] uppercase text-gray-400 mb-1">Arbs on page:</div>
        <select className="w-full p-1 rounded bg-[#111318] text-white text-xs">
          <option>20</option>
          <option>50</option>
          <option>100</option>
        </select>
      </div>

      {/* Odds type 
      <div>
        <div className="text-[10px] uppercase text-gray-400 mb-1">Odds type:</div>
        <select className="w-full p-1 rounded bg-[#111318] text-white text-xs">
          <option>Decimal</option>
          <option>Fracional</option>
          <option>Americano</option>
        </select>
      </div> */}

      {/* Filters */}
      <div>
        <div className="text-[10px] uppercase text-gray-400 mb-1">Filters:</div>
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" defaultChecked />
          demo
        </label>
        <button className="bg-[#3c4450] hover:bg-[#505661] w-full text-center py-1 rounded text-[10px]">
          Manage filters
        </button>
      </div>

      {/* Hidden
      <div>
        <div className="text-[10px] uppercase text-gray-400 mb-1">Hidden:</div>
        <div className="flex flex-col gap-[2px] text-blue-400 text-[11px] underline">
          <span className="cursor-pointer hover:text-blue-300">0 arbs</span>
          <span className="cursor-pointer hover:text-blue-300">0 events</span>
          <span className="cursor-pointer hover:text-blue-300">0 outcomes</span>
          <span className="cursor-pointer hover:text-blue-300">0 bookmaker</span>
        </div>
      </div>
       */}
    </aside>
  );
};

export default SportsSidebar;