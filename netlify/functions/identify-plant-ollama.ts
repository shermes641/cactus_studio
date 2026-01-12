import { Handler } from "@netlify/functions";

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { imageUrl } = JSON.parse(event.body || '{}');
    if (!imageUrl) return { statusCode: 400, body: JSON.stringify({ error: "Image URL required" }) };

    // Default to localhost for local dev, or use env var
    const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "llava";

    let base64Data = '';

    if (imageUrl.startsWith('data:')) {
        base64Data = imageUrl.split(',')[1];
    } else {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) return { statusCode: 400, body: JSON.stringify({ error: "Failed to fetch image" }) };
        const arrayBuffer = await imgRes.arrayBuffer();
        base64Data = Buffer.from(arrayBuffer).toString('base64');
    }

    const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: [{
                role: "user",
                content: "Identify this plant. Return ONLY a JSON object with keys \"class\" (Genus) and \"scientific\" (Scientific Name). If you cannot identify it, return \"Unknown\" for both values.",
                images: [base64Data]
            }],
            stream: false,
            format: "json"
        })
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`Ollama API Error: ${response.status} ${text}`);
        if (response.status === 404) {
            throw new Error(`Model '${model}' not found. Please run 'ollama pull ${model}'`);
        }
        throw new Error(`Ollama API error: ${response.status} ${text}`);
    }

    const data = await response.json();
    const content = data.message?.content;
    if (!content) throw new Error("No identification returned");

    let result;
    try {
        result = JSON.parse(content);
    } catch (e) {
        console.error("Failed to parse Ollama response", content);
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
    console.error("Ollama Handler Error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};