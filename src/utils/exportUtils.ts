import { PTVQualityMetrics, OARMetrics } from './planQualityMetrics';

export const exportMetricsToCSV = (
  ptvMetrics: PTVQualityMetrics[],
  oarMetrics: OARMetrics[],
  patientId: string
) => {
  let csv = `Évaluation du plan - Patient ${patientId}\n\n`;
  
  // PTV Metrics
  csv += 'MÉTRIQUES DES VOLUMES CIBLES (PTV)\n';
  csv += 'Structure,D95% (Gy),D98% (Gy),D50% (Gy),D2% (Gy),V95% (%),HI,CI,CN\n';
  
  ptvMetrics.forEach(m => {
    csv += `${m.structureName},${m.d95.toFixed(2)},${m.d98.toFixed(2)},${m.d50.toFixed(2)},${m.d2.toFixed(2)},${m.v95.toFixed(1)},${m.hi.toFixed(3)},${m.ci.toFixed(3)},${m.cn.toFixed(3)}\n`;
  });
  
  csv += '\n';
  
  // OAR Metrics
  csv += 'DOSES AUX ORGANES À RISQUE (OAR)\n';
  csv += 'Structure,Volume (cc),Dmax (Gy),Dmean (Gy),V20Gy (%),V30Gy (%),V40Gy (%)\n';
  
  oarMetrics.forEach(m => {
    csv += `${m.structureName},${m.volume.toFixed(2)},${m.dmax.toFixed(2)},${m.dmean.toFixed(2)},${m.v20Gy.toFixed(1)},${m.v30Gy.toFixed(1)},${m.v40Gy.toFixed(1)}\n`;
  });
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `DVH_Metrics_${patientId}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};

export const exportMetricsToJSON = (
  ptvMetrics: PTVQualityMetrics[],
  oarMetrics: OARMetrics[],
  patientId: string
) => {
  const data = {
    exportDate: new Date().toISOString(),
    patientId,
    ptvMetrics,
    oarMetrics,
    metadata: {
      exportedBy: 'DVH Analyzer',
      version: '1.0'
    }
  };
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `DVH_Metrics_${patientId}_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
};
