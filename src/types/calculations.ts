export interface CustomCalculation {
  id: string;
  timestamp: number;
  structureName: string;
  type: 'Vx' | 'Dx';
  input: number;
  result: number;
  unit: string;
}

export interface CalculationHistory {
  calculations: CustomCalculation[];
}
