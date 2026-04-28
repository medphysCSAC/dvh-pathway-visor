import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Tu es un expert en radiothérapie. Analyse cette image qui contient un tableau de protocole de traitement (capture d'écran du TPS ou document).

Extrais les informations suivantes au format JSON strict:

{
  "name": "Nom du protocole (déduit de la localisation)",
  "location": "Localisation anatomique (Sein, Prostate, Cavum, etc.)",
  "prescriptions": [
    {
      "ptvName": "Nom du PTV (ex: PTV T, PTV Boost)",
      "totalDose": nombre en Gy,
      "numberOfFractions": nombre de fractions,
      "dosePerFraction": dose par fraction en Gy
    }
  ],
  "oarConstraints": [
    {
      "organName": "Nom de l'organe (Coeur, Poumon, Moelle, etc.)",
      "constraintType": "Dmax" | "Dmean" | "Vx" | "Dx",
      "value": valeur numérique du seuil,
      "unit": "Gy" | "%" | "cc",
      "target": valeur numérique (dose en Gy pour Vx, volume en % ou cc pour Dx),
      "priority": "mandatory" | "optimal" | "desirable",
      "description": "Description originale de la contrainte"
    }
  ]
}

Règles STRICTES pour les contraintes:

1. Vx — le résultat est un VOLUME (% ou cc):
   - V20Gy < 30%   → constraintType:"Vx", target:20, value:30,  unit:"%"
   - V30Gy < 500cc → constraintType:"Vx", target:30, value:500, unit:"cc"
   - V40Gy < 200cc → constraintType:"Vx", target:40, value:200, unit:"cc"
   - V50Gy < 10%   → constraintType:"Vx", target:50, value:10,  unit:"%"
   RÈGLE: unit = "%" si le seuil est en %, unit = "cc" si le seuil est en cc ou cm3

2. Dx — le résultat est une DOSE:
   - D2% < 50Gy → constraintType:"Dx", target:2, value:50, unit:"Gy"

3. Dmax / Dmean — pas de target:
   - DMax < 1.5Gy → constraintType:"Dmax", value:1.5, unit:"Gy"

4. Priorité par défaut: "mandatory" sauf si explicitement indiqué autrement
5. Convertis les noms d'organes en français si nécessaire
6. Convertis toutes les doses en Gy (divise par 100 si en cGy)
7. Si l'image est floue ou illisible, retourne un JSON partiel avec ce qui est lisible

Retourne UNIQUEMENT le JSON, sans markdown ni commentaires.`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Non autorisé - authentification requise' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image base64 requise' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Configuration AI manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing image for protocol extraction...');
    console.log('Image mime type:', mimeType);

    // Construct the image URL for the API
    const imageUrl = `data:${mimeType || 'image/png'};base64,${imageBase64}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyse cette image de protocole de radiothérapie et extrais les données au format JSON.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requêtes atteinte, réessayez plus tard' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Crédits AI insuffisants' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'analyse de l\'image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'Aucune réponse de l\'IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response received, parsing JSON...');

    // Try to extract JSON from the response
    let protocolData;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();

      protocolData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.log('Raw content:', content);
      
      return new Response(
        JSON.stringify({ 
          error: 'Impossible de parser la réponse. L\'image est peut-être difficile à lire.',
          rawContent: content 
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Protocol extracted successfully:', protocolData.name);

    return new Response(
      JSON.stringify({ protocol: protocolData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-protocol-from-image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
