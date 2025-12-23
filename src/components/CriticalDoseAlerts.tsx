import { AlertTriangle, AlertCircle, X, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DoseAlert } from "@/utils/criticalDoseAlerts";
import { useState, useMemo } from "react";

interface CriticalDoseAlertsProps {
  alerts: DoseAlert[];
  onDismiss?: () => void;
}

export function CriticalDoseAlerts({ alerts, onDismiss }: CriticalDoseAlertsProps) {
  const [dismissedAll, setDismissedAll] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Filter out dismissed individual alerts
  const visibleAlerts = useMemo(() => {
    return alerts.filter((alert, index) => {
      const alertKey = `${alert.structureName}-${alert.metricType}-${index}`;
      return !dismissedAlerts.has(alertKey);
    });
  }, [alerts, dismissedAlerts]);

  if (visibleAlerts.length === 0 || dismissedAll) return null;

  const criticalCount = visibleAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = visibleAlerts.filter(a => a.severity === 'warning').length;

  const handleDismissAll = () => {
    setDismissedAll(true);
    onDismiss?.();
  };

  const handleDismissOne = (alertKey: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertKey]));
  };

  // Determine max height based on number of alerts (show up to 4, then scroll)
  const maxVisibleAlerts = 4;
  const needsScroll = visibleAlerts.length > maxVisibleAlerts;

  return (
    <Alert 
      variant="destructive" 
      className="mb-4 border-l-4 border-l-error border border-error/30 bg-error/5 card-elevated"
    >
      <ShieldAlert className="h-5 w-5 text-error" />
      <AlertTitle className="flex items-center justify-between">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">Alertes de dépassement de dose</span>
          {criticalCount > 0 && (
            <Badge className="badge-error">
              {criticalCount} critique{criticalCount > 1 ? 's' : ''}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge className="badge-warning">
              {warningCount} avertissement{warningCount > 1 ? 's' : ''}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            ({visibleAlerts.length} sur {alerts.length})
          </span>
        </span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleDismissAll}
          className="h-7 px-2 hover:bg-error/20 text-error hover:text-error"
          title="Fermer toutes les alertes"
        >
          <X className="h-4 w-4 mr-1" />
          <span className="text-xs">Tout fermer</span>
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-3">
        <div 
          className={`space-y-2 ${needsScroll ? 'overflow-y-auto pr-2' : ''}`}
          style={{ maxHeight: needsScroll ? '280px' : 'auto' }}
        >
          {visibleAlerts.map((alert, index) => {
            // Recalculate original index for stable key
            const originalIndex = alerts.findIndex(
              (a, i) => a.structureName === alert.structureName && 
                        a.metricType === alert.metricType && 
                        !dismissedAlerts.has(`${a.structureName}-${a.metricType}-${i}`)
            );
            const alertKey = `${alert.structureName}-${alert.metricType}-${originalIndex !== -1 ? originalIndex : index}`;
            
            return (
              <div 
                key={alertKey}
                className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-200 group ${
                  alert.severity === 'critical' 
                    ? 'bg-error/10 border border-error/20 hover:bg-error/15' 
                    : 'bg-warning/10 border border-warning/20 hover:bg-warning/15'
                }`}
              >
                {alert.severity === 'critical' ? (
                  <AlertCircle className="h-4 w-4 text-error mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{alert.structureName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {alert.metricType} = {alert.value} {alert.unit}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      (seuil: {alert.threshold} {alert.unit})
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${
                    alert.severity === 'critical' 
                      ? 'text-error' 
                      : 'text-warning'
                  }`}>
                    ⚠️ Risque: {alert.risk}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismissOne(alertKey)}
                  className={`h-6 w-6 p-0 opacity-50 group-hover:opacity-100 transition-opacity ${
                    alert.severity === 'critical'
                      ? 'hover:bg-error/20 text-error'
                      : 'hover:bg-warning/20 text-warning'
                  }`}
                  title="Fermer cette alerte"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
        {needsScroll && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            ↕ Faites défiler pour voir toutes les alertes
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Compact inline alert for individual structures
interface InlineAlertBadgeProps {
  alert: DoseAlert;
}

export function InlineAlertBadge({ alert }: InlineAlertBadgeProps) {
  return (
    <Badge 
      variant={alert.severity === 'critical' ? 'destructive' : 'outline'}
      className={`text-xs ${
        alert.severity !== 'critical' 
          ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400' 
          : ''
      }`}
    >
      {alert.severity === 'critical' ? (
        <AlertCircle className="h-3 w-3 mr-1" />
      ) : (
        <AlertTriangle className="h-3 w-3 mr-1" />
      )}
      {alert.risk}
    </Badge>
  );
}
