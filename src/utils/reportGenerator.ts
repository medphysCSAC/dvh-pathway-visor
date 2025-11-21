import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ValidationReport } from '@/types/protocol';

export type ReportTemplate = 'classic' | 'modern' | 'minimal';

export interface ReportConfig {
  patientId: string;
  protocolName: string;
  protocolId?: string;
  protocolVersion?: string;
  physicianName?: string;
  dosimetristName?: string;
  observations?: string;
  dvhFiles?: { rel: string; abs?: string };
  appVersion?: string;
  watermark?: 'DRAFT' | 'FINAL' | null;
}

// Helper functions
function getStatusBadgeHTML(status: string): string {
  const icons = { PASS: '✓', FAIL: '✗', WARNING: '⚠', NOT_EVALUATED: '—' };
  const colors = {
    PASS: { bg: '#D3F9D8', color: '#2D7A3E', border: '#2D7A3E' },
    FAIL: { bg: '#FFE0E0', color: '#C92A2A', border: '#C92A2A' },
    WARNING: { bg: '#FFE8CC', color: '#E67700', border: '#E67700' },
    NOT_EVALUATED: { bg: '#F1F3F5', color: '#868E96', border: '#868E96' }
  };
  const c = colors[status as keyof typeof colors] || colors.NOT_EVALUATED;
  return `<span class="status-badge" style="background:${c.bg};color:${c.color};border:1px solid ${c.border}">${icons[status as keyof typeof icons]} ${status}</span>`;
}

function calculateDeviation(measured: number, threshold: number): string {
  const deviation = ((measured - threshold) / threshold) * 100;
  const sign = deviation > 0 ? '+' : '';
  return `${sign}${deviation.toFixed(1)}%`;
}

function getPriorityIcon(priority: string): string {
  const icons = { 
    'mandatory': '●', 
    'optimal': '○', 
    'desirable': '−' 
  };
  return icons[priority as keyof typeof icons] || '○';
}

function getPriorityLabel(priority: string): string {
  const labels = {
    'mandatory': 'Obligatoire',
    'optimal': 'Optimale',
    'desirable': 'Souhaitable'
  };
  return labels[priority as keyof typeof labels] || priority;
}

