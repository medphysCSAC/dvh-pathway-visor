import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';
import { ContextualHelp } from './ContextualHelp';

interface FileUploadProps {
  onFilesUploaded: (relFile: File, absFile?: File) => void;
}

export const FileUpload = ({ onFilesUploaded }: FileUploadProps) => {
  const [relFile, setRelFile] = useState<File | null>(null);
  const [absFile, setAbsFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileChange = (type: 'rel' | 'abs', file: File | null) => {
    setError('');
    if (type === 'rel') {
      setRelFile(file);
    } else {
      setAbsFile(file);
    }
  };

  const handleUpload = () => {
    if (!relFile) {
      setError('Veuillez sélectionner au minimum le fichier DVH REL');
      return;
    }
    onFilesUploaded(relFile, absFile || undefined);
  };

  return (
    <Card className="border-2 border-dashed border-border hover:border-primary transition-all duration-300">
      <CardContent className="p-8">
        <div className="flex flex-col items-center gap-6">
          <div className="rounded-full bg-gradient-to-br from-primary to-accent p-4">
            <Upload className="w-8 h-8 text-primary-foreground" />
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3 className="text-xl font-semibold">Importer les fichiers DVH</h3>
              <ContextualHelp 
                content="Importez vos fichiers DVH exportés depuis TomoTherapy. Le fichier REL contient les doses relatives en %, le fichier ABS contient les doses absolues en cc. Au minimum, le fichier REL est nécessaire."
                side="right"
              />
            </div>
            <p className="text-muted-foreground">
              Le fichier REL est requis. Le fichier ABS est optionnel (nécessaire pour les métriques en cc).
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 w-full max-w-2xl">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium">
                  Fichier DVH Relatif (REL)
                </label>
                <ContextualHelp 
                  content="Fichier contenant les données DVH en pourcentage (%). Ce fichier est obligatoire pour l'analyse."
                  side="top"
                />
              </div>
              <div className="relative">
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => handleFileChange('rel', e.target.files?.[0] || null)}
                  className="hidden"
                  id="rel-file"
                />
                <label
                  htmlFor="rel-file"
                  className="flex items-center gap-2 p-4 border-2 border-border rounded-lg cursor-pointer hover:border-primary transition-colors bg-card"
                >
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm truncate">
                    {relFile ? relFile.name : 'Sélectionner fichier REL...'}
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium">
                  Fichier DVH Absolu (ABS)
                </label>
                <ContextualHelp 
                  content="Fichier contenant les volumes absolus en cc. Optionnel mais nécessaire pour calculer les métriques volumiques absolues (ex: V20cc, D0.03cc)."
                  side="top"
                />
              </div>
              <div className="relative">
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => handleFileChange('abs', e.target.files?.[0] || null)}
                  className="hidden"
                  id="abs-file"
                />
                <label
                  htmlFor="abs-file"
                  className="flex items-center gap-2 p-4 border-2 border-border rounded-lg cursor-pointer hover:border-primary transition-colors bg-card"
                >
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm truncate">
                    {absFile ? absFile.name : 'Sélectionner fichier ABS...'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

      <Button
        onClick={handleUpload}
        disabled={!relFile}
        size="lg"
        className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
      >
        Analyser le(s) fichier(s) DVH
      </Button>
        </div>
      </CardContent>
    </Card>
  );
};
