import { pdf } from '@react-pdf/renderer';
import { ValidationReport } from '@/types/protocol';
import { CompactPDFReport } from '@/components/pdf/CompactPDFReport';
import { toast } from 'sonner';
import { generateTestPDFReport as generateOfficialPDFReport } from './reportGeneratorTest';
import { generateTest2PDFReport as generateEssentialPDFReport } from './reportGeneratorTest2';

export type ReportTemplate = 'essential' | 'official';

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
  template: ReportTemplate = 'essential',
  overallStatus?: 'PASS' | 'FAIL',
  doctorName?: string,
  observations?: string,
): Promise<void> {
  try {
    toast.loading('Génération du rapport PDF...', { id: 'pdf-generation' });
    
    let blob: Blob;
    let filename: string;
    
    if (template === 'essential') {
      blob = await generateEssentialPDFReport(report, overallStatus, doctorName, observations);
      filename = `Validation_Essentiel_${report.patientId}_${new Date().toISOString().split('T')[0]}.pdf`;
    } else {
      blob = await generateOfficialPDFReport(report, overallStatus, doctorName, observations);
      filename = `Validation_Officiel_${report.patientId}_${new Date().toISOString().split('T')[0]}.pdf`;
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
