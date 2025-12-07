/**
 * Parser CSV robuste sans dépendances
 * Gère les virgules dans les champs, les guillemets, et les lignes vides
 */
export function parseCSV(content: string): { data: any[][]; errors: string[] } {
  const lines = content.trim().split(/\r?\n/);
  const result: any[][] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Ignorer les lignes vides

    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    let char: string;

    for (let j = 0; j < line.length; j++) {
      char = line[j];
      
      if (char === '"') {
        // Gestion des guillemets
        if (inQuotes && line[j + 1] === '"') {
          current += '"'; // Guillemet échappé
          j++; // Sauter le guillemet suivant
        } else {
          inQuotes = !inQuotes; // Commencer/finir un champ entre guillemets
        }
      } else if (char === ',' && !inQuotes) {
        // Fin du champ
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    row.push(current.trim()); // Dernier champ

    // Conversion automatique des types
    const typedRow = row.map(cell => {
      if (cell === '') return null;
      const num = Number(cell);
      return isNaN(num) ? cell : num;
    });

    result.push(typedRow);
  }

  return { data: result, errors };
}
