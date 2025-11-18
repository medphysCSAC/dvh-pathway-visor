import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ValidationReport } from '@/types/protocol';

export type ReportTemplate = 'classic' | 'modern' | 'minimal';

export function generateHTMLReport(
  report: ValidationReport, 
  overallStatus?: 'PASS' | 'FAIL', 
  doctorName?: string,
  template: ReportTemplate = 'classic'
): string {
  switch (template) {
    case 'modern':
      return generateModernReport(report, overallStatus, doctorName);
    case 'minimal':
      return generateMinimalReport(report, overallStatus, doctorName);
    case 'classic':
    default:
      return generateClassicReport(report, overallStatus, doctorName);
  }
}

function generateClassicReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string): string {
  const finalStatus = overallStatus || report.overallStatus;
  const { protocolName, patientId, evaluationDate, prescriptionResults, constraintResults } = report;
  const statusColor = finalStatus === 'PASS' ? '#22c55e' : '#ef4444';
  
  const ptvMetrics = report.ptvQualityMetrics || [];
  
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Validation - ${protocolName}</title><style>@media print{@page{size:A4;margin:20mm 25mm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page-break{page-break-before:always}.no-break{page-break-inside:avoid}table{page-break-inside:avoid}tbody tr{page-break-inside:avoid}}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Times New Roman',serif;line-height:1.4;color:#000;background:white;padding:20mm 25mm;max-width:210mm;margin:0 auto}.header{text-align:center;border-bottom:3px double #000;padding-bottom:8mm;margin-bottom:8mm}.header h1{font-size:18pt;font-weight:bold;margin-bottom:3mm;text-transform:uppercase}.header p{font-size:11pt}.info-section{margin-bottom:6mm;padding:4mm;border:1px solid #ddd;background:#f9f9f9}.info-row{display:flex;margin-bottom:2mm;font-size:10pt}.info-label{font-weight:bold;width:140px}.status-box{text-align:center;padding:4mm;margin:6mm 0;border:2px solid ${statusColor};background:${statusColor}15}.status-text{font-size:14pt;font-weight:bold;color:${statusColor}}.section{margin-top:6mm;page-break-inside:avoid}.section-title{font-size:13pt;font-weight:bold;margin-bottom:4mm;padding-bottom:2mm;border-bottom:2px solid #000}table{width:100%;border-collapse:collapse;margin-bottom:6mm;font-size:9pt;page-break-inside:avoid}thead{background:#333;color:white}th{text-align:left;padding:2.5mm;font-weight:bold;border:1px solid #000}td{padding:2.5mm;border:1px solid #ddd}tbody tr{page-break-inside:avoid}tbody tr:nth-child(even){background:#f5f5f5}.pass{color:#22c55e;font-weight:bold}.fail{color:#ef4444;font-weight:bold}.warning{color:#f59e0b;font-weight:bold}.signature-section{margin-top:10mm;display:flex;justify-content:space-between;page-break-inside:avoid}.signature-box{width:45%;border-top:1px solid #000;padding-top:2mm;text-align:center}.footer{margin-top:8mm;padding-top:3mm;border-top:1px solid #ddd;font-size:8pt;text-align:center;color:#666}</style></head><body><div class="header"><h1>Rapport de Validation du Plan de Traitement</h1><p>Radiothérapie - Évaluation Dosimétrique</p></div><div class="info-section no-break"><div class="info-row"><span class="info-label">Protocole :</span><span>${protocolName}</span></div><div class="info-row"><span class="info-label">Patient ID :</span><span>${patientId}</span></div><div class="info-row"><span class="info-label">Date :</span><span>${new Date(evaluationDate).toLocaleDateString('fr-FR')}</span></div>${doctorName ? `<div class="info-row"><span class="info-label">Médecin :</span><span>${doctorName}</span></div>` : ''}</div><div class="status-box no-break"><div class="status-text">STATUT : ${finalStatus}</div></div>${ptvMetrics.length > 0 ? `<div class="section"><h2 class="section-title">1. Volumes Cibles (PTV)</h2><table><thead><tr><th>Structure</th><th>Prescription</th><th>V95%</th><th>D95%</th><th>Statut</th></tr></thead><tbody>${ptvMetrics.map(m => {
    const prescription = prescriptionResults.find(p => p.prescription.ptvName === m.structureName);
    const status = m.v95 >= 95 ? 'PASS' : m.v95 >= 90 ? 'WARNING' : 'FAIL';
    return `<tr><td>${m.structureName}</td><td>${prescription ? prescription.prescription.totalDose.toFixed(2) : 'N/A'} Gy</td><td>${m.v95.toFixed(1)}%</td><td>${m.d95.toFixed(2)} Gy</td><td class="${status.toLowerCase()}">${status}</td></tr>`;
  }).join('')}</tbody></table></div>` : ''}${constraintResults.length > 0 ? `<div class="section page-break"><h2 class="section-title">2. Organes à Risque (OAR)</h2><table><thead><tr><th>Structure</th><th>Contrainte</th><th>Limite</th><th>Mesuré</th><th>Statut</th></tr></thead><tbody>${constraintResults.map(r => `<tr><td>${r.structureName}</td><td>${r.constraint.constraintType}</td><td>${r.constraint.value.toFixed(2)} ${r.constraint.unit}</td><td>${r.measuredValue !== null ? r.measuredValue.toFixed(2) + ' ' + r.constraint.unit : 'N/A'}</td><td class="${r.status.toLowerCase()}">${r.status}</td></tr>`).join('')}</tbody></table></div>` : ''}${doctorName ? `<div class="signature-section"><div class="signature-box"><p>Date : ${new Date().toLocaleDateString('fr-FR')}</p></div><div class="signature-box"><p>Signature</p><p><strong>${doctorName}</strong></p></div></div>` : ''}<div class="footer"><p>Document généré le ${new Date().toLocaleString('fr-FR')}</p><p>DVH Analyzer</p></div></body></html>`;
}

function generateModernReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string): string {
  const finalStatus = overallStatus || report.overallStatus;
  const { protocolName, patientId, evaluationDate, prescriptionResults, constraintResults } = report;
  const statusColor = finalStatus === 'PASS' ? '#10b981' : '#ef4444';
  const statusBg = finalStatus === 'PASS' ? '#d1fae5' : '#fee2e2';
  
  const ptvMetrics = report.ptvQualityMetrics || [];
  
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Validation - ${protocolName}</title><style>@media print{@page{size:A4;margin:20mm 25mm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page-break{page-break-before:always}.no-break{page-break-inside:avoid}table{page-break-inside:avoid}tbody tr{page-break-inside:avoid}}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;line-height:1.4;color:#1f2937;padding:20mm 25mm;max-width:210mm;margin:0 auto}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:6mm;border-radius:3mm;margin-bottom:6mm}.header h1{font-size:20pt;font-weight:700;margin-bottom:2mm}.header p{font-size:10pt}.info-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm;margin-bottom:6mm}.info-card{background:#f9fafb;padding:4mm;border-radius:2mm;border-left:3px solid #667eea}.info-card-label{font-size:8pt;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:1mm}.info-card-value{font-size:11pt;font-weight:600;color:#111827}.status-banner{background:${statusBg};border:2px solid ${statusColor};border-radius:2mm;padding:4mm;text-align:center;margin-bottom:6mm}.status-text{font-size:15pt;font-weight:700;color:${statusColor}}.section{margin-bottom:6mm;page-break-inside:avoid}.section-header{display:flex;align-items:center;gap:2mm;margin-bottom:4mm}.section-number{width:7mm;height:7mm;background:#667eea;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10pt}.section-title{font-size:13pt;font-weight:700}table{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:5mm;font-size:9pt;border-radius:2mm;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);page-break-inside:avoid}thead{background:linear-gradient(to bottom,#f9fafb,#f3f4f6)}th{text-align:left;padding:3mm;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;font-size:8pt;text-transform:uppercase}td{padding:3mm;border-bottom:1px solid #f3f4f6}tbody tr{page-break-inside:avoid}.badge{display:inline-block;padding:1mm 2.5mm;border-radius:1.5mm;font-size:8pt;font-weight:600}.badge-pass{background:#d1fae5;color:#065f46}.badge-fail{background:#fee2e2;color:#991b1b}.badge-warning{background:#fef3c7;color:#92400e}.signature-area{margin-top:8mm;padding-top:4mm;border-top:2px solid #e5e7eb;display:flex;justify-content:space-between;page-break-inside:avoid}.signature-block{width:45%}.signature-line{border-top:1px solid #000;padding-top:2mm;font-weight:600;font-size:9pt}.footer{margin-top:6mm;padding-top:3mm;border-top:1px solid #e5e7eb;text-align:center;font-size:7pt;color:#9ca3af}</style></head><body><div class="header no-break"><h1>Rapport de Validation</h1><p>Plan de Traitement en Radiothérapie</p></div><div class="info-cards no-break"><div class="info-card"><div class="info-card-label">Protocole</div><div class="info-card-value">${protocolName}</div></div><div class="info-card"><div class="info-card-label">Patient</div><div class="info-card-value">${patientId}</div></div><div class="info-card"><div class="info-card-label">Date</div><div class="info-card-value">${new Date(evaluationDate).toLocaleDateString('fr-FR')}</div></div>${doctorName ? `<div class="info-card"><div class="info-card-label">Médecin</div><div class="info-card-value">${doctorName}</div></div>` : ''}</div><div class="status-banner no-break"><div class="status-text">STATUT : ${finalStatus}</div></div>${ptvMetrics.length > 0 ? `<div class="section"><div class="section-header"><div class="section-number">1</div><h2 class="section-title">Volumes Cibles (PTV)</h2></div><table><thead><tr><th>Structure</th><th>Prescription</th><th>V95%</th><th>D95%</th><th style="text-align:center">Statut</th></tr></thead><tbody>${ptvMetrics.map(m => {
    const prescription = prescriptionResults.find(p => p.prescription.ptvName === m.structureName);
    const status = m.v95 >= 95 ? 'PASS' : m.v95 >= 90 ? 'WARNING' : 'FAIL';
    return `<tr><td>${m.structureName}</td><td>${prescription ? prescription.prescription.totalDose.toFixed(2) : 'N/A'} Gy</td><td>${m.v95.toFixed(1)}%</td><td>${m.d95.toFixed(2)} Gy</td><td style="text-align:center"><span class="badge badge-${status.toLowerCase()}">${status}</span></td></tr>`;
  }).join('')}</tbody></table></div>` : ''}${constraintResults.length > 0 ? `<div class="section ${ptvMetrics.length > 5 ? 'page-break' : ''}"><div class="section-header"><div class="section-number">2</div><h2 class="section-title">Organes à Risque (OAR)</h2></div><table><thead><tr><th>Structure</th><th>Contrainte</th><th>Limite</th><th>Mesuré</th><th style="text-align:center">Statut</th></tr></thead><tbody>${constraintResults.map(r => `<tr><td>${r.structureName}</td><td>${r.constraint.constraintType}</td><td>${r.constraint.value.toFixed(2)} ${r.constraint.unit}</td><td>${r.measuredValue !== null ? r.measuredValue.toFixed(2) + ' ' + r.constraint.unit : 'N/A'}</td><td style="text-align:center"><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td></tr>`).join('')}</tbody></table></div>` : ''}${doctorName ? `<div class="signature-area"><div class="signature-block"><div class="signature-line">${new Date().toLocaleDateString('fr-FR')}</div></div><div class="signature-block"><div class="signature-line">${doctorName}</div></div></div>` : ''}<div class="footer"><p>Généré le ${new Date().toLocaleString('fr-FR')} - DVH Analyzer</p></div></body></html>`;
}

function generateMinimalReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string): string {
  const finalStatus = overallStatus || report.overallStatus;
  const { protocolName, patientId, evaluationDate, prescriptionResults, constraintResults } = report;
  const statusColor = finalStatus === 'PASS' ? '#059669' : '#dc2626';
  
  const ptvMetrics = report.ptvQualityMetrics || [];
  
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Validation - ${protocolName}</title><style>@media print{@page{size:A4;margin:20mm 25mm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page-break{page-break-before:always}.no-break{page-break-inside:avoid}table{page-break-inside:avoid}tbody tr{page-break-inside:avoid}}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;line-height:1.3;color:#000;padding:20mm 25mm;font-size:9pt;max-width:210mm;margin:0 auto}.header{margin-bottom:6mm;padding-bottom:3mm;border-bottom:3px solid #000}.header h1{font-size:16pt;font-weight:bold;margin-bottom:2mm}.header div{font-size:10pt}.info-grid{display:grid;grid-template-columns:auto 1fr;gap:2mm 4mm;margin-bottom:5mm;font-size:9pt}.info-label{font-weight:bold}.status-line{text-align:center;padding:3mm 0;margin:5mm 0;border-top:2px solid ${statusColor};border-bottom:2px solid ${statusColor}}.status-line strong{font-size:13pt;color:${statusColor}}.section{margin-bottom:5mm;page-break-inside:avoid}.section-title{font-size:11pt;font-weight:bold;margin-bottom:3mm;padding:2mm 0;border-bottom:1px solid #000}table{width:100%;border-collapse:collapse;margin-bottom:4mm;font-size:8pt;page-break-inside:avoid}thead{background:#f0f0f0}th{text-align:left;padding:2mm;font-weight:bold;border:1px solid #000}td{padding:2mm;border:1px solid #ccc}tbody tr{page-break-inside:avoid}tbody tr:nth-child(even){background:#fafafa}.status-cell{font-weight:bold;text-align:center}.pass{color:#059669}.fail{color:#dc2626}.warning{color:#d97706}.signature{margin-top:8mm;page-break-inside:avoid}.signature-row{display:flex;justify-content:space-between;margin-top:3mm}.signature-box{width:45%;text-align:center}.signature-line{border-top:1px solid #000;margin-top:8mm;padding-top:1mm;font-size:8pt}.footer{margin-top:6mm;padding-top:2mm;border-top:1px solid #ccc;font-size:7pt;color:#666;text-align:right}</style></head><body><div class="header no-break"><h1>VALIDATION DU PLAN DE TRAITEMENT</h1><div>Radiothérapie</div></div><div class="info-grid no-break"><span class="info-label">Protocole :</span><span>${protocolName}</span><span class="info-label">Patient :</span><span>${patientId}</span><span class="info-label">Date :</span><span>${new Date(evaluationDate).toLocaleDateString('fr-FR')}</span>${doctorName ? `<span class="info-label">Validateur :</span><span>${doctorName}</span>` : ''}</div><div class="status-line no-break"><strong>STATUT : ${finalStatus}</strong></div>${ptvMetrics.length > 0 ? `<div class="section"><h2 class="section-title">VOLUMES CIBLES (PTV)</h2><table><thead><tr><th>Structure</th><th>Prescription</th><th>V95%</th><th>D95%</th><th style="width:60px">Statut</th></tr></thead><tbody>${ptvMetrics.map(m => {
    const prescription = prescriptionResults.find(p => p.prescription.ptvName === m.structureName);
    const status = m.v95 >= 95 ? 'PASS' : m.v95 >= 90 ? 'WARNING' : 'FAIL';
    return `<tr><td>${m.structureName}</td><td>${prescription ? prescription.prescription.totalDose.toFixed(2) : 'N/A'} Gy</td><td>${m.v95.toFixed(1)}%</td><td>${m.d95.toFixed(2)} Gy</td><td class="status-cell ${status.toLowerCase()}">${status}</td></tr>`;
  }).join('')}</tbody></table></div>` : ''}${constraintResults.length > 0 ? `<div class="section ${ptvMetrics.length > 6 ? 'page-break' : ''}"><h2 class="section-title">ORGANES À RISQUE (OAR)</h2><table><thead><tr><th>Structure</th><th>Contrainte</th><th>Limite</th><th>Mesuré</th><th style="width:60px">Statut</th></tr></thead><tbody>${constraintResults.map(r => `<tr><td>${r.structureName}</td><td>${r.constraint.constraintType}</td><td>${r.constraint.value.toFixed(2)} ${r.constraint.unit}</td><td>${r.measuredValue !== null ? r.measuredValue.toFixed(2) + ' ' + r.constraint.unit : 'N/A'}</td><td class="status-cell ${r.status.toLowerCase()}">${r.status}</td></tr>`).join('')}</tbody></table></div>` : ''}${doctorName ? `<div class="signature"><div class="signature-row"><div class="signature-box"><div class="signature-line">${new Date().toLocaleDateString('fr-FR')}</div></div><div class="signature-box"><div class="signature-line">${doctorName}</div></div></div></div>` : ''}<div class="footer">Généré le ${new Date().toLocaleString('fr-FR')} - DVH Analyzer</div></body></html>`;
}

