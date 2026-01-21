import { Handler } from "@netlify/functions";
import sharp from "sharp";
import crypto from "crypto";
import busboy from "busboy";

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

    // Parse multipart
    const fields: any = {};
    let imageBuffer: Buffer | undefined;

    try {
        const parsed = await parseMultipartForm(event);
        Object.assign(fields, parsed.fields);
        imageBuffer = parsed.file;
    } catch (e) {
        // Fallback to JSON if not multipart (backward compatibility)
        if (event.headers['content-type']?.includes('application/json')) {
             const body = JSON.parse(event.body || '{}');
             fields.folder = body.folder;
             fields.public_id = body.public_id;
             if (body.image && body.image.startsWith("data:")) {
                 const base64 = body.image.split(",").pop();
                 imageBuffer = Buffer.from(base64, "base64");
             }
        }
    }

    if (!imageBuffer) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No image file provided" })
      };
    }

    const { folder, public_id } = fields;

    // Resize + optimize
    let quality = 85;
    let optimized = await sharp(imageBuffer)
      .resize(1200, null, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    console.log(`Original size: ${imageBuffer.byteLength}, Optimized size: ${optimized.byteLength}`);
    const opt = optimized.byteLength
    // Shrink to < 1MB
    while (optimized.byteLength > 1024 * 1024 && quality > 10) {
      quality -= 10;
      optimized = await sharp(imageBuffer)
        .resize(1200, null, { fit: "inside", withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
    }
    console.log(`Original size: ${opt}, Optimized size: ${optimized.byteLength}`);
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

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(optimized)], { type: "image/webp" }));
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    form.append("upload_preset", uploadPreset);
    if (folder) form.append("folder", folder);
    if (public_id) form.append("public_id", public_id);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: form,
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

function parseMultipartForm(event: any): Promise<{ file?: Buffer, fields: any }> {
  return new Promise((resolve, reject) => {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
        return reject(new Error("Not multipart"));
    }

    const bb = busboy({ headers: { 'content-type': contentType } });
    
    let fileBuffer: Buffer | undefined;
    const fields: any = {};

    bb.on('file', (fieldname, file, info) => {
      const chunks: Buffer[] = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        if (fieldname === 'image' || fieldname === 'file') {
            fileBuffer = Buffer.concat(chunks);
        }
      });
    });

    bb.on('field', (fieldname, value) => {
      fields[fieldname] = value;
    });

    bb.on('finish', () => {
      resolve({ file: fileBuffer, fields });
    });

    bb.on('error', reject);

    const body = event.isBase64Encoded 
      ? Buffer.from(event.body, 'base64') 
      : event.body;
    
    bb.write(body);
    bb.end();
  });
}
