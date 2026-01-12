import { Handler } from "@netlify/functions";

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  
  try {
    const { imageUrl } = JSON.parse(event.body || '{}');
    if (!imageUrl) return { statusCode: 400, body: JSON.stringify({ error: "Image URL required" }) };

    const apiKey = process.env.GEMINI_CACTUS_API_KEY;
    if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_CACTUS_API_KEY not set" }) };
    
    let mimeType = 'image/jpeg';
    let base64Data = '';

    if (imageUrl.startsWith('data:')) {
        const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
        } else {
             return { statusCode: 400, body: JSON.stringify({ error: "Invalid data URL" }) };
        }
    } else {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) return { statusCode: 400, body: JSON.stringify({ error: "Failed to fetch image" }) };
        const arrayBuffer = await imgRes.arrayBuffer();
        base64Data = Buffer.from(arrayBuffer).toString('base64');
        const contentType = imgRes.headers.get('content-type');
        if (contentType) mimeType = contentType;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: "Identify this plant. Return ONLY a JSON object with keys \"class\" (Genus) and \"scientific\" (Scientific Name). If you cannot identify it, return \"Unknown\" for both values. Do not include markdown formatting." },
                    { inline_data: { mime_type: mimeType, data: base64Data } }
                ]
            }],
            generationConfig: {
                response_mime_type: "application/json"
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${text}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No identification returned");

    let result;
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            result = JSON.parse(text.substring(start, end + 1));
        } else {
            throw new Error("No JSON found");
        }
    } catch (e) {
        console.error("Failed to parse Gemini response", text);
        return { statusCode: 200, body: JSON.stringify({ 
            error: "AI response parsing failed. Raw: " + (text ? text.substring(0, 100) : "Empty response")
        }) };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        class: result.class || "Unknown",
        scientific: result.scientific || "Unknown"
      })
    };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};