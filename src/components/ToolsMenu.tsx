import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Settings, BookOpen, FileText, History, HelpCircle } from 'lucide-react';

export type ToolKey = 'protocols' | 'converter' | 'history' | 'help';

interface ToolsMenuProps {
  onSelect: (tool: ToolKey) => void;
}

const ITEMS: { key: ToolKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'protocols', label: 'Gérer les protocoles', icon: BookOpen },
  { key: 'converter', label: 'Convertisseur', icon: FileText },
  { key: 'history',   label: 'Historique', icon: History },
  { key: 'help',      label: 'Aide', icon: HelpCircle },
];

export const ToolsMenu = ({ onSelect }: ToolsMenuProps) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="sm" className="gap-2">
        <Settings className="w-4 h-4" />
        Outils
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-56 p-1">
      {ITEMS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left"
        >
          <Icon className="w-4 h-4 text-muted-foreground" />
          {label}
        </button>
      ))}
    </PopoverContent>
  </Popover>
);

export default ToolsMenu;
