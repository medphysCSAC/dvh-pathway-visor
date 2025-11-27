import { pdf } from '@react-pdf/renderer';
import { ValidationReport } from '@/types/protocol';
import { CompactPDFReport } from '@/components/pdf/CompactPDFReport';
import { toast } from 'sonner';
import { generateTestPDFReport } from './reportGeneratorTest';
import { generateTest2PDFReport } from './reportGeneratorTest2';

export type ReportTemplate = 'classic' | 'modern' | 'minimal' | 'compact' | 'test' | 'test2';

/**
 * Generate and download PDF report using @react-pdf/renderer
 * @param report - Validation report data
 * @param template - Report template type
 * @param overallStatus - Overall validation status
 * @param doctorName - Name of the validating doctor
 * @returns Promise that resolves when download is complete
 */
export async function generateAndDownloadPDF(
  report: ValidationReport,
  template: ReportTemplate = 'classic',
  overallStatus?: 'PASS' | 'FAIL',
  doctorName?: string,
  observations?: string,
): Promise<void> {
  try {
    toast.loading('Génération du rapport PDF...', { id: 'pdf-generation' });
    
    let blob: Blob;
    let filename: string;
    
    // Use TEST template with html2canvas + jsPDF
    if (template === 'test') {
      blob = await generateTestPDFReport(report, overallStatus, doctorName, observations);
      filename = `Validation_TEST_${report.patientId}_${new Date().toISOString().split('T')[0]}.pdf`;
    } else if (template === 'test2') {
      blob = await generateTest2PDFReport(report, overallStatus, doctorName, observations);
      filename = `Validation_TEST2_${report.patientId}_${new Date().toISOString().split('T')[0]}.pdf`;
    } else {
      // Use @react-pdf/renderer for other templates
      let pdfDocument;
      
      if (template === 'compact') {
        pdfDocument = <CompactPDFReport 
          report={report} 
          overallStatus={overallStatus} 
          doctorName={doctorName} 
        />;
        filename = `Validation_Compact_${report.patientId}_${new Date().toISOString().split('T')[0]}.pdf`;
      } else {
        // For now, use compact for all templates until we create the full report component
        // TODO: Create CompletePDFReport component for other templates
        pdfDocument = <CompactPDFReport 
          report={report} 
          overallStatus={overallStatus} 
          doctorName={doctorName} 
        />;
        filename = `Validation_${report.patientId}_${new Date().toISOString().split('T')[0]}.pdf`;
      }
      
      // Generate PDF blob
      blob = await pdf(pdfDocument).toBlob();
    }
    
    // Download the file
    downloadFile(blob, filename);
    
    toast.success('Rapport PDF généré avec succès', { id: 'pdf-generation' });
  } catch (error) {
    console.error('Error generating PDF:', error);
    toast.error('Erreur lors de la génération du PDF', { id: 'pdf-generation' });
    throw error;
  }
}

/**
 * Helper function to download a blob as a file
 */
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
