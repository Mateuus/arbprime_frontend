// Dados para enviar ao backend (POST/PUT)
export interface CreateOrUpdateFilterDTO {
    name: string;
    sortBy: 'profit' | 'roi' | 'age' | 'start_time';
    sortDirection: 'asc' | 'desc';
    profitMin: number;
    profitMax: number;
    roiMin: number;
    roiMax: number;
    ageMin: number;
    ageMax: number;
    outcomes: number[];
    bookmakers: string[];
    sports: string[];
    tournaments: string[];
    duration: number;
    requiredBookmakers: string[];
  }
  
  // Dados recebidos do backend (GET)
  export interface FilterDTO extends CreateOrUpdateFilterDTO {
    id: string | number;
    userId: string;
    createdAt: string;
  }