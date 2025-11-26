import { Document, Page, Text, View } from '@react-pdf/renderer';
import { ValidationReport } from '@/types/protocol';
import { pdfStyles } from './PDFStyles';

interface CompactPDFReportProps {
  report: ValidationReport;
  overallStatus?: 'PASS' | 'FAIL';
  doctorName?: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const style = status === 'PASS' 
    ? pdfStyles.statusPass 
    : status === 'FAIL' 
    ? pdfStyles.statusFail 
    : status === 'WARNING' 
    ? pdfStyles.statusWarning 
    : pdfStyles.statusNotEvaluated;
    
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'WARNING' ? '⚠' : '—';
  
  return (
    <Text style={[pdfStyles.statusBadge, style]}>
      {icon} {status}
    </Text>
  );
};

export const CompactPDFReport = ({ report, overallStatus, doctorName }: CompactPDFReportProps) => {
  const finalStatus = overallStatus || report.overallStatus;
  const { protocolName, patientId, evaluationDate, constraintResults } = report;
  const ptvMetrics = report.ptvQualityMetrics || [];
  
  const passCount = constraintResults.filter((c) => c.status === 'PASS').length;
  const failCount = constraintResults.filter((c) => c.status === 'FAIL').length;
  const warningCount = constraintResults.filter((c) => c.status === 'WARNING').length;
  const totalConstraints = constraintResults.length;
  
  // Group constraints by organ
  const organGroups = new Map<string, typeof constraintResults>();
  constraintResults.forEach((c) => {
    const organ = c.constraint.organName;
    if (!organGroups.has(organ)) {
      organGroups.set(organ, []);
    }
    organGroups.get(organ)!.push(c);
  });
  
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* Institutional Header */}
        <View style={pdfStyles.institutionalHeader}>
          <Text style={pdfStyles.institutionName}>Centre Sidi Abdellah de Cancérologie</Text>
          <Text style={pdfStyles.departmentName}>Service de Radiothérapie</Text>
        </View>
        
        {/* Report Header */}
        <View style={pdfStyles.reportHeader}>
          <Text style={pdfStyles.reportTitle}>Rapport de validation du plan : {patientId}</Text>
          <Text style={pdfStyles.reportSubtitle}>Protocole : {protocolName}</Text>
        </View>
        
        {/* Summary Card */}
        <View style={pdfStyles.summaryCard}>
          <Text style={pdfStyles.summaryTitle}>Résumé</Text>
          <View style={pdfStyles.summaryGrid}>
            <View style={pdfStyles.globalStatus}>
              <StatusBadge status={finalStatus} />
            </View>
            <View style={pdfStyles.summaryItem}>
              <Text style={pdfStyles.summaryLabel}>Protocole</Text>
              <Text style={pdfStyles.summaryValue}>{protocolName}</Text>
            </View>
            <View style={pdfStyles.summaryItem}>
              <Text style={pdfStyles.summaryLabel}>Patient ID</Text>
              <Text style={[pdfStyles.summaryValue, pdfStyles.textBold]}>{patientId}</Text>
            </View>
            <View style={pdfStyles.summaryItem}>
              <Text style={pdfStyles.summaryLabel}>Date de validation</Text>
              <Text style={pdfStyles.summaryValue}>
                {new Date(evaluationDate).toLocaleDateString('fr-FR')}
              </Text>
            </View>
            <View style={pdfStyles.summaryItem}>
              <Text style={pdfStyles.summaryLabel}>Contraintes évaluées</Text>
              <Text style={pdfStyles.summaryValue}>
                {totalConstraints} ({passCount} PASS / {failCount} FAIL / {warningCount} WARNING)
              </Text>
            </View>
          </View>
        </View>
        
        {/* PTV Evaluation */}
        {ptvMetrics.length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionHeader}>ÉVALUATION DES VOLUMES CIBLES (PTVs)</Text>
            <View style={pdfStyles.table}>
              <View style={pdfStyles.tableHeader}>
                <Text style={[pdfStyles.tableCell, { width: '20%' }]}>PTV</Text>
                <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '11%' }]}>D95% (Gy)</Text>
                <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '11%' }]}>D98% (Gy)</Text>
                <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '11%' }]}>D50% (Gy)</Text>
                <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '11%' }]}>D2% (Gy)</Text>
                <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '9%' }]}>HI</Text>
                <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '9%' }]}>CI</Text>
                <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '18%' }]}>Statut</Text>
              </View>
              {ptvMetrics.map((m, idx) => {
                const status = m.v95 >= 95 ? 'PASS' : 'FAIL';
                const rowStyle = status === 'FAIL' ? pdfStyles.tableRowFail : idx % 2 === 0 ? pdfStyles.tableRowEven : {};
                
                return (
                  <View key={idx} style={[pdfStyles.tableRow, rowStyle]}>
                    <Text style={[pdfStyles.tableCell, { width: '20%' }]}>{m.structureName}</Text>
                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '11%' }]}>{m.d95.toFixed(2)}</Text>
                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '11%' }]}>{m.d98.toFixed(2)}</Text>
                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '11%' }]}>{m.d50.toFixed(2)}</Text>
                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '11%' }]}>{m.d2.toFixed(2)}</Text>
                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '9%' }]}>{m.hi.toFixed(3)}</Text>
                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '9%' }]}>{m.ci.toFixed(3)}</Text>
                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '18%' }]}>
                      <StatusBadge status={status} />
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
        
        {/* OAR Constraints */}
        {constraintResults.length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionHeader}>ÉVALUATION DES ORGANES À RISQUE (OARs)</Text>
            
            {/* Summary */}
            <View style={[pdfStyles.summaryCard, { borderWidth: 2, marginBottom: 15 }]}>
              <View style={pdfStyles.summaryGrid}>
                <View style={pdfStyles.summaryItem}>
                  <Text style={pdfStyles.summaryLabel}>Total contraintes</Text>
                  <Text style={pdfStyles.summaryValue}>{totalConstraints}</Text>
                </View>
                <View style={pdfStyles.summaryItem}>
                  <Text style={[pdfStyles.summaryLabel, pdfStyles.highlightGood]}>✓ Conformes</Text>
                  <Text style={[pdfStyles.summaryValue, pdfStyles.highlightGood]}>
                    {passCount} ({((passCount / totalConstraints) * 100).toFixed(0)}%)
                  </Text>
                </View>
                <View style={pdfStyles.summaryItem}>
                  <Text style={[pdfStyles.summaryLabel, pdfStyles.highlightWarning]}>⚠ Avertissements</Text>
                  <Text style={[pdfStyles.summaryValue, pdfStyles.highlightWarning]}>{warningCount}</Text>
                </View>
                <View style={pdfStyles.summaryItem}>
                  <Text style={[pdfStyles.summaryLabel, pdfStyles.highlightCritical]}>✗ Non conformes</Text>
                  <Text style={[pdfStyles.summaryValue, pdfStyles.highlightCritical]}>{failCount}</Text>
                </View>
              </View>
            </View>
            
            {/* Tables by organ */}
            {Array.from(organGroups.entries()).map(([organName, constraints], organIdx) => (
              <View key={organIdx} style={pdfStyles.section} break={organIdx > 0 && organIdx % 2 === 0}>
                <Text style={pdfStyles.subsectionHeader}>{organName}</Text>
                <View style={pdfStyles.table}>
                  <View style={pdfStyles.tableHeader}>
                    <Text style={[pdfStyles.tableCell, { width: '20%' }]}>Contrainte</Text>
                    <Text style={[pdfStyles.tableCell, { width: '15%' }]}>Seuil</Text>
                    <Text style={[pdfStyles.tableCell, { width: '15%' }]}>Valeur mesurée</Text>
                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '15%' }]}>Écart</Text>
                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '15%' }]}>Priorité</Text>
                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '20%' }]}>Statut</Text>
                  </View>
                  {constraints.map((c, idx) => {
                    const rowStyle = c.status === 'FAIL' 
                      ? pdfStyles.tableRowFail 
                      : c.status === 'WARNING' 
                      ? pdfStyles.tableRowWarning 
                      : idx % 2 === 0 
                      ? pdfStyles.tableRowEven 
                      : {};
                    
                    let constraintType = '';
                    let threshold = '';
                    let measuredUnit = '';
                    
                    if (c.constraint.constraintType === 'Dmean') {
                      constraintType = 'Dmean';
                      threshold = `< ${c.constraint.value} Gy`;
                      measuredUnit = 'Gy';
                    } else if (c.constraint.constraintType === 'Dmax') {
                      constraintType = 'Dmax';
                      threshold = `< ${c.constraint.value} Gy`;
                      measuredUnit = 'Gy';
                    } else if (c.constraint.constraintType === 'Vx') {
                      constraintType = `V${c.constraint.target}Gy`;
                      measuredUnit = c.constraint.targetUnit || '%';
                      threshold = `< ${c.constraint.value} ${measuredUnit}`;
                    } else if (c.constraint.constraintType === 'Dx') {
                      constraintType = `D${c.constraint.target}${c.constraint.targetUnit === '%' ? '%' : 'cc'}`;
                      threshold = `< ${c.constraint.value} Gy`;
                      measuredUnit = 'Gy';
                    }
                    
                    const deviation = c.status !== 'NOT_EVALUATED' 
                      ? `${c.measuredValue > c.constraint.value ? '+' : ''}${(((c.measuredValue - c.constraint.value) / c.constraint.value) * 100).toFixed(1)}%`
                      : '—';
                    
                    const priorityLabels: Record<string, string> = {
                      mandatory: '● Obligatoire',
                      optimal: '○ Optimale',
                      desirable: '− Souhaitable',
                    };
                    
                    return (
                      <View key={idx} style={[pdfStyles.tableRow, rowStyle]}>
                        <Text style={[pdfStyles.tableCell, { width: '20%' }]}>{constraintType}</Text>
                        <Text style={[pdfStyles.tableCell, { width: '15%' }]}>{threshold}</Text>
                        <Text style={[pdfStyles.tableCell, pdfStyles.tableCellBold, { width: '15%' }]}>
                          {c.measuredValue.toFixed(2)} {measuredUnit}
                        </Text>
                        <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '15%' }]}>
                          {deviation}
                        </Text>
                        <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '15%' }]}>
                          {priorityLabels[c.constraint.priority || 'optimal'] || c.constraint.priority}
                        </Text>
                        <Text style={[pdfStyles.tableCell, pdfStyles.tableCellCenter, { width: '20%' }]}>
                          <StatusBadge status={c.status} />
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
        
        {/* Signature Section */}
        <View style={pdfStyles.signatureSection} break>
          <Text style={pdfStyles.sectionHeader}>VALIDATION ET SIGNATURE</Text>
          <View style={pdfStyles.infoTable}>
            <View style={pdfStyles.infoRow}>
              <Text style={pdfStyles.infoLabel}>Plan validé par</Text>
              <Text style={pdfStyles.infoValue}>{doctorName || '___________________________'}</Text>
            </View>
            <View style={pdfStyles.infoRow}>
              <Text style={pdfStyles.infoLabel}>Date de validation</Text>
              <Text style={pdfStyles.infoValue}>____/____/________</Text>
            </View>
          </View>
          <View style={pdfStyles.signatureBox}>
            <Text style={pdfStyles.signatureLabel}>Signature médecin validateur</Text>
          </View>
        </View>
        
        {/* Footer */}
        <View style={pdfStyles.reportFooter}>
          <Text style={pdfStyles.footerInstitution}>Centre Sidi Abdellah de Cancérologie</Text>
          <Text style={pdfStyles.footerConfidential}>
            Rapport généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')} - 
            Document confidentiel - Usage clinique uniquement
          </Text>
        </View>
      </Page>
    </Document>
  );
};
