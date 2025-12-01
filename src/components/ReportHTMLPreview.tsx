import { ValidationReport } from '@/types/protocol';
import { ReportTemplate } from '@/utils/pdfGenerator';

interface ReportHTMLPreviewProps {
  report: ValidationReport;
  overallStatus?: 'PASS' | 'FAIL';
  doctorName?: string;
  observations?: string;
  template: ReportTemplate;
}

const getPriorityIcon = (priority: string): string => {
  const icons = {
    mandatory: '●',
    optimal: '○',
    desirable: '−',
  };
  return icons[priority as keyof typeof icons] || '○';
};

const calculateDeviation = (measured: number, threshold: number): string => {
  if (threshold === 0) return 'N/A';
  const deviation = ((measured - threshold) / threshold) * 100;
  const sign = deviation > 0 ? '+' : '';
  return `${sign}${deviation.toFixed(1)}%`;
};

export default function ReportHTMLPreview({ 
  report, 
  overallStatus = 'PASS', 
  doctorName, 
  observations,
  template 
}: ReportHTMLPreviewProps) {
  const ptvMetrics = report.ptvQualityMetrics || [];
  const constraintResults = report.constraintResults || [];

  // Organize constraints by organ
  const organGroups = new Map<string, typeof constraintResults>();
  constraintResults.forEach((c) => {
    const organ = c.constraint.organName;
    if (!organGroups.has(organ)) organGroups.set(organ, []);
    organGroups.get(organ)!.push(c);
  });

  const passCount = constraintResults.filter(c => c.status === 'PASS').length;
  const failCount = constraintResults.filter(c => c.status === 'FAIL').length;
  const warningCount = constraintResults.filter(c => c.status === 'WARNING').length;

  return (
    <div className="report-preview-container text-[9pt] leading-tight text-foreground bg-background border rounded-md p-4 max-h-[400px] overflow-y-auto">
      <style>{`
        .report-preview-container table { 
          width: 100%; 
          border-collapse: collapse; 
          font-size: 8pt;
          margin: 8px 0;
        }
        .report-preview-container th {
          background: hsl(var(--muted));
          padding: 4px 6px;
          border: 1px solid hsl(var(--border));
          text-align: left;
          font-weight: 600;
          font-size: 8pt;
        }
        .report-preview-container td {
          padding: 3px 6px;
          border: 1px solid hsl(var(--border));
          font-size: 8pt;
        }
        .report-preview-container .numeric {
          text-align: center;
          font-family: 'Courier New', monospace;
        }
        .report-preview-container .fail-row {
          background: hsl(var(--destructive) / 0.1);
        }
        .report-preview-container .warning-row {
          background: hsl(48 100% 50% / 0.1);
        }
        .report-preview-container .organ-header td {
          background: hsl(var(--muted) / 0.7);
          font-weight: 600;
          border-top: 2px solid hsl(var(--border));
          padding: 5px 6px;
        }
      `}</style>

      {/* Header */}
      <div className="text-center border-b-2 border-border pb-3 mb-4">
        <h1 className="text-base font-bold uppercase">{template === 'essential' ? 'Rapport Essentiel' : 'Rapport Officiel'}</h1>
        <h2 className="text-sm text-muted-foreground mt-1">Validation du Plan de Traitement</h2>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-[8pt]">
        <div className="border border-border p-2 rounded">
          <span className="font-semibold block text-[7pt] text-muted-foreground">PATIENT ID</span>
          <span className="text-[9pt]">{report.patientId}</span>
        </div>
        <div className="border border-border p-2 rounded">
          <span className="font-semibold block text-[7pt] text-muted-foreground">PROTOCOLE</span>
          <span className="text-[9pt]">{report.protocolName}</span>
        </div>
        <div className="border border-border p-2 rounded">
          <span className="font-semibold block text-[7pt] text-muted-foreground">STATUT</span>
          <span className={`inline-block px-2 py-0.5 rounded text-[8pt] font-semibold ${
            overallStatus === 'PASS' 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {overallStatus}
          </span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="flex gap-3 mb-4 text-[8pt] justify-center">
        <span className="text-green-600 dark:text-green-400 font-semibold">✓ {passCount} PASS</span>
        <span className="text-red-600 dark:text-red-400 font-semibold">✗ {failCount} FAIL</span>
        <span className="text-yellow-600 dark:text-yellow-400 font-semibold">⚠ {warningCount} WARNING</span>
      </div>

      {/* PTV Metrics */}
      {ptvMetrics.length > 0 && (
        <div className="mb-4">
          <h3 className="font-semibold text-[10pt] mb-2 border-b border-border pb-1">Évaluation des Volumes Cibles (PTVs)</h3>
          <table>
            <thead>
              <tr>
                <th>PTV</th>
                <th className="numeric">D95%</th>
                <th className="numeric">D98%</th>
                <th className="numeric">D50%</th>
                <th className="numeric">D2%</th>
                <th className="numeric">HI</th>
                <th className="numeric">CI</th>
              </tr>
            </thead>
            <tbody>
              {ptvMetrics.map((m, idx) => {
                const status = m.v95 >= 95 ? 'PASS' : 'FAIL';
                return (
                  <tr key={idx} className={status === 'FAIL' ? 'fail-row' : ''}>
                    <td><strong>{m.structureName}</strong></td>
                    <td className="numeric">{m.d95.toFixed(2)}</td>
                    <td className="numeric">{m.d98.toFixed(2)}</td>
                    <td className="numeric">{m.d50.toFixed(2)}</td>
                    <td className="numeric">{m.d2.toFixed(2)}</td>
                    <td className="numeric">{m.hi.toFixed(3)}</td>
                    <td className="numeric">{m.ci.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* OAR Constraints */}
      {constraintResults.length > 0 && (
        <div className="mb-4">
          <h3 className="font-semibold text-[10pt] mb-2 border-b border-border pb-1">Contraintes OARs</h3>
          <table>
            <thead>
              <tr>
                <th>Organe</th>
                <th>Contrainte</th>
                <th>Seuil</th>
                <th>Valeur</th>
                <th>Écart</th>
                <th>Priorité</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(organGroups.entries()).map(([organName, constraints], organIdx) => (
                <>
                  <tr key={`organ-${organIdx}`} className="organ-header">
                    <td colSpan={7}>{organName}</td>
                  </tr>
                  {constraints.map((c, idx) => {
                    const deviation = calculateDeviation(c.measuredValue, c.constraint.value);
                    const constraintLabel = (() => {
                      if (c.constraint.constraintType === 'Vx') return `V${c.constraint.target}Gy`;
                      if (c.constraint.constraintType === 'Dx')
                        return `D${c.constraint.target}${c.constraint.targetUnit === '%' ? '%' : 'cc'}`;
                      return c.constraint.constraintType;
                    })();
                    
                    return (
                      <tr 
                        key={`${organName}-${idx}`}
                        className={c.status === 'FAIL' ? 'fail-row' : c.status === 'WARNING' ? 'warning-row' : ''}
                      >
                        <td>{idx === 0 ? <strong>{organName}</strong> : ''}</td>
                        <td>{constraintLabel}</td>
                        <td className="numeric">
                          &lt; {c.constraint.value} {c.constraint.constraintType.startsWith('D') ? 'Gy' : c.constraint.targetUnit || '%'}
                        </td>
                        <td className="numeric"><strong>{c.measuredValue.toFixed(2)}</strong></td>
                        <td className="numeric">{deviation}</td>
                        <td className="text-center">{getPriorityIcon(c.constraint.priority || 'optimal')}</td>
                        <td className="text-center font-semibold">{c.status}</td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Observations */}
      {observations && (
        <div className="mb-4 p-3 border border-border rounded bg-muted/30">
          <h4 className="font-semibold text-[9pt] mb-1">Observations</h4>
          <p className="text-[8pt] whitespace-pre-wrap">{observations}</p>
        </div>
      )}

      {/* Signature Section */}
      <div className="mt-4 pt-4 border-t-2 border-dashed border-border">
        <h3 className="font-semibold text-[10pt] mb-3">Validation et Signature</h3>
        <div className="space-y-2 text-[8pt]">
          <div className="flex items-center gap-2">
            <span className="font-semibold w-32">Plan validé par:</span>
            <span className="flex-1 border-b border-border pb-1">{doctorName || '___________________'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold w-32">Date:</span>
            <span className="flex-1 border-b border-border pb-1">____/____/________</span>
          </div>
          <div className="mt-3">
            <div className="h-16 border-b border-border mb-1"></div>
            <p className="text-[7pt] text-muted-foreground">Signature du médecin validateur</p>
          </div>
        </div>
      </div>
    </div>
  );
}
