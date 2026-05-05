import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProtocolSelectorStep } from './ProtocolSelectorStep';
import { Structure } from '@/types/dvh';
import { TreatmentProtocol } from '@/types/protocol';

interface ProtocolSelectorDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  structures: Structure[];
  onSelect: (protocol: TreatmentProtocol) => void;
}

export const ProtocolSelectorDialog = ({
  open, onOpenChange, structures, onSelect,
}: ProtocolSelectorDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Choisir un protocole</DialogTitle>
      </DialogHeader>
      <ProtocolSelectorStep
        structures={structures}
        onSelect={(p) => { onSelect(p); onOpenChange(false); }}
        onSkip={() => onOpenChange(false)}
      />
    </DialogContent>
  </Dialog>
);

export default ProtocolSelectorDialog;
