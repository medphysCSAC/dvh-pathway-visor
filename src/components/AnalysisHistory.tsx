import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAnalysisHistory, AnalysisHistoryEntry } from '@/hooks/useAnalysisHistory';
import { Clock, Trash2, FileText, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState } from 'react';

interface AnalysisHistoryProps {
  onLoadReport?: (entry: AnalysisHistoryEntry) => void;
}

export default function AnalysisHistory({ onLoadReport }: AnalysisHistoryProps) {
  const { history, deleteEntry, clearHistory } = useAnalysisHistory();
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'FAIL':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'WARNING':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
      PASS: 'default',
      FAIL: 'destructive',
      WARNING: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'default'} className="ml-2">
        {status === 'PASS' && 'Validé'}
        {status === 'FAIL' && 'Échec'}
        {status === 'WARNING' && 'Avertissement'}
      </Badge>
    );
  };

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historique des Analyses
          </CardTitle>
          <CardDescription>Aucune analyse enregistrée</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Historique des Analyses
            </CardTitle>
            <CardDescription>
              {history.length} analyse(s) enregistrée(s)
            </CardDescription>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setShowClearAll(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Tout effacer
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {history.map((entry) => (
              <Card key={entry.id} className="border-l-4" style={{
                borderLeftColor: 
                  entry.overallStatus === 'PASS' ? 'rgb(34, 197, 94)' :
                  entry.overallStatus === 'FAIL' ? 'rgb(239, 68, 68)' :
                  'rgb(234, 179, 8)'
              }}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getStatusIcon(entry.overallStatus)}
                        Patient: {entry.patientId}
                        {getStatusBadge(entry.overallStatus)}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Protocole: {entry.protocolName}
                      </CardDescription>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(entry.date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {onLoadReport && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onLoadReport(entry)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Voir
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setEntryToDelete(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-medium">Contraintes validées:</span>{' '}
                      {entry.report.constraintResults.filter(r => r.status === 'PASS').length} / {entry.report.constraintResults.length}
                    </p>
                    {entry.report.planSummary && (
                      <p>
                        <span className="font-medium">Dose:</span>{' '}
                        {entry.report.planSummary.prescriptionDose} Gy
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Confirmation suppression individuelle */}
      <AlertDialog open={!!entryToDelete} onOpenChange={() => setEntryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer cette analyse ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (entryToDelete) {
                  deleteEntry(entryToDelete);
                  setEntryToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation tout effacer */}
      <AlertDialog open={showClearAll} onOpenChange={setShowClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Effacer tout l'historique</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer toutes les analyses enregistrées ({history.length} entrée{history.length > 1 ? 's' : ''}) ? 
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearHistory();
                setShowClearAll(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Tout effacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
