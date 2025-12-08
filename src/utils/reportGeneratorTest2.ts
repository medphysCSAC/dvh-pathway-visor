import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ValidationReport } from "@/types/protocol";

// Helper functions
function calculateDeviation(measured: number, threshold: number): string {
  if (threshold === 0) return "N/A";
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

export function generateUltraCompactHTMLReport(
  report: ValidationReport,
  overallStatus?: "PASS" | "FAIL",
  doctorName?: string,
): string {
  const ptvMetrics = report.ptvQualityMetrics || [];
  const constraintResults = report.constraintResults || [];

  const styles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Libre Baskerville', serif; font-size: 10pt; line-height: 1.2; color: #000; }
    .container { max-width: 210mm; padding: 10mm 15mm; margin: 0 auto; }
    .section { margin-bottom: 12px; page-break-inside: avoid; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; }
    .header h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; }
    .header h2 { font-size: 11pt; color: #333; }
    
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 9pt; }
    .summary-item { border: 1px solid #ccc; padding: 6px; }
    .summary-label { font-weight: bold; display: block; }
    .status-badge { padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 8pt; }
    
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9pt; }
    th { background: #E9ECEF; padding: 5px; border: 1px solid #999; text-align: left; }
    td { padding: 4px 5px; border: 1px solid #ccc; }
    .text-center { text-align: center; }
    .numeric { text-align: center; font-family: monospace; }
    
    .oartable th { font-size: 8pt; padding: 4px; }
    .organ-header td { background: #F0F0F0; font-weight: bold; font-size: 9pt; padding: 5px; border-top: 2px solid #000; }
    .organ-separator td { height: 1px; background: #ddd; padding: 0; }
    .constraint-row td { border-bottom: 1px dotted #eee; }
    
    .fail-row { background: #FFE0E0; }
    .warning-row { background: #FFF4E0; }
    
    .signature { margin-top: 20px; padding: 15px; border: 2px dashed #999; page-break-inside: avoid; }
    .signature-box { height: 40px; border-bottom: 1px solid #000; margin-bottom: 5px; }
  `;

  const html = [];
  html.push(
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${styles}</style></head><body><div class="container">`,
  );

  // SECTION 1 : Résumé
  html.push('<div class="section"><div class="header"><h1>Résumé du Plan</h1></div>');
  html.push('<div class="summary-grid">');
  html.push(
    `<div class="summary-item"><span class="summary-label">Patient ID</span><span>${report.patientId}</span></div>`,
  );
  html.push(
    `<div class="summary-item"><span class="summary-label">Protocole</span><span>${report.protocolName}</span></div>`,
  );
  html.push(
    `<div class="summary-item"><span class="summary-label">Statut</span><span class="status-badge" style="background:${overallStatus === "PASS" ? "#D3F9D8" : "#FFE0E0"};color:${overallStatus === "PASS" ? "#2D7A3E" : "#C92A2A"}">${overallStatus || report.overallStatus}</span></div>`,
  );
  html.push("</div></div>");

  // SECTION 2 : Tableau PTV
  if (ptvMetrics.length > 0) {
    html.push('<div class="section"><div class="header"><h2>Évaluation des Volumes Cibles (PTVs)</h2></div>');
    html.push(
      "<table><thead><tr><th>PTV</th><th>D95%</th><th>D98%</th><th>D50%</th><th>D2%</th><th>HI</th><th>CI</th></tr></thead><tbody>",
    );

    ptvMetrics.forEach((m) => {
      const status = m.v95 >= 95 ? "PASS" : "FAIL";
      html.push(`<tr class="${status === "FAIL" ? "fail-row" : ""}">
        <td><strong>${m.structureName}</strong></td>
        <td class="numeric">${m.d95.toFixed(2)}</td>
        <td class="numeric">${m.d98.toFixed(2)}</td>
        <td class="numeric">${m.d50.toFixed(2)}</td>
        <td class="numeric">${m.d2.toFixed(2)}</td>
        <td class="numeric">${m.hi.toFixed(3)}</td>
        <td class="numeric">${m.ci.toFixed(3)}</td>
      </tr>`);
    });
    html.push("</tbody></table></div>");
  }

  // SECTION 3 : Tableau OAR unifié
  if (constraintResults.length > 0) {
    html.push('<div class="section"><div class="header"><h2>Contraintes OARs</h2></div>');
    html.push(
      '<table class="oartable"><thead><tr><th>Organe</th><th>Contrainte</th><th>Seuil</th><th>Valeur</th><th>Écart</th><th>Priorité</th><th>Statut</th></tr></thead><tbody>',
    );

    const organGroups = new Map<string, typeof constraintResults>();
    constraintResults.forEach((c) => {
      const organ = c.constraint.organName;
      if (!organGroups.has(organ)) organGroups.set(organ, []);
      organGroups.get(organ)!.push(c);
    });

    let organIndex = 0;
    organGroups.forEach((constraints, organName) => {
      organIndex++;

      // Ligne d'en-tête d'organe
      // html.push(`<tr class="organ-header"><td colspan="7">${organName}</td></tr>`); // enlever l'entête de l'organe pour gagner de l'espace

      // Lignes de contraintes
      constraints.forEach((c, idx) => {
        const deviation = calculateDeviation(c.measuredValue, c.constraint.value);
        const status = c.status;
        html.push(`<tr class="constraint-row ${status === "FAIL" ? "fail-row" : status === "WARNING" ? "warning-row" : ""}">
          <td>${idx === 0 ? `<strong>${organName}</strong>` : ""}</td>
          <td>${(() => {
            if (c.constraint.constraintType === "Vx") return `V${c.constraint.target}Gy`;
            if (c.constraint.constraintType === "Dx")
              return `D${c.constraint.target}${c.constraint.targetUnit === "%" ? "%" : "cc"}`;
            return c.constraint.constraintType;
          })()}</td>
          <td class="numeric">&lt; ${c.constraint.value} ${c.constraint.constraintType.startsWith("D") ? "Gy" : c.constraint.targetUnit || "%"}</td>
          <td class="numeric"><strong>${c.measuredValue.toFixed(2)}</strong></td>
          <td class="numeric">${deviation}</td>
          <td class="text-center">${getPriorityIcon(c.constraint.priority || "optimal")}</td>
          <td class="text-center">${status}</td>
        </tr>`);
      });

      // Ligne séparatrice (sauf dernier organe)
      if (organIndex < organGroups.size) {
        html.push('<tr class="organ-separator"><td colspan="7"></td></tr>');
      }
    });
    html.push("</tbody></table></div>");
  }

  // SECTION 4 : Signature
  html.push('<div class="section signature"><div class="header"><h2>Validation et Signature</h2></div>');
  html.push(
    `<table style="width:100%;margin-bottom:10px;"><tr><td style="width:30%;font-weight:bold;">Plan validé par</td><td style="border-bottom:1px solid #000;">${doctorName || ""}</td></tr>`,
  );
  html.push(
    '<tr><td style="font-weight:bold;">Date</td><td style="border-bottom:1px solid #000;">____/____/________</td></tr></table>',
  );
  html.push('<div class="signature-box"></div>');
  html.push('<p style="font-size:8pt;margin-top:5px;">Signature du médecin validateur</p>');
  html.push("</div>");

  html.push("</div></body></html>");

  return html.join("");
}

export async function generateTest2PDFReport(
  report: ValidationReport,
  overallStatus?: "PASS" | "FAIL",
  doctorName?: string,
  observations?: string,
): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("PDF generation requires browser environment");
  }

  const htmlContent = generateUltraCompactHTMLReport(report, overallStatus, doctorName);

  const container = document.createElement("div");
  container.innerHTML = htmlContent;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.width = "794px";
  container.style.backgroundColor = "#ffffff";
  container.style.padding = "0";
  container.style.margin = "0";
  document.body.appendChild(container);

  try {
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

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = { top: 15, right: 15, bottom: 15, left: 15 };
    const contentWidth = pageWidth - margin.left - margin.right;
    const contentHeight = pageHeight - margin.top - margin.bottom;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    pdf.setProperties({
      title: `Rapport de validation - ${report.patientId}`,
      subject: "Rapport de Validation Ultra-Compact",
      author: "DVH Analyzer",
      keywords: "radiothérapie, dosimétrie, validation, DVH",
      creator: "DVH Analyzer v1.0",
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let remainingHeight = imgHeight;
    let sourceY = 0;
    let pageNumber = 1;

    while (remainingHeight > 0) {
      if (pageNumber > 1) pdf.addPage();

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Rapport de validation compact - ${report.patientId}`, margin.left, margin.top - 5);
      pdf.text(`Page ${pageNumber}`, pageWidth - margin.right - 15, margin.top - 5);

      const pageContentHeight = Math.min(remainingHeight, contentHeight);
      const canvasSourceY = (sourceY / imgHeight) * canvas.height;
      const canvasHeight = (pageContentHeight / imgHeight) * canvas.height;
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = canvasHeight;
      const pageContext = pageCanvas.getContext("2d");

      if (pageContext) {
        pageContext.drawImage(canvas, 0, canvasSourceY, canvas.width, canvasHeight, 0, 0, canvas.width, canvasHeight);
        const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);
        pdf.addImage(pageImgData, "JPEG", margin.left, margin.top, imgWidth, pageContentHeight, "", "FAST");
      }

      pdf.setFontSize(8);
      const today = new Date().toLocaleDateString("fr-FR");
      pdf.text(today, margin.left, pageHeight - margin.bottom + 10);
      pdf.text("DVH Analyzer v1.0", pageWidth - margin.right - 25, pageHeight - margin.bottom + 10);

      sourceY += contentHeight;
      remainingHeight -= contentHeight;
      pageNumber++;
    }

    return pdf.output("blob");
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
