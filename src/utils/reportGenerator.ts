import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ValidationReport } from "@/types/protocol";

export type ReportTemplate = "classic" | "modern" | "minimal";

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
  watermark?: "DRAFT" | "FINAL" | null;
}

// Helper functions
function getStatusBadgeHTML(status: string): string {
  const icons = { PASS: "✓", FAIL: "✗", WARNING: "⚠", NOT_EVALUATED: "—" };
  const colors = {
    PASS: { bg: "#D3F9D8", color: "#2D7A3E", border: "#2D7A3E" },
    FAIL: { bg: "#FFE0E0", color: "#C92A2A", border: "#C92A2A" },
    WARNING: { bg: "#FFE8CC", color: "#E67700", border: "#E67700" },
    NOT_EVALUATED: { bg: "#F1F3F5", color: "#868E96", border: "#868E96" },
  };
  const c = colors[status as keyof typeof colors] || colors.NOT_EVALUATED;
  return `<span class="status-badge" style="background:${c.bg};color:${c.color};border:1px solid ${c.border}">${icons[status as keyof typeof icons]} ${status}</span>`;
}

function calculateDeviation(measured: number, threshold: number): string {
  const deviation = ((measured - threshold) / threshold) * 100;
  const sign = deviation > 0 ? "+" : "";
  return `${sign}${deviation.toFixed(1)}%`;
}

function getPriorityIcon(priority: string): string {
  const icons = {
    mandatory: "●",
    optimal: "○",
    desirable: "−",
  };
  return icons[priority as keyof typeof icons] || "○";
}

function getPriorityLabel(priority: string): string {
  const labels = {
    mandatory: "Obligatoire",
    optimal: "Optimale",
    desirable: "Souhaitable",
  };
  return labels[priority as keyof typeof labels] || priority;
}