export async function generatePDFReport(
  report: ValidationReport,
  overallStatus?: 'PASS' | 'FAIL',
  doctorName?: string,
  template: ReportTemplate = 'classic'
): Promise<Blob> {
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.innerHTML = generateHTMLReport(report, overallStatus, doctorName, template);
  document.body.appendChild(tempDiv);

  try {
    const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true, logging: false });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const imgData = canvas.toDataURL('image/png');
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
    document.body.removeChild(tempDiv);
  }
}

export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadHTMLReport(
  report: ValidationReport,
  overallStatus?: 'PASS' | 'FAIL',
  doctorName?: string,
  template: ReportTemplate = 'classic'
): void {
  const html = generateHTMLReport(report, overallStatus, doctorName, template);
  const blob = new Blob([html], { type: 'text/html' });
  downloadFile(blob, `Validation_${report.patientId}_${new Date().toISOString().split('T')[0]}.html`);
}

export async function downloadPDFReport(
  report: ValidationReport,
  overallStatus?: 'PASS' | 'FAIL',
  doctorName?: string,
  template: ReportTemplate = 'classic'
): Promise<void> {
  const blob = await generatePDFReport(report, overallStatus, doctorName, template);
  downloadFile(blob, `Validation_${report.patientId}_${new Date().toISOString().split('T')[0]}.pdf`);
}
