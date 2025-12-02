import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAnalysisHistory, AnalysisHistoryEntry } from '@/hooks/useAnalysisHistory';
import { Clock, Trash2, FileText, AlertCircle, CheckCircle2, XCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState, useMemo } from 'react';

interface AnalysisHistoryProps {
  onLoadReport?: (entry: AnalysisHistoryEntry) => void;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 15, 20];

export default function AnalysisHistory({ onLoadReport }: AnalysisHistoryProps) {
  const { history, deleteEntry, clearHistory } = useAnalysisHistory();
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filtered history
  const filteredHistory = useMemo(() => {
    return history.filter(entry => {
      const matchesSearch = 
        entry.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.protocolName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || entry.overallStatus === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [history, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

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
              {filteredHistory.length} analyse(s) sur {history.length}
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

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher patient ou protocole..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="PASS">Validé</SelectItem>
              <SelectItem value="FAIL">Échec</SelectItem>
              <SelectItem value="WARNING">Avertissement</SelectItem>
            </SelectContent>
          </Select>
          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEMS_PER_PAGE_OPTIONS.map(opt => (
                <SelectItem key={opt} value={opt.toString()}>{opt} par page</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucun résultat pour cette recherche
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {paginatedHistory.map((entry) => (
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} sur {totalPages} ({filteredHistory.length} résultats)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
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