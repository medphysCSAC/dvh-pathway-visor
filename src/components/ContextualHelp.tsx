import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
interface ContextualHelpProps {
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}
export const ContextualHelp = ({
  content,
  side = 'top',
  className = ''
}: ContextualHelpProps) => {
  return <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={`inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors ${className}`} aria-label="Aide contextuelle">
            <Info className="w-[8px] h-[8px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-md">
          <p className="text-sm whitespace-normal break-words">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>;
};