export function generateHTMLReport(
  report: ValidationReport,
  overallStatus?: "PASS" | "FAIL",
  doctorName?: string,
  template: ReportTemplate = "classic",
  observations?: string,
): string {
  const finalStatus = overallStatus || report.overallStatus;
  const { protocolName, patientId, evaluationDate, constraintResults, prescriptionResults } = report;
  const ptvMetrics = report.ptvQualityMetrics || [];

  // Count statuses
  const passCount = constraintResults.filter((c) => c.status === "PASS").length;
  const failCount = constraintResults.filter((c) => c.status === "FAIL").length;
  const warningCount = constraintResults.filter((c) => c.status === "WARNING").length;
  const notEvaluatedCount = constraintResults.filter((c) => c.status === "NOT_EVALUATED").length;
  const totalConstraints = constraintResults.length;

  // Identify critical failures
  const criticalFailures = constraintResults.filter(
    (c) => c.status === "FAIL" && c.constraint.priority === "mandatory",
  );
  const warnings = constraintResults.filter((c) => c.status === "WARNING");

  // CSS Styles
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Libre Baskerville', 'Times New Roman', serif; 
      line-height: 1.3; 
      color: #000; 
      background: white; 
      padding: 0;
      margin: 0;
    }
    .report-container { 
      max-width: 210mm; 
      margin: 0 auto;
      padding: 20mm 15mm;
      position: relative;
    }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    
    /* Institutional Header */
    .institutional-header {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 15px;
      margin-bottom: 25px;
    }
    .institution-name {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    .department-name {
      font-size: 12pt;
      color: #333;
      margin-bottom: 3px;
    }
    
    /* Header */
    .report-header { 
      text-align: center; 
      border: 3px solid #000; 
      padding: 15px; 
      background: #F8F9FA; 
      margin: 25px 0 20px 0; 
    }
    .report-title { 
      font-size: 18pt; 
      font-weight: bold; 
      text-transform: uppercase; 
      margin-bottom: 5px;
      letter-spacing: 0.5px;
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
    
    /* Signature Section - PROTECTION CONTRE LES COUPURES */
    .signature-section { 
      margin-top: 25px;
      page-break-inside: avoid !important;
      page-break-before: auto !important;
      min-height: 150mm !important;
      display: block !important;
    }
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
    .report-footer {
      text-align: center;
      border-top: 2px solid #000;
      padding-top: 15px;
      margin-top: 40px;
      font-size: 9pt;
      color: #666;
    }
    .footer-institution {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .footer-contact {
      margin: 3px 0;
    }
    .footer-confidential {
      margin-top: 10px;
      font-size: 8pt;
      font-style: italic;
    }
    
    /* Print optimization */
    @media print { 
      .section { page-break-inside: avoid; } 
      .signature-section { 
        page-break-inside: avoid !important; 
        page-break-before: always !important; 
      }
      * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      @page {
        size: A4;
        margin: 20mm 15mm;
      }
    }
  `;

  const html = [];
  html.push('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">');
  html.push(`<title>Validation - ${protocolName}</title>`);
  html.push(`<style>${styles}</style></head><body><div class="report-container">`);

  // ========== INSTITUTIONAL HEADER ==========
  html.push('<div class="institutional-header">');
  html.push('<div class="institution-name">Centre Sidi Abdellah de Cancérologie</div>');
  html.push('<div class="department-name">Service de Radiothérapie</div>');
  html.push("</div>");

  // ========== HEADER ==========
  html.push('<div class="report-header">');
  html.push('<div class="report-title">Rapport de Validation du Plan de Traitement</div>');
  html.push('<div class="report-subtitle">Évaluation Dosimétrique</div>');
  html.push("</div>");

  // ========== SUMMARY CARD ==========
  html.push('<div class="summary-card">');
  html.push('<div class="summary-title">Résumé</div>');
  html.push('<div class="summary-grid">');
  html.push(`<div class="global-status">${getStatusBadgeHTML(finalStatus)}</div>`);
  html.push(
    `<div class="summary-item"><span class="summary-label">Protocole</span><span class="summary-value">${protocolName}</span></div>`,
  );
  html.push(
    `<div class="summary-item"><span class="summary-label">Patient ID</span><span class="summary-value"><strong>${patientId}</strong></span></div>`,
  );
  html.push(
    `<div class="summary-item"><span class="summary-label">Date de validation</span><span class="summary-value">${new Date(evaluationDate).toLocaleDateString("fr-FR")} à ${new Date(evaluationDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div>`,
  );
  html.push(
    `<div class="summary-item"><span class="summary-label">Contraintes évaluées</span><span class="summary-value">${totalConstraints} (${passCount} PASS / ${failCount} FAIL / ${warningCount} WARNING)</span></div>`,
  );
  html.push("</div></div>");

  // ========== SECTION 1: PATIENT INFO ==========
  html.push('<div class="section">');
  html.push('<div class="section-header">1. INFORMATIONS PATIENT ET PLAN</div>');
  html.push('<table class="info-table">');
  html.push(`<tr><td>ID Patient</td><td>${patientId}</td></tr>`);
  html.push(`<tr><td>Protocole de traitement</td><td>${protocolName}</td></tr>`);

  if (prescriptionResults && prescriptionResults.length > 0) {
    const prescriptions = prescriptionResults
      .map(
        (p) =>
          `${p.prescription.ptvName}: ${p.prescription.totalDose} Gy en ${p.prescription.numberOfFractions} fractions (${p.prescription.dosePerFraction} Gy/fx)`,
      )
      .join("<br>");
    html.push(`<tr><td>Prescription(s)</td><td>${prescriptions}</td></tr>`);
  }

  html.push(
    `<tr><td>Date d'analyse</td><td>${new Date(evaluationDate).toLocaleDateString("fr-FR")} à ${new Date(evaluationDate).toLocaleTimeString("fr-FR")}</td></tr>`,
  );
  html.push(`<tr><td>Version logiciel</td><td>DVH Analyzer v1.0</td></tr>`);
  html.push("</table></div>");

  // ========== SECTION 2: PTV EVALUATION ==========
  if (ptvMetrics.length > 0) {
    html.push('<div class="section">');
    html.push('<div class="section-header">2. ÉVALUATION DES VOLUMES CIBLES (PTVs)</div>');
    html.push(
      '<p style="font-size:10pt;margin-bottom:10px">Évaluation de la couverture et de l\'homogénéité de la dose dans les volumes tumoraux.</p>',
    );
    html.push('<table class="data-table">');
    html.push(
      '<thead><tr><th>PTV</th><th class="text-center">D95%<br>(Gy)</th><th class="text-center">D98%<br>(Gy)</th><th class="text-center">D50%<br>(Gy)</th><th class="text-center">D2%<br>(Gy)</th><th class="text-center">HI</th><th class="text-center">CI</th><th class="text-center">Statut</th></tr></thead><tbody>',
    );

    ptvMetrics.forEach((m) => {
      const status = m.v95 >= 95 ? "PASS" : "FAIL";
      const hiClass = m.hi > 0.15 ? "highlight-critical" : "";
      const ciClass = m.ci < 0.9 || m.ci > 1.1 ? "highlight-warning" : "";
      html.push(`<tr class="${status === "FAIL" ? "fail-row" : ""}">`);
      html.push(`<td>${m.structureName}</td>`);
      html.push(`<td class="text-center">${m.d95.toFixed(2)}</td>`);
      html.push(`<td class="text-center">${m.d98.toFixed(2)}</td>`);
      html.push(`<td class="text-center">${m.d50.toFixed(2)}</td>`);
      html.push(`<td class="text-center">${m.d2.toFixed(2)}</td>`);
      html.push(`<td class="text-center ${hiClass}">${m.hi.toFixed(3)}</td>`);
      html.push(`<td class="text-center ${ciClass}">${m.ci.toFixed(3)}</td>`);
      html.push(`<td class="text-center">${getStatusBadgeHTML(status)}</td>`);
      html.push("</tr>");
    });

    html.push("</tbody></table>");
    html.push('<div class="legend"><strong>Définitions et valeurs recommandées :</strong><br>');
    html.push("• HI (Homogeneity Index) = (D2% - D98%) / D50% &nbsp;|&nbsp; Recommandation : HI &lt; 0.15<br>");
    html.push(
      "• CI (Conformity Index) = Volume traité / Volume PTV &nbsp;|&nbsp; Recommandation : 0.9 &lt; CI &lt; 1.1<br>",
    );
    html.push("• D95%, D98% : Doses de couverture (95% et 98% du PTV doivent recevoir ces doses)</div>");
    html.push("</div>");
  }

  // ========== SECTION 3: OAR CONSTRAINTS ==========
  if (constraintResults.length > 0) {
    html.push('<div class="section">');
    html.push('<div class="section-header">3. CONTRAINTES ORGANES À RISQUE (OARs)</div>');
    html.push(
      '<p style="font-size:10pt;margin-bottom:10px">Vérification des contraintes de dose pour protéger les organes sains.</p>',
    );

    // Summary statistics
    html.push('<div class="summary-card" style="border-width:2px;margin-bottom:15px">');
    html.push('<div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">');
    html.push(
      `<div class="summary-item"><span class="summary-label">Total contraintes évaluées</span><span class="summary-value">${totalConstraints}</span></div>`,
    );
    html.push(
      `<div class="summary-item"><span class="summary-label">✓ Conformes (PASS)</span><span class="summary-value highlight-good">${passCount} (${((passCount / totalConstraints) * 100).toFixed(0)}%)</span></div>`,
    );
    html.push(
      `<div class="summary-item"><span class="summary-label">⚠ Avertissements</span><span class="summary-value highlight-warning">${warningCount}</span></div>`,
    );
    html.push(
      `<div class="summary-item"><span class="summary-label">✗ Non conformes</span><span class="summary-value highlight-critical">${failCount}</span></div>`,
    );
    if (notEvaluatedCount > 0) {
      html.push(
        `<div class="summary-item"><span class="summary-label">— Non évaluées</span><span class="summary-value">${notEvaluatedCount}</span></div>`,
      );
    }
    html.push("</div></div>");

    // Group by organ
    const organGroups = new Map<string, typeof constraintResults>();
    constraintResults.forEach((c) => {
      const organ = c.constraint.organName;
      if (!organGroups.has(organ)) {
        organGroups.set(organ, []);
      }
      organGroups.get(organ)!.push(c);
    });

    // Table for each organ
    organGroups.forEach((constraints, organName) => {
      const organStatus = constraints.some((c) => c.status === "FAIL")
        ? "FAIL"
        : constraints.some((c) => c.status === "WARNING")
          ? "WARNING"
          : "PASS";
      const borderColor = organStatus === "FAIL" ? "#C92A2A" : organStatus === "WARNING" ? "#E67700" : "#2D7A3E";

      html.push(
        `<div class="subsection-header" style="border-left:4px solid ${borderColor};padding-left:8px">${organName}</div>`,
      );
      html.push('<table class="data-table">');
      html.push(
        '<thead><tr><th>Contrainte</th><th>Seuil</th><th>Valeur mesurée</th><th class="text-center">Écart</th><th class="text-center">Priorité</th><th class="text-center">Statut</th></tr></thead><tbody>',
      );

      constraints.forEach((c) => {
        let constraintType = "",
          threshold = "",
          measuredValue = "",
          measuredUnit = "";

        if (c.constraint.constraintType === "Dmean") {
          constraintType = "Dmean";
          threshold = `< ${c.constraint.value} Gy`;
          measuredUnit = "Gy";
          measuredValue = c.measuredValue.toFixed(2);
        } else if (c.constraint.constraintType === "Dmax") {
          constraintType = "Dmax";
          threshold = `< ${c.constraint.value} Gy`;
          measuredUnit = "Gy";
          measuredValue = c.measuredValue.toFixed(2);
        } else if (c.constraint.constraintType === "Vx") {
          constraintType = `V${c.constraint.target}Gy`;
          measuredUnit = c.constraint.targetUnit || "%";
          threshold = `< ${c.constraint.value} ${measuredUnit}`;
          measuredValue = c.measuredValue.toFixed(2);
        } else if (c.constraint.constraintType === "Dx") {
          constraintType = `D${c.constraint.target}${c.constraint.targetUnit === "%" ? "%" : "cc"}`;
          threshold = `< ${c.constraint.value} Gy`;
          measuredUnit = "Gy";
          measuredValue = c.measuredValue.toFixed(2);
        }

        const deviation = c.status !== "NOT_EVALUATED" ? calculateDeviation(c.measuredValue, c.constraint.value) : "—";
        const deviationClass = c.measuredValue > c.constraint.value ? "highlight-critical" : "highlight-good";
        const rowClass = c.status === "FAIL" ? "fail-row" : c.status === "WARNING" ? "warning-row" : "";
        const criticalPrefix = c.status === "FAIL" && c.constraint.priority === "mandatory" ? "⚠️ " : "";

        html.push(`<tr class="${rowClass}">`);
        html.push(`<td>${criticalPrefix}${constraintType}</td>`);
        html.push(`<td>${threshold}</td>`);
        html.push(`<td><strong>${measuredValue} ${measuredUnit}</strong></td>`);
        html.push(`<td class="text-center ${deviationClass}">${deviation}</td>`);
        html.push(
          `<td class="text-center">${getPriorityIcon(c.constraint.priority || "optimal")} ${getPriorityLabel(c.constraint.priority || "optimal")}</td>`,
        );
        html.push(`<td class="text-center">${getStatusBadgeHTML(c.status)}</td>`);
        html.push("</tr>");
      });

      html.push("</tbody></table>");
    });

    html.push("</div>");
  }

  // ========== SECTION 4: VALIDATION ==========
  html.push('<div class="section signature-section" id="section-4">');
  html.push('<div class="section-header">4. VALIDATION ET SIGNATURE</div>');
  html.push('<table class="info-table">');
  html.push(`<tr><td>Plan validé par</td><td>${doctorName || "___________________________"}</td></tr>`);
  html.push("<tr><td>Date de validation</td><td>____/____/________</td></tr>");
  html.push("</table>");

  html.push('<div class="signature-box">');
  html.push('<div class="signature-label">Signature médecin validateur</div>');
  html.push("</div>");
  html.push("</div>");

  // ========== SECTION 5: METADATA ==========
  html.push('<div class="section metadata-section">');
  html.push('<div class="section-header">5. MÉTADONNÉES ET TRAÇABILITÉ</div>');
  html.push('<table class="metadata-table">');
  html.push("<tr><td>Application</td><td>DVH Analyzer v1.0</td></tr>");
  html.push("<tr><td>Méthode interpolation</td><td>Linéaire</td></tr>");
  html.push("<tr><td>Méthode Dmean</td><td>Intégration trapézoïdale</td></tr>");
  html.push("<tr><td>Format DVH</td><td>TomoTherapy CSV</td></tr>");
  html.push(`<tr><td>Protocole</td><td>${protocolName}</td></tr>`);
  html.push("</table></div>");

  // ========== FOOTER ==========
  html.push('<div class="report-footer">');
  html.push('<p class="footer-institution">Centre Sidi Abdellah de Cancérologie</p>');
  html.push(
    `<p class="footer-confidential">Rapport généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")} - Document confidentiel - Usage clinique uniquement</p>`,
  );
  html.push("</div>");

  html.push("</div></body></html>");

  return html.join("");
}

export async function generatePDFReport(
  report: ValidationReport,
  overallStatus?: "PASS" | "FAIL",
  doctorName?: string,
  template: ReportTemplate = "classic",
  observations?: string,
): Promise<Blob> {
  const htmlContent = generateHTMLReport(report, overallStatus, doctorName, template, observations);

  // Create temporary container with precise A4 dimensions
  const container = document.createElement("div");
  container.innerHTML = htmlContent;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.width = "794px"; // A4 width in pixels at 96 DPI
  container.style.backgroundColor = "#ffffff";
  container.style.padding = "0";
  container.style.margin = "0";
  document.body.appendChild(container);

  try {
    // Identify section 4 element for page break protection
    const section4Element = container.querySelector("#section-4");
    
    // Optimized html2canvas options for better quality
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      windowWidth: 794,
      windowHeight: 1123,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: "#ffffff",
      imageTimeout: 15000,
    });

    // A4 dimensions in mm
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = {
      top: 20,
      right: 15,
      bottom: 20,
      left: 15,
    };

    // Content area dimensions
    const contentWidth = pageWidth - margin.left - margin.right;
    const contentHeight = pageHeight - margin.top - margin.bottom;
    
    // Calculate section 4 position if found
    let section4Position: { top: number; height: number } | null = null;
    if (section4Element) {
      const section4Rect = section4Element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      section4Position = {
        top: ((section4Rect.top - containerRect.top) / containerRect.height) * imgHeight,
        height: (section4Rect.height / containerRect.height) * imgHeight,
      };
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    // Add PDF metadata
    pdf.setProperties({
      title: `Validation - ${report.protocolName}`,
      subject: "Rapport de Validation du Plan de Traitement",
      author: "DVH Analyzer",
      keywords: "radiothérapie, dosimétrie, validation, DVH",
      creator: "DVH Analyzer v1.0",
    });

    // Convert canvas to image
    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    // Calculate image dimensions
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let remainingHeight = imgHeight;
    let sourceY = 0;
    let pageNumber = 1;

    while (remainingHeight > 0) {
      // Check if section 4 would be split on this page
      if (section4Position) {
        const pageEndY = sourceY + contentHeight;
        const section4StartsOnThisPage = sourceY <= section4Position.top && section4Position.top < pageEndY;
        const section4EndsAfterThisPage = section4Position.top + section4Position.height > pageEndY;
        
        // If section 4 starts on this page but would be cut, force page break before it
        if (section4StartsOnThisPage && section4EndsAfterThisPage) {
          // Calculate remaining space on this page before section 4
          const spaceBeforeSection4 = section4Position.top - sourceY;
          
          // If there's minimal content before section 4 (< 30mm), skip this page content
          if (spaceBeforeSection4 > 30) {
            // Add page with content up to section 4
            if (pageNumber > 1) {
              pdf.addPage();
            }
            
            // Add header
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.text("DVH Analyzer - Rapport d'analyse", margin.left, margin.top - 5);
            pdf.text(`Page ${pageNumber}`, pageWidth - margin.right - 15, margin.top - 5);
            
            // Add content before section 4
            const canvasSourceY = (sourceY / imgHeight) * canvas.height;
            const canvasHeight = (spaceBeforeSection4 / imgHeight) * canvas.height;
            
            const pageCanvas = document.createElement("canvas");
            pageCanvas.width = canvas.width;
            pageCanvas.height = canvasHeight;
            const pageContext = pageCanvas.getContext("2d");
            
            if (pageContext) {
              pageContext.drawImage(canvas, 0, canvasSourceY, canvas.width, canvasHeight, 0, 0, canvas.width, canvasHeight);
              const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);
              pdf.addImage(pageImgData, "JPEG", margin.left, margin.top, imgWidth, spaceBeforeSection4, "", "FAST");
            }
            
            // Add footer
            pdf.setFontSize(9);
            const today = new Date().toLocaleDateString("fr-FR");
            pdf.text(today, margin.left, pageHeight - margin.bottom + 10);
            pdf.text("Centre Sidi Abdellah de Cancérologie", pageWidth / 2, pageHeight - margin.bottom + 10, {
              align: "center",
            });
            pdf.text("DVH Analyzer v1.0", pageWidth - margin.right - 25, pageHeight - margin.bottom + 10);
            
            sourceY = section4Position.top;
            pageNumber++;
          }
          
          // Now add section 4 on a new page
          pdf.addPage();
          
          // Add header
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.text("DVH Analyzer - Rapport d'analyse", margin.left, margin.top - 5);
          pdf.text(`Page ${pageNumber}`, pageWidth - margin.right - 15, margin.top - 5);
          
          // Add section 4 content
          const section4CanvasY = (section4Position.top / imgHeight) * canvas.height;
          const section4CanvasHeight = (section4Position.height / imgHeight) * canvas.height;
          
          const section4Canvas = document.createElement("canvas");
          section4Canvas.width = canvas.width;
          section4Canvas.height = section4CanvasHeight;
          const section4Context = section4Canvas.getContext("2d");
          
          if (section4Context) {
            section4Context.drawImage(canvas, 0, section4CanvasY, canvas.width, section4CanvasHeight, 0, 0, canvas.width, section4CanvasHeight);
            const section4ImgData = section4Canvas.toDataURL("image/jpeg", 0.95);
            pdf.addImage(section4ImgData, "JPEG", margin.left, margin.top, imgWidth, section4Position.height, "", "FAST");
          }
          
          // Add footer
          pdf.setFontSize(9);
          const today = new Date().toLocaleDateString("fr-FR");
          pdf.text(today, margin.left, pageHeight - margin.bottom + 10);
          pdf.text("Centre Sidi Abdellah de Cancérologie", pageWidth / 2, pageHeight - margin.bottom + 10, {
            align: "center",
          });
          pdf.text("DVH Analyzer v1.0", pageWidth - margin.right - 25, pageHeight - margin.bottom + 10);
          
          sourceY = section4Position.top + section4Position.height;
          remainingHeight = imgHeight - sourceY;
          pageNumber++;
          
          // Clear section4Position so we don't process it again
          section4Position = null;
          continue;
        }
      }
      
      // Normal page processing
      if (pageNumber > 1) {
        pdf.addPage();
      }

      // Add header
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("DVH Analyzer - Rapport d'analyse", margin.left, margin.top - 5);
      pdf.text(`Page ${pageNumber}`, pageWidth - margin.right - 15, margin.top - 5);

      // Calculate the height of content for this page
      const pageContentHeight = Math.min(remainingHeight, contentHeight);

      // Calculate the source Y position on the canvas
      const canvasSourceY = (sourceY / imgHeight) * canvas.height;
      const canvasHeight = (pageContentHeight / imgHeight) * canvas.height;

      // Create a temporary canvas for this page slice
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = canvasHeight;
      const pageContext = pageCanvas.getContext("2d");

      if (pageContext) {
        pageContext.drawImage(canvas, 0, canvasSourceY, canvas.width, canvasHeight, 0, 0, canvas.width, canvasHeight);

        const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);

        // Add the image slice to the PDF
        pdf.addImage(pageImgData, "JPEG", margin.left, margin.top, imgWidth, pageContentHeight, "", "FAST");
      }

      // Add footer
      pdf.setFontSize(9);
      const today = new Date().toLocaleDateString("fr-FR");
      pdf.text(today, margin.left, pageHeight - margin.bottom + 10);
      pdf.text("Centre Sidi Abdellah de Cancérologie", pageWidth / 2, pageHeight - margin.bottom + 10, {
        align: "center",
      });
      pdf.text("DVH Analyzer v1.0", pageWidth - margin.right - 25, pageHeight - margin.bottom + 10);

      // Update position
      sourceY += contentHeight;
      remainingHeight -= contentHeight;
      pageNumber++;
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(container);
  }
}

function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadHTMLReport(
  report: ValidationReport,
  overallStatus?: "PASS" | "FAIL",
  doctorName?: string,
  template: ReportTemplate = "classic",
  observations?: string,
): void {
  const htmlContent = generateHTMLReport(report, overallStatus, doctorName, template, observations);
  const blob = new Blob([htmlContent], { type: "text/html" });
  const filename = `Validation_${report.patientId}_${new Date().toISOString().split("T")[0]}.html`;
  downloadFile(blob, filename);
}

export async function downloadPDFReport(
  report: ValidationReport,
  overallStatus?: "PASS" | "FAIL",
  doctorName?: string,
  template: ReportTemplate = "classic",
  observations?: string,
): Promise<void> {
  const blob = await generatePDFReport(report, overallStatus, doctorName, template, observations);
  const filename = `Validation_${report.patientId}_${new Date().toISOString().split("T")[0]}.pdf`;
  downloadFile(blob, filename);
}
