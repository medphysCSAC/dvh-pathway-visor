import { AlertTriangle, AlertCircle, X, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DoseAlert } from "@/utils/criticalDoseAlerts";
import { useState } from "react";

interface CriticalDoseAlertsProps {
  alerts: DoseAlert[];
  onDismiss?: () => void;
}

export function CriticalDoseAlerts({ alerts, onDismiss }: CriticalDoseAlertsProps) {
  const [dismissed, setDismissed] = useState(false);

  if (alerts.length === 0 || dismissed) return null;

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Alert 
      variant="destructive" 
      className="mb-4 border-2 border-destructive/50 bg-destructive/10"
    >
      <ShieldAlert className="h-5 w-5" />
      <AlertTitle className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          Alertes de dépassement de dose
          {criticalCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {criticalCount} critique{criticalCount > 1 ? 's' : ''}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">
              {warningCount} avertissement{warningCount > 1 ? 's' : ''}
            </Badge>
          )}
        </span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleDismiss}
          className="h-6 w-6 p-0 hover:bg-destructive/20"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-3">
        <ScrollArea className="max-h-48">
          <div className="space-y-2">
            {alerts.map((alert, index) => (
              <div 
                key={`${alert.structureName}-${alert.metricType}-${index}`}
                className={`flex items-start gap-3 p-2 rounded-md ${
                  alert.severity === 'critical' 
                    ? 'bg-destructive/20 border border-destructive/30' 
                    : 'bg-yellow-500/10 border border-yellow-500/30'
                }`}
              >
                {alert.severity === 'critical' ? (
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
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
                      ? 'text-destructive' 
                      : 'text-yellow-600 dark:text-yellow-400'
                  }`}>
                    ⚠️ Risque: {alert.risk}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
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