export function generateHTMLReport(
  report: ValidationReport, 
  overallStatus?: 'PASS' | 'FAIL', 
  doctorName?: string,
  template: ReportTemplate = 'classic',
  observations?: string
): string {
  const finalStatus = overallStatus || report.overallStatus;
  const { protocolName, patientId, evaluationDate, constraintResults, prescriptionResults } = report;
  const ptvMetrics = report.ptvQualityMetrics || [];
  
  // Count statuses
  const passCount = constraintResults.filter(c => c.status === 'PASS').length;
  const failCount = constraintResults.filter(c => c.status === 'FAIL').length;
  const warningCount = constraintResults.filter(c => c.status === 'WARNING').length;
  const notEvaluatedCount = constraintResults.filter(c => c.status === 'NOT_EVALUATED').length;
  const totalConstraints = constraintResults.length;
  
  // Identify critical failures
  const criticalFailures = constraintResults.filter(
    c => c.status === 'FAIL' && c.constraint.priority === 'mandatory'
  );
  const warnings = constraintResults.filter(c => c.status === 'WARNING');

  // CSS Styles
  const styles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Times New Roman', serif; 
      line-height: 1.2; 
      color: #000; 
      background: white; 
      padding: 20mm 15mm; 
      max-width: 210mm; 
      margin: 0 auto; 
    }
    .report-container { max-width: 100%; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    
    /* Header */
    .report-header { 
      text-align: center; 
      border: 3px solid #000; 
      padding: 15px; 
      background: #F8F9FA; 
      margin-bottom: 20px; 
    }
    .report-title { 
      font-size: 18pt; 
      font-weight: bold; 
      text-transform: uppercase; 
      margin-bottom: 5px; 
    }
    .report-subtitle { font-size: 14pt; color: #495057; }
    
    /* Summary Card */
    .summary-card { 
      border: 3px solid #333; 
      padding: 15px; 
      background: #F8F9FA; 
      margin: 20px 0; 
    }
    .summary-title { 
      font-size: 14pt; 
      font-weight: bold; 
      margin-bottom: 12px; 
      text-align: center;
    }
    .summary-grid { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 10px; 
      font-size: 11pt; 
    }
    .summary-item { margin-bottom: 8px; }
    .summary-label { font-weight: bold; display: block; margin-bottom: 2px; }
    .summary-value { display: block; }
    .global-status { 
      text-align: center; 
      font-size: 16pt; 
      font-weight: bold; 
      margin: 15px 0; 
      padding: 10px;
      grid-column: 1 / -1;
    }
    
    /* Status Badge */
    .status-badge { 
      padding: 4px 12px; 
      border-radius: 4px; 
      font-weight: bold; 
      display: inline-block; 
      font-size: 10pt;
    }
    
    /* Section Headers */
    .section-header { 
      font-size: 14pt; 
      font-weight: bold; 
      margin: 20px 0 10px 0; 
      padding-bottom: 5px; 
      border-bottom: 2px solid #000; 
    }
    .subsection-header { 
      font-size: 12pt; 
      font-weight: bold; 
      margin: 15px 0 8px 0; 
    }
    
    /* Tables */
    .data-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 15px 0; 
      font-size: 10pt;
    }
    .data-table th { 
      background: #E9ECEF; 
      padding: 8px; 
      text-align: left; 
      border: 1px solid #CED4DA; 
      font-weight: bold; 
      font-size: 10pt;
    }
    .data-table td { 
      padding: 6px 8px; 
      border: 1px solid #CED4DA; 
    }
    .data-table tr:nth-child(even) { background: #F8F9FA; }
    .data-table tr.fail-row { 
      background: #FFE0E0; 
      border-left: 4px solid #C92A2A; 
    }
    .data-table tr.warning-row { 
      background: #FFE8CC; 
      border-left: 4px solid #E67700; 
    }
    .highlight-critical { color: #C92A2A; font-weight: bold; }
    .highlight-good { color: #2D7A3E; font-weight: bold; }
    .highlight-warning { color: #E67700; font-weight: bold; }
    .text-center { text-align: center; }
    
    /* Info Table */
    .info-table { 
      width: 100%; 
      border: 1px solid #CED4DA; 
      font-size: 10pt;
      margin: 10px 0;
    }
    .info-table td { 
      padding: 6px 10px; 
      border: 1px solid #CED4DA; 
    }
    .info-table td:first-child { 
      font-weight: bold; 
      width: 40%; 
      background: #F8F9FA; 
    }
    
    /* Alert Boxes */
    .alert-box { 
      padding: 12px; 
      margin: 10px 0; 
      border-left: 4px solid; 
      font-size: 10pt;
    }
    .alert-box.critical { 
      background: #FFE0E0; 
      border-color: #C92A2A; 
    }
    .alert-box.warning { 
      background: #FFE8CC; 
      border-color: #E67700; 
    }
    .alert-title { 
      font-weight: bold; 
      margin-bottom: 5px; 
      font-size: 11pt;
    }
    
    /* Legend */
    .legend { 
      font-size: 9pt; 
      font-style: italic; 
      padding: 10px; 
      background: #F8F9FA; 
      border-left: 3px solid #333; 
      margin-top: 10px; 
    }
    .legend strong { font-style: normal; }
    
    /* Signature Section */
    .signature-section { margin-top: 25px; }
    .signature-box { 
      border: 2px dashed #CED4DA; 
      padding: 30px 15px; 
      margin: 15px 0; 
      text-align: center; 
      min-height: 80px;
    }
    .signature-label { 
      font-weight: bold; 
      font-size: 11pt; 
      margin-bottom: 8px; 
    }
    
    /* Metadata */
    .metadata-section { 
      margin-top: 20px; 
      font-size: 9pt; 
      color: #495057; 
    }
    .metadata-table { 
      width: 100%; 
      font-size: 9pt; 
      border: 1px solid #DEE2E6; 
    }
    .metadata-table td { 
      padding: 4px 8px; 
      border: 1px solid #DEE2E6; 
    }
    .metadata-table td:first-child { 
      font-weight: bold; 
      background: #F8F9FA; 
      width: 35%; 
    }
    
    /* Footer */
    .footer { 
      margin-top: 20px; 
      padding-top: 10px; 
      border-top: 1px solid #CED4DA; 
      font-size: 9pt; 
      text-align: center; 
      color: #495057; 
    }
    
    /* Print optimization */
    @media print { 
      .section { page-break-inside: avoid; } 
      * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } 
    }
  `;

  const html = [];
  html.push('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">');
  html.push(`<title>Validation - ${protocolName}</title>`);
  html.push(`<style>${styles}</style></head><body><div class="report-container">`);
  
  // ========== HEADER ==========
  html.push('<div class="report-header">');
  html.push('<div class="report-title">Rapport de Validation du Plan de Traitement</div>');
  html.push('<div class="report-subtitle">Radiothérapie - Évaluation Dosimétrique</div>');
  html.push('</div>');
  
  // ========== SUMMARY CARD ==========
  html.push('<div class="summary-card">');
  html.push('<div class="summary-title">Résumé Exécutif</div>');
  html.push('<div class="summary-grid">');
  html.push(`<div class="global-status">${getStatusBadgeHTML(finalStatus)}</div>`);
  html.push(`<div class="summary-item"><span class="summary-label">Protocole</span><span class="summary-value">${protocolName}</span></div>`);
  html.push(`<div class="summary-item"><span class="summary-label">Patient ID</span><span class="summary-value"><strong>${patientId}</strong></span></div>`);
  html.push(`<div class="summary-item"><span class="summary-label">Date de validation</span><span class="summary-value">${new Date(evaluationDate).toLocaleDateString('fr-FR')} à ${new Date(evaluationDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></div>`);
  html.push(`<div class="summary-item"><span class="summary-label">Contraintes évaluées</span><span class="summary-value">${totalConstraints} (${passCount} PASS / ${failCount} FAIL / ${warningCount} WARNING)</span></div>`);
  html.push('</div></div>');
  
  // ========== SECTION 1: PATIENT INFO ==========
  html.push('<div class="section">');
  html.push('<div class="section-header">1. INFORMATIONS PATIENT ET PLAN</div>');
  html.push('<table class="info-table">');
  html.push(`<tr><td>ID Patient</td><td>${patientId}</td></tr>`);
  html.push(`<tr><td>Protocole de traitement</td><td>${protocolName}</td></tr>`);
  
  if (prescriptionResults && prescriptionResults.length > 0) {
    const prescriptions = prescriptionResults.map(p => 
      `${p.prescription.ptvName}: ${p.prescription.totalDose} Gy en ${p.prescription.numberOfFractions} fractions (${p.prescription.dosePerFraction} Gy/fx)`
    ).join('<br>');
    html.push(`<tr><td>Prescription(s)</td><td>${prescriptions}</td></tr>`);
  }
  
  html.push(`<tr><td>Date d'analyse</td><td>${new Date(evaluationDate).toLocaleDateString('fr-FR')} à ${new Date(evaluationDate).toLocaleTimeString('fr-FR')}</td></tr>`);
  html.push(`<tr><td>Version logiciel</td><td>DVH Analyzer v1.0</td></tr>`);
  html.push('</table></div>');
  
  // ========== SECTION 2: PTV EVALUATION ==========
  if (ptvMetrics.length > 0) {
    html.push('<div class="section">');
    html.push('<div class="section-header">2. ÉVALUATION DES VOLUMES CIBLES (PTVs)</div>');
    html.push('<p style="font-size:10pt;margin-bottom:10px">Évaluation de la couverture et de l\'homogénéité de la dose dans les volumes tumoraux.</p>');
    html.push('<table class="data-table">');
    html.push('<thead><tr><th>PTV</th><th class="text-center">D95%<br>(Gy)</th><th class="text-center">D98%<br>(Gy)</th><th class="text-center">D50%<br>(Gy)</th><th class="text-center">D2%<br>(Gy)</th><th class="text-center">HI</th><th class="text-center">CI</th><th class="text-center">Statut</th></tr></thead><tbody>');
    
    ptvMetrics.forEach(m => {
      const status = m.v95 >= 95 ? 'PASS' : 'FAIL';
      const hiClass = m.hi > 0.15 ? 'highlight-critical' : '';
      const ciClass = (m.ci < 0.9 || m.ci > 1.1) ? 'highlight-warning' : '';
      html.push(`<tr class="${status === 'FAIL' ? 'fail-row' : ''}">`);
      html.push(`<td>${m.structureName}</td>`);
      html.push(`<td class="text-center">${m.d95.toFixed(2)}</td>`);
      html.push(`<td class="text-center">${m.d98.toFixed(2)}</td>`);
      html.push(`<td class="text-center">${m.d50.toFixed(2)}</td>`);
      html.push(`<td class="text-center">${m.d2.toFixed(2)}</td>`);
      html.push(`<td class="text-center ${hiClass}">${m.hi.toFixed(3)}</td>`);
      html.push(`<td class="text-center ${ciClass}">${m.ci.toFixed(3)}</td>`);
      html.push(`<td class="text-center">${getStatusBadgeHTML(status)}</td>`);
      html.push('</tr>');
    });
    
    html.push('</tbody></table>');
    html.push('<div class="legend"><strong>Définitions et valeurs recommandées :</strong><br>');
    html.push('• HI (Homogeneity Index) = (D2% - D98%) / D50% &nbsp;|&nbsp; Recommandation : HI &lt; 0.15<br>');
    html.push('• CI (Conformity Index) = Volume traité / Volume PTV &nbsp;|&nbsp; Recommandation : 0.9 &lt; CI &lt; 1.1<br>');
    html.push('• D95%, D98% : Doses de couverture (95% et 98% du PTV doivent recevoir ces doses)</div>');
    html.push('</div>');
  }
  
  // ========== SECTION 3: OAR CONSTRAINTS ==========
  if (constraintResults.length > 0) {
    html.push('<div class="section">');
    html.push('<div class="section-header">3. CONTRAINTES ORGANES À RISQUE (OARs)</div>');
    html.push('<p style="font-size:10pt;margin-bottom:10px">Vérification des contraintes de dose pour protéger les organes sains.</p>');
    
    // Summary statistics
    html.push('<div class="summary-card" style="border-width:2px;margin-bottom:15px">');
    html.push('<div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">');
    html.push(`<div class="summary-item"><span class="summary-label">Total contraintes évaluées</span><span class="summary-value">${totalConstraints}</span></div>`);
    html.push(`<div class="summary-item"><span class="summary-label">✓ Conformes (PASS)</span><span class="summary-value highlight-good">${passCount} (${((passCount/totalConstraints)*100).toFixed(0)}%)</span></div>`);
    html.push(`<div class="summary-item"><span class="summary-label">⚠ Avertissements</span><span class="summary-value highlight-warning">${warningCount}</span></div>`);
    html.push(`<div class="summary-item"><span class="summary-label">✗ Non conformes</span><span class="summary-value highlight-critical">${failCount}</span></div>`);
    if (notEvaluatedCount > 0) {
      html.push(`<div class="summary-item"><span class="summary-label">— Non évaluées</span><span class="summary-value">${notEvaluatedCount}</span></div>`);
    }
    html.push('</div></div>');
    
    // Group by organ
    const organGroups = new Map<string, typeof constraintResults>();
    constraintResults.forEach(c => {
      const organ = c.constraint.organName;
      if (!organGroups.has(organ)) {
        organGroups.set(organ, []);
      }
      organGroups.get(organ)!.push(c);
    });
    
    // Table for each organ
    organGroups.forEach((constraints, organName) => {
      const organStatus = constraints.some(c => c.status === 'FAIL') ? 'FAIL' : 
                          constraints.some(c => c.status === 'WARNING') ? 'WARNING' : 'PASS';
      const borderColor = organStatus === 'FAIL' ? '#C92A2A' : 
                          organStatus === 'WARNING' ? '#E67700' : '#2D7A3E';
      
      html.push(`<div class="subsection-header" style="border-left:4px solid ${borderColor};padding-left:8px">${organName}</div>`);
      html.push('<table class="data-table">');
      html.push('<thead><tr><th>Contrainte</th><th>Seuil</th><th>Valeur mesurée</th><th class="text-center">Écart</th><th class="text-center">Priorité</th><th class="text-center">Statut</th></tr></thead><tbody>');
      
      constraints.forEach(c => {
        let constraintType = '', threshold = '', measuredValue = '', measuredUnit = '';
        
        if (c.constraint.constraintType === 'Dmean') {
          constraintType = 'Dmean';
          threshold = `< ${c.constraint.value} Gy`;
          measuredUnit = 'Gy';
          measuredValue = c.measuredValue.toFixed(2);
        } else if (c.constraint.constraintType === 'Dmax') {
          constraintType = 'Dmax';
          threshold = `< ${c.constraint.value} Gy`;
          measuredUnit = 'Gy';
          measuredValue = c.measuredValue.toFixed(2);
        } else if (c.constraint.constraintType === 'Vx') {
          constraintType = `V${c.constraint.target}Gy`;
          measuredUnit = c.constraint.targetUnit || '%';
          threshold = `< ${c.constraint.value} ${measuredUnit}`;
          measuredValue = c.measuredValue.toFixed(2);
        } else if (c.constraint.constraintType === 'Dx') {
          constraintType = `D${c.constraint.target}${c.constraint.targetUnit === '%' ? '%' : 'cc'}`;
          threshold = `< ${c.constraint.value} Gy`;
          measuredUnit = 'Gy';
          measuredValue = c.measuredValue.toFixed(2);
        }
        
        const deviation = c.status !== 'NOT_EVALUATED' ? calculateDeviation(c.measuredValue, c.constraint.value) : '—';
        const deviationClass = c.measuredValue > c.constraint.value ? 'highlight-critical' : 'highlight-good';
        const rowClass = c.status === 'FAIL' ? 'fail-row' : c.status === 'WARNING' ? 'warning-row' : '';
        const criticalPrefix = (c.status === 'FAIL' && c.constraint.priority === 'mandatory') ? '⚠️ ' : '';
        
        html.push(`<tr class="${rowClass}">`);
        html.push(`<td>${criticalPrefix}${constraintType}</td>`);
        html.push(`<td>${threshold}</td>`);
        html.push(`<td><strong>${measuredValue} ${measuredUnit}</strong></td>`);
        html.push(`<td class="text-center ${deviationClass}">${deviation}</td>`);
        html.push(`<td class="text-center">${getPriorityIcon(c.constraint.priority || 'optimal')} ${getPriorityLabel(c.constraint.priority || 'optimal')}</td>`);
        html.push(`<td class="text-center">${getStatusBadgeHTML(c.status)}</td>`);
        html.push('</tr>');
      });
      
      html.push('</tbody></table>');
    });
    
    html.push('</div>');
  }
  
  // ========== SECTION 4: ALERTS ==========
  if (criticalFailures.length > 0 || warnings.length > 0) {
    html.push('<div class="section">');
    html.push('<div class="section-header">4. ALERTES ET POINTS D\'ATTENTION</div>');
    
    criticalFailures.forEach(c => {
      let constraintText = '';
      if (c.constraint.constraintType === 'Vx') {
        constraintText = `V${c.constraint.target}Gy`;
      } else if (c.constraint.constraintType === 'Dx') {
        constraintText = `D${c.constraint.target}${c.constraint.targetUnit === '%' ? '%' : 'cc'}`;
      } else {
        constraintText = c.constraint.constraintType;
      }
      
      html.push('<div class="alert-box critical">');
      html.push('<div class="alert-title">⚠️ ALERTE CRITIQUE</div>');
      html.push(`<strong>${c.constraint.organName}</strong> : ${constraintText} dépasse le seuil de ${c.constraint.value} (mesuré: ${c.measuredValue.toFixed(2)})<br>`);
      html.push('<em>Action : Révision du plan requise avant validation clinique</em>');
      html.push('</div>');
    });
    
    warnings.forEach(c => {
      let constraintText = '';
      if (c.constraint.constraintType === 'Vx') {
        constraintText = `V${c.constraint.target}Gy`;
      } else if (c.constraint.constraintType === 'Dx') {
        constraintText = `D${c.constraint.target}${c.constraint.targetUnit === '%' ? '%' : 'cc'}`;
      } else {
        constraintText = c.constraint.constraintType;
      }
      
      const deviation = calculateDeviation(c.measuredValue, c.constraint.value);
      html.push('<div class="alert-box warning">');
      html.push('<div class="alert-title">⚠ AVERTISSEMENT</div>');
      html.push(`<strong>${c.constraint.organName}</strong> : ${constraintText} approche le seuil (${deviation} d'écart)<br>`);
      html.push('<em>Action : Vérifier la pertinence clinique</em>');
      html.push('</div>');
    });
    
    html.push('</div>');
  }
  
  // ========== SECTION 5: RECOMMENDATIONS ==========
  html.push('<div class="section">');
  html.push('<div class="section-header">5. RECOMMANDATIONS</div>');
  html.push('<div style="padding:10px;background:#F8F9FA;font-size:10pt">');
  
  if (finalStatus === 'PASS' && warningCount === 0) {
    html.push(`<p>Le plan respecte toutes les contraintes du protocole <strong>${protocolName}</strong>. Aucune modification requise.</p>`);
  } else if (failCount > 0) {
    html.push(`<p><strong>Non-conformités détectées :</strong> ${failCount} contrainte(s) non respectée(s). Révision obligatoire du plan.</p>`);
  } else if (warningCount > 0) {
    html.push(`<p><strong>Points d'attention :</strong> ${warningCount} avertissement(s) détecté(s). Considérer optimisation si cliniquement faisable.</p>`);
  }
  
  if (observations) {
    html.push(`<p style="margin-top:10px"><strong>Observations complémentaires :</strong><br>${observations}</p>`);
  }
  
  html.push('</div></div>');
  
  // ========== SECTION 6: VALIDATION ==========
  html.push('<div class="section signature-section">');
  html.push('<div class="section-header">6. VALIDATION ET SIGNATURE</div>');
  html.push('<table class="info-table">');
  html.push(`<tr><td>Analyse effectuée par</td><td>${doctorName || '___________________________'} (Dosimétriste/Physicien)</td></tr>`);
  html.push(`<tr><td>Date analyse</td><td>${new Date(evaluationDate).toLocaleDateString('fr-FR')} à ${new Date(evaluationDate).toLocaleTimeString('fr-FR')}</td></tr>`);
  html.push('<tr><td>Plan validé par</td><td>___________________________</td></tr>');
  html.push('<tr><td>Date validation</td><td>____/____/________</td></tr>');
  html.push('</table>');
  
  html.push('<div class="signature-box">');
  html.push('<div class="signature-label">Signature dosimétriste/physicien</div>');
  html.push('</div>');
  
  html.push('<div class="signature-box">');
  html.push('<div class="signature-label">Signature médecin validateur</div>');
  html.push('</div>');
  html.push('</div>');
  
  // ========== SECTION 7: METADATA ==========
  html.push('<div class="section metadata-section">');
  html.push('<div class="section-header">7. MÉTADONNÉES ET TRAÇABILITÉ</div>');
  html.push('<table class="metadata-table">');
  html.push('<tr><td>Application</td><td>DVH Analyzer v1.0</td></tr>');
  html.push('<tr><td>Méthode interpolation</td><td>Linéaire</td></tr>');
  html.push('<tr><td>Méthode Dmean</td><td>Intégration trapézoïdale</td></tr>');
  html.push('<tr><td>Format DVH</td><td>TomoTherapy CSV</td></tr>');
  html.push(`<tr><td>Protocole</td><td>${protocolName}</td></tr>`);
  html.push('</table></div>');
  
  // ========== FOOTER ==========
  html.push('<div class="footer">');
  html.push(`<p>Rapport généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>`);
  html.push('<p>Document confidentiel - Usage clinique uniquement</p>');
  html.push('</div>');
  
  html.push('</div></body></html>');
  
  return html.join('');
}

export async function generatePDFReport(
  report: ValidationReport, 
  overallStatus?: 'PASS' | 'FAIL', 
  doctorName?: string,
  template: ReportTemplate = 'classic',
  observations?: string
): Promise<Blob> {
  const htmlContent = generateHTMLReport(report, overallStatus, doctorName, template, observations);
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Add PDF metadata
    pdf.setProperties({
      title: `Validation - ${report.protocolName}`,
      subject: 'Rapport de Validation du Plan de Traitement',
      author: 'DVH Analyzer',
      keywords: 'radiothérapie, dosimétrie, validation, DVH',
      creator: 'DVH Analyzer v1.0'
    });

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

export function downloadHTMLReport(
  report: ValidationReport, 
  overallStatus?: 'PASS' | 'FAIL', 
  doctorName?: string,
  template: ReportTemplate = 'classic',
  observations?: string
): void {
  const htmlContent = generateHTMLReport(report, overallStatus, doctorName, template, observations);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const filename = `Validation_${report.patientId}_${new Date().toISOString().split('T')[0]}.html`;
  downloadFile(blob, filename);
}

export async function downloadPDFReport(
  report: ValidationReport, 
  overallStatus?: 'PASS' | 'FAIL', 
  doctorName?: string,
  template: ReportTemplate = 'classic',
  observations?: string
): Promise<void> {
  const blob = await generatePDFReport(report, overallStatus, doctorName, template, observations);
  const filename = `Validation_${report.patientId}_${new Date().toISOString().split('T')[0]}.pdf`;
  downloadFile(blob, filename);
}
