import { useState, useEffect } from 'react';
import { ValidationReport } from '@/types/protocol';

export interface AnalysisHistoryEntry {
  id: string;
  date: Date;
  patientId: string;
  protocolName: string;
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  report: ValidationReport;
}

const MAX_HISTORY_ENTRIES = 50;

export const useAnalysisHistory = () => {
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>(() => {
    const stored = localStorage.getItem('dvh-analysis-history');
    if (!stored) return [];
    
    try {
      const parsed = JSON.parse(stored);
      return parsed.map((entry: any) => ({
        ...entry,
        date: new Date(entry.date),
        report: {
          ...entry.report,
          evaluationDate: new Date(entry.report.evaluationDate)
        }
      }));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('dvh-analysis-history', JSON.stringify(history));
  }, [history]);

  const addToHistory = (entry: Omit<AnalysisHistoryEntry, 'id' | 'date'>) => {
    const newEntry: AnalysisHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      date: new Date(),
    };

    setHistory(prev => {
      const updated = [newEntry, ...prev];
      return updated.slice(0, MAX_HISTORY_ENTRIES);
    });
  };

  const deleteEntry = (id: string) => {
    setHistory(prev => prev.filter(entry => entry.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return { history, addToHistory, deleteEntry, clearHistory };
};
