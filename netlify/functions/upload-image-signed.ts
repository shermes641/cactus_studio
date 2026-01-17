import { Handler } from "@netlify/functions";
import sharp from "sharp";
import crypto from "crypto";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD;
    const uploadPreset = process.env.CLOUDINARY_PRESET_SIGNED;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !uploadPreset || !apiKey || !apiSecret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Cloudinary config missing" })
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { image, folder, public_id } = body;

    if (!image) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "image is required" })
      };
    }

    // Fetch image if URL
    let imageBuffer: Buffer;

    if (image.startsWith("http")) {
      const res = await fetch(image, {
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent": "Mozilla/5.0 (CloudinaryUploader)"
        }
      });

      if (!res.ok) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Failed to fetch image" })
        };
      }

      imageBuffer = Buffer.from(await res.arrayBuffer());
    } else {
      // base64
      const base64 = image.split(",").pop();
      imageBuffer = Buffer.from(base64, "base64");
    }

    // Resize + optimize
    const optimized = await sharp(imageBuffer)
      .resize(1200, null, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const base64Image = optimized.toString("base64");
    const timestamp = Math.round(Date.now() / 1000);

    // Params to sign
    const params: Record<string, string | number> = {
      timestamp,
      upload_preset: uploadPreset
    };

    if (public_id) params.public_id = public_id;
    if (folder) params.folder = folder;

    const paramsStr = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");

    const signature = crypto
      .createHash("sha1")
      .update(paramsStr + apiSecret)
      .digest("hex");

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: `data:image/webp;base64,${base64Image}`,
          api_key: apiKey,
          timestamp,
          signature,
          upload_preset: uploadPreset,
          folder,
          public_id
        }),
        signal: AbortSignal.timeout(15000)
      }
    );

    const data = await uploadRes.json();

    if (!uploadRes.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: data.error?.message || "Upload failed" })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        secure_url: data.secure_url,
        public_id: data.public_id
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Upload failed",
        details: err instanceof Error ? err.message : String(err)
      })
    };
  }
};
