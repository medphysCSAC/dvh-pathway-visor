import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const { fileContent, mimeType, fileName } = await req.json();

    if (!fileContent) {
      throw new Error('File content is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Processing file: ${fileName}, type: ${mimeType}`);

    // For text-based files, decode the content
    let textContent = '';
    
    if (mimeType === 'text/plain' || mimeType === 'text/csv' || mimeType === 'application/csv') {
      // Decode base64 to text
      textContent = atob(fileContent);
    } else if (mimeType === 'application/json') {
      textContent = atob(fileContent);
    } else {
      // For PDF, Word, Excel - we'll send as base64 and use vision model
      // The AI can read text from document images
      console.log('Using vision model for document extraction...');
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `Tu es un expert en radiothérapie. Analyse ce document et extrais les informations de protocole de traitement.

RÈGLES STRICTES:
1. Extrais TOUTES les prescriptions (PTV) avec leurs doses et fractionnements
2. Extrais TOUTES les contraintes OAR (organes à risque)
3. Pour les contraintes, identifie le type:
   - "Vx" (ex: V20Gy < 30%) → constraintType: "Vx", target: 20, value: 30, unit: "%"
   - "Dx" (ex: D2% < 50Gy) → constraintType: "Dx", target: 2, value: 50, unit: "Gy"
   - "Dmax" → constraintType: "Dmax", value: dose en Gy, unit: "Gy"
   - "Dmean" → constraintType: "Dmean", value: dose en Gy, unit: "Gy"
4. Convertis TOUTES les doses en Gy (divise par 100 si en cGy)
5. Priority: "mandatory" = obligatoire, "optimal" = important, "desirable" = souhaitable

RETOURNE UNIQUEMENT UN JSON VALIDE avec cette structure exacte:
{
  "name": "Nom du protocole",
  "location": "Localisation anatomique",
  "prescriptions": [
    {
      "ptvName": "PTV...",
      "dosePerFraction": number (Gy),
      "numberOfFractions": number,
      "totalDose": number (Gy)
    }
  ],
  "oarConstraints": [
    {
      "organName": "Nom OAR",
      "constraintType": "Vx" | "Dx" | "Dmax" | "Dmean",
      "target": number (optionnel, pour Vx=dose en Gy, pour Dx=volume en %),
      "value": number,
      "unit": "Gy" | "%",
      "priority": "mandatory" | "optimal" | "desirable"
    }
  ]
}`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyse ce document et extrais le protocole de radiothérapie. Retourne UNIQUEMENT le JSON.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${fileContent}`
                  }
                }
              ]
            }
          ]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const data = await response.json();
      console.log('AI response received, parsing JSON...');
      
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from AI response');
      }

      const protocol = JSON.parse(jsonMatch[0]);
      console.log(`Protocol extracted successfully: ${protocol.name}`);

      return new Response(JSON.stringify({ protocol }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For text-based content, use text prompt
    console.log('Processing text content...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en radiothérapie. Analyse ce texte et extrais les informations de protocole de traitement.

RÈGLES STRICTES:
1. Extrais TOUTES les prescriptions (PTV) avec leurs doses et fractionnements
2. Extrais TOUTES les contraintes OAR (organes à risque)
3. Pour les contraintes, identifie le type:
   - "Vx" (ex: V20Gy < 30%) → constraintType: "Vx", target: 20, value: 30, unit: "%"
   - "Dx" (ex: D2% < 50Gy) → constraintType: "Dx", target: 2, value: 50, unit: "Gy"
   - "Dmax" → constraintType: "Dmax", value: dose en Gy, unit: "Gy"
   - "Dmean" → constraintType: "Dmean", value: dose en Gy, unit: "Gy"
4. Convertis TOUTES les doses en Gy (divise par 100 si en cGy)
5. Priority: "mandatory" = obligatoire, "optimal" = important, "desirable" = souhaitable

RETOURNE UNIQUEMENT UN JSON VALIDE avec cette structure exacte:
{
  "name": "Nom du protocole",
  "location": "Localisation anatomique",
  "prescriptions": [
    {
      "ptvName": "PTV...",
      "dosePerFraction": number (Gy),
      "numberOfFractions": number,
      "totalDose": number (Gy)
    }
  ],
  "oarConstraints": [
    {
      "organName": "Nom OAR",
      "constraintType": "Vx" | "Dx" | "Dmax" | "Dmean",
      "target": number (optionnel, pour Vx=dose en Gy, pour Dx=volume en %),
      "value": number,
      "unit": "Gy" | "%",
      "priority": "mandatory" | "optimal" | "desirable"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Analyse ce document et extrais le protocole de radiothérapie. Retourne UNIQUEMENT le JSON.\n\nContenu du fichier "${fileName}":\n\n${textContent}`
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received, parsing JSON...');
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from AI response');
    }

    const protocol = JSON.parse(jsonMatch[0]);
    console.log(`Protocol extracted successfully: ${protocol.name}`);

    return new Response(JSON.stringify({ protocol }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-protocol-from-file function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
