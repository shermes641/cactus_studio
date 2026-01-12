import { Handler } from "@netlify/functions";

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { imageUrl } = JSON.parse(event.body || '{}');
    if (!imageUrl) return { statusCode: 400, body: JSON.stringify({ error: "Image URL required" }) };

    const token = process.env.OPENAI_API_KEY;
    if (!token) return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY not set" }) };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Identify this plant. Return ONLY a JSON object with keys \"class\" (Genus) and \"scientific\" (Scientific Name). If you cannot identify it, return \"Unknown\" for both values." },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`OpenAI API Error: ${response.status} ${text}`);
        throw new Error(`OpenAI API error: ${response.status} ${text}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("No content in OpenAI response");

    let result;
    try {
        result = JSON.parse(content);
    } catch (e) {
        console.error("JSON Parse Error", content);
        return { statusCode: 200, body: JSON.stringify({ error: "AI response parsing failed" }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        class: result.class || "Unknown",
        scientific: result.scientific || "Unknown"
      })
    };

  } catch (e: any) {
    console.error("Handler Error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};