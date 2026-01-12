import { Handler } from "@netlify/functions";

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { imageUrl } = JSON.parse(event.body || '{}');
    if (!imageUrl) return { statusCode: 400, body: JSON.stringify({ error: "Image URL required" }) };

    const token = process.env.XAI_API_KEY;
    if (!token) return { statusCode: 500, body: JSON.stringify({ error: "XAI_API_KEY not set" }) };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "grok-2-vision-1212",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Identify this plant. Return ONLY a JSON object with keys \"class\" (Genus) and \"scientific\" (Scientific Name). If you cannot identify it, return \"Unknown\" for both values. Do not include markdown formatting." },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        stream: false,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`Grok API Error: ${response.status} ${text}`);
        throw new Error(`Grok API error: ${response.status} ${text}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No identification returned");

    let result;
    try {
        // Clean up markdown code blocks if present
        const cleanJson = content.replace(/```json\n?|```/g, '').trim();
        result = JSON.parse(cleanJson);
    } catch (e) {
        console.error("Failed to parse Grok response", content);
        return { statusCode: 200, body: JSON.stringify({
            error: "AI response parsing failed. Raw: " + (content ? content.substring(0, 100) : "Empty response")
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