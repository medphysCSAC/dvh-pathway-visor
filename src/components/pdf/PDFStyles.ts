import { StyleSheet } from '@react-pdf/renderer';

export const pdfStyles = StyleSheet.create({
  page: {
    padding: '20mm 15mm',
    fontFamily: 'Times-Roman',
    fontSize: 10,
    lineHeight: 1.3,
  },
  
  // Headers
  institutionalHeader: {
    textAlign: 'center',
    borderBottom: '3pt solid black',
    paddingBottom: 15,
    marginBottom: 25,
  },
  institutionName: {
    fontSize: 16,
    fontFamily: 'Times-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
  },
  departmentName: {
    fontSize: 12,
    color: '#333',
    marginBottom: 3,
  },
  
  reportHeader: {
    textAlign: 'center',
    border: '3pt solid black',
    padding: 15,
    backgroundColor: '#F8F9FA',
    marginBottom: 20,
  },
  reportTitle: {
    fontSize: 18,
    fontFamily: 'Times-Bold',
    textTransform: 'uppercase',
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#495057',
  },
  
  // Summary Card
  summaryCard: {
    border: '3pt solid #333',
    padding: 15,
    backgroundColor: '#F8F9FA',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 14,
    fontFamily: 'Times-Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryItem: {
    width: '48%',
    marginBottom: 8,
  },
  summaryLabel: {
    fontFamily: 'Times-Bold',
    marginBottom: 2,
  },
  summaryValue: {
    marginTop: 2,
  },
  globalStatus: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Times-Bold',
    marginVertical: 15,
    padding: 10,
    width: '100%',
  },
  
  // Status Badges
  statusBadge: {
    padding: '4pt 12pt',
    borderRadius: 4,
    fontFamily: 'Times-Bold',
    fontSize: 10,
  },
  statusPass: {
    backgroundColor: '#D3F9D8',
    color: '#2D7A3E',
    border: '1pt solid #2D7A3E',
  },
  statusFail: {
    backgroundColor: '#FFE0E0',
    color: '#C92A2A',
    border: '1pt solid #C92A2A',
  },
  statusWarning: {
    backgroundColor: '#FFE8CC',
    color: '#E67700',
    border: '1pt solid #E67700',
  },
  statusNotEvaluated: {
    backgroundColor: '#F1F3F5',
    color: '#868E96',
    border: '1pt solid #868E96',
  },
  
  // Sections
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'Times-Bold',
    marginVertical: 10,
    paddingBottom: 5,
    borderBottom: '2pt solid black',
  },
  subsectionHeader: {
    fontSize: 12,
    fontFamily: 'Times-Bold',
    marginVertical: 8,
  },
  
  // Tables
  table: {
    width: '100%',
    marginVertical: 10,
    fontSize: 9,
  },
  tableHeader: {
    backgroundColor: '#E9ECEF',
    flexDirection: 'row',
    borderBottom: '1pt solid #CED4DA',
    fontFamily: 'Times-Bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #CED4DA',
  },
  tableRowEven: {
    backgroundColor: '#F8F9FA',
  },
  tableRowFail: {
    backgroundColor: '#FFE0E0',
    borderLeft: '4pt solid #C92A2A',
  },
  tableRowWarning: {
    backgroundColor: '#FFE8CC',
    borderLeft: '4pt solid #E67700',
  },
  tableCell: {
    padding: '6pt 8pt',
    borderRight: '1pt solid #CED4DA',
    fontSize: 9,
  },
  tableCellBold: {
    fontFamily: 'Times-Bold',
  },
  tableCellCenter: {
    textAlign: 'center',
  },
  
  // Info Table
  infoTable: {
    width: '100%',
    border: '1pt solid #CED4DA',
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #CED4DA',
  },
  infoLabel: {
    width: '40%',
    padding: '6pt 10pt',
    fontFamily: 'Times-Bold',
    backgroundColor: '#F8F9FA',
    borderRight: '1pt solid #CED4DA',
  },
  infoValue: {
    width: '60%',
    padding: '6pt 10pt',
  },
  
  // Highlights
  highlightCritical: {
    color: '#C92A2A',
    fontFamily: 'Times-Bold',
  },
  highlightGood: {
    color: '#2D7A3E',
    fontFamily: 'Times-Bold',
  },
  highlightWarning: {
    color: '#E67700',
    fontFamily: 'Times-Bold',
  },
  
  // Signature Section
  signatureSection: {
    marginTop: 25,
  },
  signatureBox: {
    border: '2pt dashed #CED4DA',
    padding: '30pt 15pt',
    marginVertical: 15,
    textAlign: 'center',
    minHeight: 80,
  },
  signatureLabel: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
    marginBottom: 8,
  },
  
  // Footer
  reportFooter: {
    textAlign: 'center',
    borderTop: '2pt solid black',
    paddingTop: 15,
    marginTop: 40,
    fontSize: 9,
    color: '#666',
  },
  footerInstitution: {
    fontFamily: 'Times-Bold',
    marginBottom: 5,
  },
  footerConfidential: {
    marginTop: 10,
    fontSize: 8,
    fontStyle: 'italic',
  },
  
  // Legend
  legend: {
    fontSize: 9,
    fontStyle: 'italic',
    padding: 10,
    backgroundColor: '#F8F9FA',
    borderLeft: '3pt solid #333',
    marginTop: 10,
  },
  
  // Text utilities
  textCenter: {
    textAlign: 'center',
  },
  textBold: {
    fontFamily: 'Times-Bold',
  },
});
