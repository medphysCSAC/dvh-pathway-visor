import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ValidationReport } from '@/types/protocol';

/**
 * Génère un rapport HTML standalone pour impression
 */
export function generateHTMLReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string): string {
  const finalStatus = overallStatus || report.overallStatus;
  const { protocolName, patientId, evaluationDate, prescriptionResults, constraintResults } = report;
  
  const statusColor = finalStatus === 'PASS' ? '#22c55e' : '#ef4444';
  const statusIcon = finalStatus === 'PASS' ? '✅' : '❌';
  
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport de Validation - ${protocolName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 2rem;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    
    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    
    .header p {
      opacity: 0.9;
      font-size: 1.1rem;
    }
    
    .content {
      padding: 2rem;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: #f3f4f6;
      border-radius: 8px;
    }
    
    .info-item {
      display: flex;
      flex-direction: column;
    }
    
    .info-label {
      font-size: 0.875rem;
      color: #6b7280;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.25rem;
    }
    
    .info-value {
      font-size: 1.125rem;
      font-weight: 600;
      color: #111827;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 1rem;
      background: ${statusColor};
      color: white;
    }
    
    .section {
      margin-bottom: 2rem;
    }
    
    .section-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e7eb;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    
    thead {
      background: #f9fafb;
    }
    
    th {
      text-align: left;
      padding: 1rem;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    td {
      padding: 0.875rem 1rem;
      border-bottom: 1px solid #f3f4f6;
    }
    
    tbody tr:hover {
      background: #f9fafb;
    }
    
    tbody tr:last-child td {
      border-bottom: none;
    }
    
    .status-pass {
      color: #059669;
      font-weight: 600;
    }
    
    .status-fail {
      color: #dc2626;
      font-weight: 600;
    }
    
    .status-warning {
      color: #d97706;
      font-weight: 600;
    }
    
    .status-not-evaluated {
      color: #6b7280;
      font-weight: 600;
    }
    
    .warning-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 1rem;
      margin: 1rem 0;
      border-radius: 4px;
    }
    
    .warning-box ul {
      margin-left: 1.5rem;
      margin-top: 0.5rem;
    }
    
    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 0.875rem;
    }
    
    .no-print {
      text-align: center;
      margin: 2rem 0;
    }
    
    .btn-print {
      background: #667eea;
      color: white;
      border: none;
      padding: 0.75rem 2rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
      transition: all 0.2s;
    }
    
    .btn-print:hover {
      background: #5568d3;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .container {
        box-shadow: none;
      }
      
      .no-print {
        display: none;
      }
      
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Rapport de Validation de Plan</h1>
      <p>Protocole: ${protocolName}</p>
    </div>
    
    <div class="content">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Patient ID</span>
          <span class="info-value">${patientId}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Protocole</span>
          <span class="info-value">${protocolName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Date d'évaluation</span>
          <span class="info-value">${new Date(evaluationDate).toLocaleDateString('fr-FR')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Statut Global</span>
          <span class="status-badge">${statusIcon} ${finalStatus}</span>
        </div>
      </div>
      
      ${doctorName ? `
      <div style="margin: 1.5rem 0; padding: 1rem; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
        <p style="margin: 0; font-size: 1rem; color: #166534;">
          <strong>✓ Validé par Dr ${doctorName}</strong>
        </p>
      </div>
      ` : ''}
      
      ${report.planSummary ? `
      <div class="section">
        <h2 class="section-title">📊 Résumé du plan de traitement</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">PTV principal</span>
            <span class="info-value">${report.planSummary.primaryPTV}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Dose de prescription (D50)</span>
            <span class="info-value">${report.planSummary.prescriptionDose.toFixed(2)} Gy</span>
          </div>
          <div class="info-item">
            <span class="info-label">Nombre de structures</span>
            <span class="info-value">${report.planSummary.ptvCount} PTV • ${report.planSummary.oarCount} OAR</span>
          </div>
        </div>
      </div>
      ` : ''}
      
      ${report.ptvQualityMetrics && report.ptvQualityMetrics.length > 0 ? `
      <div class="section">
        <h2 class="section-title">🎯 Qualité des volumes cibles (PTV)</h2>
        <table>
          <thead>
            <tr>
              <th>Structure</th>
              <th>D<sub>95%</sub></th>
              <th>D<sub>98%</sub></th>
              <th>D<sub>50%</sub></th>
              <th>D<sub>2%</sub></th>
              <th>V<sub>95%</sub></th>
              <th>HI</th>
              <th>CI</th>
              <th>CN</th>
            </tr>
          </thead>
          <tbody>
            ${report.ptvQualityMetrics.map(m => `
              <tr>
                <td><strong>${m.structureName}</strong></td>
                <td>${m.d95.toFixed(2)} Gy</td>
                <td>${m.d98.toFixed(2)} Gy</td>
                <td>${m.d50.toFixed(2)} Gy</td>
                <td>${m.d2.toFixed(2)} Gy</td>
                <td class="${m.v95 >= 95 ? 'status-pass' : 'status-fail'}">${m.v95.toFixed(1)}%</td>
                <td class="${m.hi < 0.15 ? 'status-pass' : 'status-fail'}">${m.hi.toFixed(3)}</td>
                <td class="${Math.abs(1 - m.ci) < 0.1 ? 'status-pass' : 'status-fail'}">${m.ci.toFixed(3)}</td>
                <td>${m.cn.toFixed(3)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 1rem; padding: 1rem; background: #f3f4f6; border-radius: 4px; font-size: 0.875rem;">
          <p><strong>Indices de qualité :</strong></p>
          <ul style="margin-left: 1.5rem; margin-top: 0.5rem;">
            <li><strong>HI (Homogeneity Index)</strong> : (D2% - D98%) / D50%. Idéal &lt; 0.1</li>
            <li><strong>CI (Conformity Index)</strong> : V95% / 95%. Idéal ≈ 1</li>
            <li><strong>CN (Conformation Number)</strong> : Mesure la conformation 3D. Idéal ≈ 1</li>
            <li><strong>V95%</strong> : Volume recevant 95% de la dose. Objectif ≥ 95%</li>
          </ul>
        </div>
      </div>
      ` : ''}
      
      
      <div class="section">
        <h2 class="section-title">🛡️ Contraintes OAR (Organes à Risque)</h2>
        <table>
          <thead>
            <tr>
              <th>Organe</th>
              <th>Contrainte</th>
              <th>Valeur Mesurée</th>
              <th>Seuil</th>
              <th>Observation</th>
            </tr>
          </thead>
          <tbody>
            ${constraintResults.map(cr => {
              const constraintDesc = cr.constraint.constraintType === 'Vx' 
                ? `V${cr.constraint.target}Gy`
                : cr.constraint.constraintType === 'Dx'
                ? `D${cr.constraint.target}%`
                : cr.constraint.constraintType;
              
              return `
                <tr>
                  <td><strong>${cr.structureName}</strong></td>
                  <td>${constraintDesc}</td>
                  <td>${cr.measuredValue.toFixed(1)} ${cr.constraint.unit}</td>
                  <td>&lt; ${cr.constraint.value} ${cr.constraint.unit}</td>
                  <td class="${
                    cr.status === 'PASS' ? 'status-pass' : 
                    cr.status === 'WARNING' ? 'status-warning' : 
                    cr.status === 'FAIL' ? 'status-fail' : 
                    'status-not-evaluated'
                  }">
                    ${
                      cr.status === 'PASS' ? '✅ PASS' : 
                      cr.status === 'WARNING' ? '⚠️ WARNING' : 
                      cr.status === 'FAIL' ? '❌ FAIL' : 
                      'Non évalué'
                    }
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      ${report.unmatchedStructures.length > 0 ? `
        <div class="section">
          <h2 class="section-title">⚠️ Structures Non Trouvées</h2>
          <div class="warning-box">
            <p><strong>Les structures suivantes du protocole n'ont pas été trouvées dans le fichier DVH:</strong></p>
            <ul>
              ${report.unmatchedStructures.map(s => `<li>${s}</li>`).join('')}
            </ul>
            <p style="margin-top: 0.5rem;"><em>Vérifiez les noms des structures ou utilisez le mapping manuel.</em></p>
          </div>
        </div>
      ` : ''}
      
      <div class="footer">
        <p>Rapport généré le ${new Date().toLocaleString('fr-FR')}</p>
        <p style="margin-top: 0.5rem;">DVH Analyzer - Outil de validation de plans - Centre Sidi Abdellah</p>
      </div>
    </div>
  </div>
  
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimer ce rapport</button>
  </div>
</body>
</html>
  `;
  
  return html;
}

/**
 * Génère un rapport PDF
 */
export async function generatePDFReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string): Promise<Blob> {
  // Créer un élément HTML temporaire
  const htmlContent = generateHTMLReport(report, overallStatus, doctorName);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '1200px';
  document.body.appendChild(tempDiv);
  
  // Supprimer le bouton d'impression
  const printButton = tempDiv.querySelector('.no-print');
  if (printButton) {
    printButton.remove();
  }
  
  try {
    // Convertir en canvas
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      logging: false,
      useCORS: true
    });
    
    // Créer le PDF
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    let position = 0;
    
    // Ajouter la première page
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // Ajouter des pages supplémentaires si nécessaire
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Retourner le blob
    return pdf.output('blob');
    
  } finally {
    // Nettoyer
    document.body.removeChild(tempDiv);
  }
}

/**
 * Télécharge un fichier
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Télécharge le rapport HTML
 */
export function downloadHTMLReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string): void {
  const html = generateHTMLReport(report, overallStatus, doctorName);
  const blob = new Blob([html], { type: 'text/html' });
  const filename = `${report.patientId}_${report.protocolName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
  downloadFile(blob, filename);
}

/**
 * Télécharge le rapport PDF
 */
export async function downloadPDFReport(report: ValidationReport, overallStatus?: 'PASS' | 'FAIL', doctorName?: string): Promise<void> {
  const blob = await generatePDFReport(report, overallStatus, doctorName);
  const filename = `${report.patientId}_${report.protocolName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  downloadFile(blob, filename);
}
