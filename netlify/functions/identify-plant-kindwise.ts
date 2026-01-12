import { Handler } from "@netlify/functions";

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  
  try {
    const { imageUrl } = JSON.parse(event.body || '{}');
    if (!imageUrl) return { statusCode: 400, body: JSON.stringify({ error: "Image URL required" }) };

    const apiKey = process.env.PLANT_ID_API_KEY;
    if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: "PLANT_ID_API_KEY not set" }) };
    
    const response = await fetch('https://api.plant.id/v3/identification?details=common_names,url,taxonomy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Api-Key': apiKey
        },
        body: JSON.stringify({
            images: [imageUrl],
            similar_images: true
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Plant.id API error: ${response.status} ${text}`);
    }

    const data = await response.json();
    const suggestions = data.result?.classification?.suggestions;

    if (!suggestions || suggestions.length === 0) {
        return { statusCode: 404, body: JSON.stringify({ error: "No plants identified" }) };
    }

    console.log('SSSS', JSON.stringify(suggestions, null, 2));
    const suggestion = suggestions[0];
    const scientific = suggestion.name;
    const plantClass = suggestion.details?.taxonomy?.class || scientific.split(' ')[0] || "Unknown";
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        class: plantClass,
        scientific: scientific
      })
    };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};