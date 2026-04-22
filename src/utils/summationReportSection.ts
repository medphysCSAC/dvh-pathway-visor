/**
 * Génère la section HTML "Sommation Dosimétrique" pour les rapports PDF.
 * Affichée uniquement si le rapport contient `summationInfo` (analyse multi-plans).
 */

import type { SummationReportInfo } from '@/types/protocol';

/**
 * Variante pleine largeur pour le rapport Officiel.
 */
export function generateSummationSectionHTML(info: SummationReportInfo): string {
  const isPrecise = info.method === 'dose_grid';
  const bgColor = isPrecise ? '#E6F7E9' : '#FFF1E0';
  const borderColor = isPrecise ? '#2D7A3E' : '#E67700';
  const badgeBg = isPrecise ? '#2D7A3E' : '#E67700';
  const badgeText = isPrecise
    ? '✓ Sommation sur grille de dose (précis)'
    : '⚠ Sommation DVH direct (approchée)';
  const methodLabel = isPrecise
    ? 'Sommation voxel-par-voxel des grilles RTDOSE puis recalcul DVH cumulatif via les contours du RTSTRUCT.'
    : 'Combinaison borne-supérieure des courbes DVH de chaque plan : V_sum(d) = max_i(V_i(d)).';

  const out: string[] = [];
  out.push('<div class="section summation-section" style="page-break-inside:avoid">');
  out.push(
    `<div class="section-header" style="border-bottom:2px solid ${borderColor};color:${borderColor}">📊 Sommation Dosimétrique Multi-plans</div>`,
  );
  out.push(
    `<div style="background:${bgColor};border-left:5px solid ${borderColor};padding:12px 14px;margin:8px 0">`,
  );

  out.push(
    `<p style="font-size:10pt;margin-bottom:8px"><strong>Ce rapport est basé sur la sommation de ${info.planNames.length} plans :</strong></p>`,
  );

  // Liste des plans sources
  out.push('<table style="width:100%;font-size:10pt;border-collapse:collapse;margin-bottom:10px">');
  out.push(
    '<thead><tr style="background:rgba(0,0,0,0.04)"><th style="text-align:left;padding:5px 8px;border:1px solid rgba(0,0,0,0.1)">#</th><th style="text-align:left;padding:5px 8px;border:1px solid rgba(0,0,0,0.1)">Plan source</th><th style="text-align:right;padding:5px 8px;border:1px solid rgba(0,0,0,0.1)">Dose totale</th><th style="text-align:right;padding:5px 8px;border:1px solid rgba(0,0,0,0.1)">Fractions</th><th style="text-align:right;padding:5px 8px;border:1px solid rgba(0,0,0,0.1)">Dose/fx</th></tr></thead>',
  );
  out.push('<tbody>');
  info.planNames.forEach((name, idx) => {
    const detail = info.planDetails?.[idx];
    const label = detail?.label ? ` <em style="color:#666">(${detail.label})</em>` : '';
    const dose = detail?.dose !== undefined ? `${detail.dose} Gy` : '—';
    const fx = detail?.fractions !== undefined ? `${detail.fractions} fx` : '—';
    const dpf = detail?.dosePerFraction !== undefined ? `${detail.dosePerFraction} Gy` : '—';
    out.push(
      `<tr><td style="padding:4px 8px;border:1px solid rgba(0,0,0,0.1)">${idx + 1}</td><td style="padding:4px 8px;border:1px solid rgba(0,0,0,0.1);font-family:monospace;font-size:9pt">${name}${label}</td><td style="padding:4px 8px;border:1px solid rgba(0,0,0,0.1);text-align:right">${dose}</td><td style="padding:4px 8px;border:1px solid rgba(0,0,0,0.1);text-align:right">${fx}</td><td style="padding:4px 8px;border:1px solid rgba(0,0,0,0.1);text-align:right">${dpf}</td></tr>`,
    );
  });
  out.push('</tbody></table>');

  // Total + méthode
  if (info.totalDose !== undefined) {
    out.push(
      `<p style="font-size:10pt;margin-bottom:6px"><strong>Dose totale estimée :</strong> ${info.totalDose} Gy</p>`,
    );
  }
  out.push(
    `<p style="font-size:10pt;margin-bottom:6px"><strong>Méthode :</strong> <span style="display:inline-block;background:${badgeBg};color:#fff;padding:2px 8px;border-radius:3px;font-size:9pt;font-weight:bold">${badgeText}</span></p>`,
  );
  out.push(`<p style="font-size:9pt;color:#444;margin-bottom:8px;font-style:italic">${methodLabel}</p>`);

  // Avertissement clinique pour DVH direct
  if (!isPrecise) {
    out.push(
      `<div style="background:#FFE0E0;border:1px solid #C92A2A;padding:8px 10px;margin-top:8px;font-size:9pt;color:#7A1F1F"><strong>⚠ Avertissement clinique :</strong> Validation par sommation approchée (DVH direct). Confirmer impérativement avec l'export sommation du TPS avant validation clinique.</div>`,
    );
  }

  // Warnings éventuels
  if (info.warnings && info.warnings.length > 0) {
    out.push(
      '<div style="margin-top:8px;padding:6px 10px;background:rgba(0,0,0,0.03);border-left:3px solid #888;font-size:9pt">',
    );
    out.push('<strong>Notes de sommation :</strong><ul style="margin:4px 0 0 18px;padding:0">');
    info.warnings.forEach((w) => {
      out.push(`<li>${w}</li>`);
    });
    out.push('</ul></div>');
  }

  out.push('</div></div>');
  return out.join('');
}

/**
 * Variante ultra-compacte pour le rapport Essentiel.
 */
export function generateSummationCompactHTML(info: SummationReportInfo): string {
  const isPrecise = info.method === 'dose_grid';
  const bgColor = isPrecise ? '#E6F7E9' : '#FFF1E0';
  const borderColor = isPrecise ? '#2D7A3E' : '#E67700';
  const badgeText = isPrecise ? '✓ Précis (grille)' : '⚠ Approché (DVH)';

  const planList = info.planNames
    .map((name, idx) => {
      const d = info.planDetails?.[idx];
      const fx = d?.fractions !== undefined ? ` — ${d.dose ?? '?'} Gy / ${d.fractions} fx` : '';
      return `<li style="margin:1px 0">${idx + 1}. <strong>${name}</strong>${fx}</li>`;
    })
    .join('');

  const totalLine =
    info.totalDose !== undefined
      ? ` · <strong>Total : ${info.totalDose} Gy</strong>`
      : '';

  return `<div class="section" style="background:${bgColor};border-left:4px solid ${borderColor};padding:8px 10px;margin:8px 0;font-size:9pt">
    <div style="font-weight:bold;margin-bottom:4px">📊 Sommation de ${info.planNames.length} plans${totalLine} · <span style="color:${borderColor}">${badgeText}</span></div>
    <ul style="margin:0;padding-left:18px;font-size:8.5pt;list-style:none">${planList}</ul>
    ${
      !isPrecise
        ? `<div style="margin-top:4px;font-size:8pt;color:#7A1F1F;font-style:italic">⚠ Méthode approchée — confirmer avec sommation TPS.</div>`
        : ''
    }
  </div>`;
}
