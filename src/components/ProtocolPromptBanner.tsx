import { Button } from '@/components/ui/button';
import { Target, ChevronRight } from 'lucide-react';

interface ProtocolPromptBannerProps {
  onPickProtocol: () => void;
}

export const ProtocolPromptBanner = ({ onPickProtocol }: ProtocolPromptBannerProps) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
    <div className="flex items-center gap-3 min-w-0">
      <div className="rounded-md bg-primary/15 p-1.5 flex-shrink-0">
        <Target className="w-4 h-4 text-primary" />
      </div>
      <p className="text-sm text-foreground truncate">
        Associez un protocole pour afficher les contraintes de dose directement sur les courbes DVH.
      </p>
    </div>
    <Button size="sm" onClick={onPickProtocol} className="flex-shrink-0">
      Choisir un protocole
      <ChevronRight className="w-4 h-4 ml-1" />
    </Button>
  </div>
);

export default ProtocolPromptBanner;
