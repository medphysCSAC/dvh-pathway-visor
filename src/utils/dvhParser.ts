import { DVHData, Structure, DVHPoint } from '@/types/dvh';

export const parseTomoTherapyDVH = (relContent: string, absContent: string): DVHData => {
  const relLines = relContent.trim().split('\n');
  const absLines = absContent.trim().split('\n');
  
  if (relLines.length === 0 || absLines.length === 0) {
    throw new Error('Empty file content');
  }

  // Parse header to get structure names
  const relHeader = relLines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const absHeader = absLines[0].split(',').map(h => h.replace(/"/g, '').trim());
  
  const structures: Structure[] = [];
  
  // Process structures (every 3 columns: name, dose, volume)
  for (let i = 0; i < relHeader.length; i += 3) {
    if (!relHeader[i]) continue;
    
    const structureName = relHeader[i].replace('(STANDARD)', '').trim();
    const relativeVolume: DVHPoint[] = [];
    const absoluteVolume: DVHPoint[] = [];
    
    // Parse data rows
    for (let rowIdx = 1; rowIdx < relLines.length; rowIdx++) {
      const relCells = relLines[rowIdx].split(',');
      const absCells = absLines[rowIdx].split(',');
      
      const dose = parseFloat(relCells[i + 1]);
      const relVol = parseFloat(relCells[i + 2]);
      const absVol = parseFloat(absCells[i + 2]);
      
      if (!isNaN(dose) && !isNaN(relVol)) {
        relativeVolume.push({ dose, volume: relVol });
      }
      
      if (!isNaN(dose) && !isNaN(absVol)) {
        absoluteVolume.push({ dose, volume: absVol });
      }
    }
    
    // Get total volume from first absolute volume entry
    const totalVolume = absoluteVolume.length > 0 ? absoluteVolume[0].volume : undefined;
    
    structures.push({
      name: structureName,
      type: 'STANDARD',
      relativeVolume,
      absoluteVolume,
      totalVolume
    });
  }
  
  return {
    patientId: 'Unknown',
    structures: structures.filter(s => s.relativeVolume.length > 0)
  };
};

export const calculateMetrics = (structure: Structure) => {
  if (!structure.relativeVolume.length) {
    return null;
  }
  
  const doses = structure.relativeVolume.map(p => p.dose);
  const volumes = structure.relativeVolume.map(p => p.volume);
  
  const dmax = Math.max(...doses);
  
  // Calculate Dmean using trapezoidal integration
  let dmean = 0;
  for (let i = 1; i < structure.relativeVolume.length; i++) {
    const dv = volumes[i - 1] - volumes[i];
    const avgDose = (doses[i - 1] + doses[i]) / 2;
    dmean += avgDose * dv;
  }
  dmean = dmean / 100; // Normalize
  
  // Find V20Gy and V40Gy
  const v20Gy = interpolateVolume(structure.relativeVolume, 20);
  const v40Gy = interpolateVolume(structure.relativeVolume, 40);
  
  return {
    structureName: structure.name,
    volume: structure.totalVolume || 0,
    dmax,
    dmean,
    v20Gy,
    v40Gy
  };
};

const interpolateVolume = (points: DVHPoint[], targetDose: number): number => {
  // Find the two points that bracket the target dose
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].dose <= targetDose && points[i + 1].dose >= targetDose) {
      const t = (targetDose - points[i].dose) / (points[i + 1].dose - points[i].dose);
      return points[i].volume + t * (points[i + 1].volume - points[i].volume);
    }
  }
  
  // If target dose is beyond data range
  if (targetDose >= points[points.length - 1].dose) {
    return points[points.length - 1].volume;
  }
  
  return 0;
};
