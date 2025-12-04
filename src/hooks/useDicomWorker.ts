import { useRef, useEffect, useCallback } from 'react';
import { DicomRTData } from '@/types/dicomRT';

interface WorkerRequest {
  id: number;
  arrayBuffer: ArrayBuffer;
  fileName: string;
}

interface WorkerResponse {
  id: number;
  success: boolean;
  data?: DicomRTData;
  error?: string;
}

interface PendingRequest {
  resolve: (data: DicomRTData) => void;
  reject: (error: Error) => void;
}

export function useDicomWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, PendingRequest>>(new Map());
  const idCounterRef = useRef(0);

  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(
      new URL('../workers/dicomParser.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Handle responses
    workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, success, data, error } = e.data;
      const pending = pendingRef.current.get(id);
      
      if (pending) {
        pendingRef.current.delete(id);
        if (success && data) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(error || 'Worker parsing failed'));
        }
      }
    };

    workerRef.current.onerror = (e) => {
      console.error('Worker error:', e);
      // Reject all pending requests
      pendingRef.current.forEach((pending) => {
        pending.reject(new Error('Worker error'));
      });
      pendingRef.current.clear();
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const parseFile = useCallback(async (file: File): Promise<DicomRTData> => {
    if (!workerRef.current) {
      throw new Error('Worker not initialized');
    }

    const id = ++idCounterRef.current;
    const arrayBuffer = await file.arrayBuffer();

    return new Promise((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      
      const request: WorkerRequest = {
        id,
        arrayBuffer,
        fileName: file.name,
      };
      
      // Transfer the ArrayBuffer for zero-copy
      workerRef.current!.postMessage(request, [arrayBuffer]);
    });
  }, []);

  const parseFiles = useCallback(async (
    files: File[],
    onProgress?: (parsed: number, total: number) => void
  ): Promise<DicomRTData> => {
    let combinedData: DicomRTData = {
      patientId: '',
      patientName: '',
      studyDate: '',
      modality: '',
      structures: [],
      dose: undefined,
      plan: undefined,
    };

    let parsed = 0;
    const total = files.length;

    // Process files with concurrency limit
    const CONCURRENCY = 4;
    const queue = [...files];
    const workers: Promise<void>[] = [];

    const processNext = async (): Promise<void> => {
      while (queue.length > 0) {
        const file = queue.shift();
        if (!file) break;

        try {
          const data = await parseFile(file);
          
          // Merge data
          if (data.patientId) combinedData.patientId = data.patientId;
          if (data.patientName) combinedData.patientName = data.patientName;
          if (data.studyDate) combinedData.studyDate = data.studyDate;
          if (data.modality) combinedData.modality = data.modality;
          
          if (data.structures?.length) {
            combinedData.structures = [...(combinedData.structures || []), ...data.structures];
          }
          if (data.dose) {
            combinedData.dose = combinedData.dose 
              ? { ...combinedData.dose, ...data.dose, dvhs: [...(combinedData.dose.dvhs || []), ...(data.dose.dvhs || [])] }
              : data.dose;
          }
          if (data.plan) {
            combinedData.plan = { ...combinedData.plan, ...data.plan };
          }
        } catch (err) {
          console.warn(`Failed to parse ${file.name}:`, err);
        }

        parsed++;
        onProgress?.(parsed, total);
      }
    };

    // Start concurrent workers
    for (let i = 0; i < Math.min(CONCURRENCY, files.length); i++) {
      workers.push(processNext());
    }

    await Promise.all(workers);
    return combinedData;
  }, [parseFile]);

  return { parseFile, parseFiles };
}
