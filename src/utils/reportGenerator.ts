import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ValidationReport } from '@/types/protocol';

export type ReportTemplate = 'classic' | 'modern' | 'minimal';

export function generateHTMLReport(
  report: ValidationReport, 
  overallStatus?: 'PASS' | 'FAIL', 
  doctorName?: string,
  template: ReportTemplate = 'classic',
  observations?: string
): string {
  switch (template) {
    case 'modern':
      return generateModernReport(report, overallStatus, doctorName, observations);
    case 'minimal':
      return generateMinimalReport(report, overallStatus, doctorName, observations);
    case 'classic':
    default:
      return generateClassicReport(report, overallStatus, doctorName, observations);
  }
}

function generateClassicReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string, observations?: string): string {
  const finalStatus = overallStatus || report.overallStatus;
  const { protocolName, patientId, evaluationDate, constraintResults } = report;
  const statusColor = finalStatus === 'PASS' ? '#22c55e' : '#ef4444';
  const ptvMetrics = report.ptvQualityMetrics || [];
  
  const ptvTableRows = ptvMetrics.map(m => {
    const status = m.v95 >= 95 ? 'PASS' : 'FAIL';
    const statusClass = status === 'PASS' ? 'pass' : 'fail';
    const hiColor = m.hi < 0.15 ? '#22c55e' : '#ef4444';
    const ciColor = (m.ci >= 0.9 && m.ci <= 1.1) ? '#22c55e' : '#ef4444';
    
    return `<tr><td>${m.structureName}</td><td>${m.d95.toFixed(2)} Gy</td><td>${m.d98.toFixed(2)} Gy</td><td>${m.d50.toFixed(2)} Gy</td><td>${m.d2.toFixed(2)} Gy</td><td style="color: ${hiColor}; font-weight: bold;">${m.hi.toFixed(3)}</td><td style="color: ${ciColor}; font-weight: bold;">${m.ci.toFixed(3)}</td><td class="${statusClass}">${status}</td></tr>`;
  }).join('');

  const oarTableRows = constraintResults.map(c => {
    const statusClass = c.status === 'PASS' ? 'pass' : c.status === 'FAIL' ? 'fail' : 'warning';
    let constraintType = '', threshold = '';
    
    if (c.constraint.type === 'mean_dose') {
      constraintType = 'Dmean';
      threshold = `${c.constraint.value} Gy`;
    } else if (c.constraint.type === 'max_dose') {
      constraintType = 'Dmax';
      threshold = `${c.constraint.value} Gy`;
    } else if (c.constraint.type === 'volume_at_dose') {
      constraintType = `V${c.constraint.doseValue}Gy`;
      threshold = `${c.constraint.value}${c.constraint.unit === 'percent' ? '%' : 'cc'}`;
    } else if (c.constraint.type === 'dose_at_volume') {
      constraintType = `D${c.constraint.volumeValue}${c.constraint.volumeUnit === 'percent' ? '%' : 'cc'}`;
      threshold = `${c.constraint.value} Gy`;
    }
    
    return `<tr><td>${c.constraint.structureName}</td><td>${constraintType}</td><td>${threshold}</td><td>${c.measuredValue.toFixed(2)} ${c.constraint.type.includes('volume') ? (c.constraint.unit === 'percent' ? '%' : 'cc') : 'Gy'}</td><td class="${statusClass}">${c.status}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Validation - ${protocolName}</title><style>@media print{@page{size:A4;margin:20mm 25mm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.no-break{page-break-inside:avoid}table{page-break-inside:avoid}tbody tr{page-break-inside:avoid}}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Times New Roman',serif;line-height:1.4;color:#000;background:white;padding:20mm 25mm;max-width:210mm;margin:0 auto}.header{text-align:center;border-bottom:3px double #000;padding-bottom:8mm;margin-bottom:8mm}.header h1{font-size:18pt;font-weight:bold;margin-bottom:3mm;text-transform:uppercase}.header p{font-size:11pt}.info-section{margin-bottom:6mm;padding:4mm;border:1px solid #ddd;background:#f9f9f9}.info-row{display:flex;margin-bottom:2mm;font-size:10pt}.info-label{font-weight:bold;width:140px}.status-box{text-align:center;padding:4mm;margin:6mm 0;border:2px solid ${statusColor};background:${statusColor}15}.status-text{font-size:14pt;font-weight:bold;color:${statusColor}}.section{margin-top:6mm;page-break-inside:avoid}.section-title{font-size:13pt;font-weight:bold;margin-bottom:4mm;padding-bottom:2mm;border-bottom:2px solid #000}.summary-text{font-size:8pt;color:#666;margin-top:3mm;margin-bottom:6mm;padding:3mm;background:#f9f9f9;border-left:3px solid #333}table{width:100%;border-collapse:collapse;margin-bottom:6mm;font-size:9pt;page-break-inside:avoid}thead{background:#333;color:white}th{text-align:left;padding:2.5mm;font-weight:bold;border:1px solid #000}td{padding:2.5mm;border:1px solid #ddd}tbody tr{page-break-inside:avoid}tbody tr:nth-child(even){background:#f5f5f5}.pass{color:#22c55e;font-weight:bold}.fail{color:#ef4444;font-weight:bold}.warning{color:#f59e0b;font-weight:bold}.validation-section{margin-top:10mm;page-break-inside:avoid}.validation-box{border:1px solid #333;padding:4mm;background:#f9f9f9}.validation-label{font-weight:bold;font-size:10pt;margin-bottom:2mm}.observations-text{font-size:9pt;margin-top:3mm;padding:3mm;background:white;border:1px solid #ddd;white-space:pre-wrap}.footer{margin-top:8mm;padding-top:3mm;border-top:1px solid #ddd;font-size:8pt;text-align:center;color:#666}</style></head><body><div class="header"><h1>Rapport de Validation du Plan de Traitement</h1><p>Radiothérapie - Évaluation Dosimétrique</p></div><div class="info-section no-break"><div class="info-row"><span class="info-label">Protocole :</span><span>${protocolName}</span></div><div class="info-row"><span class="info-label">Patient ID :</span><span>${patientId}</span></div><div class="info-row"><span class="info-label">Date :</span><span>${new Date(evaluationDate).toLocaleDateString('fr-FR')}</span></div></div><div class="status-box no-break"><div class="status-text">STATUT : ${finalStatus}</div></div>${ptvMetrics.length > 0 ? `<div class="section"><h2 class="section-title">1. Évaluation des PTVs</h2><table><thead><tr><th>PTV</th><th>D95%</th><th>D98%</th><th>D50%</th><th>D2%</th><th>HI</th><th>CI</th><th>STATUS</th></tr></thead><tbody>${ptvTableRows}</tbody></table><div class="summary-text"><strong>Définitions et valeurs recommandées :</strong><br>• HI (Homogeneity Index) = (D2% - D98%) / D50%. Recommandations : HI &lt; 0.15<br>• CI (Conformity Index) = TV / PTV. Recommandations : CI entre 0.9 et 1.1</div></div>` : ''}${constraintResults.length > 0 ? `<div class="section"><h2 class="section-title">2. Contraintes OAR</h2><table><thead><tr><th>Organe</th><th>Contrainte</th><th>Seuil</th><th>Valeur mesurée</th><th>Status</th></tr></thead><tbody>${oarTableRows}</tbody></table></div>` : ''}<div class="validation-section"><div class="validation-box"><div class="validation-label">Validé par : Dr ${doctorName || '_______________'}</div>${observations ? `<div class="observations-text">${observations}</div>` : ''}</div></div><div class="footer"><p>Rapport généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p></div></body></html>`;
}

function generateModernReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string, observations?: string): string {
  return generateClassicReport(report, overallStatus, doctorName, observations);
}

function generateMinimalReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string, observations?: string): string {
  return generateClassicReport(report, overallStatus, doctorName, observations);
}

export async function generatePDFReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string, template: ReportTemplate = 'classic', observations?: string): Promise<Blob> {
  const htmlContent = generateHTMLReport(report, overallStatus, doctorName, template, observations);
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadHTMLReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string, template: ReportTemplate = 'classic', observations?: string): void {
  const htmlContent = generateHTMLReport(report, overallStatus, doctorName, template, observations);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  downloadFile(blob, `Validation_${report.patientId}_${new Date().toISOString().split('T')[0]}.html`);
}

export async function downloadPDFReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string, template: ReportTemplate = 'classic', observations?: string): Promise<void> {
  const blob = await generatePDFReport(report, overallStatus, doctorName, template, observations);
  downloadFile(blob, `Validation_${report.patientId}_${new Date().toISOString().split('T')[0]}.pdf`);
}
