import { Handler } from "@netlify/functions";
import { neon } from "@neondatabase/serverless";
import sharp from "sharp";
import crypto from "crypto";
import { genSku } from "./shared.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const {
      CLOUDINARY_CLOUD,
      CLOUDINARY_PRESET_SIGNED,
      CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET,
      DATABASE_URL
    } = process.env;

    if (
      !CLOUDINARY_CLOUD ||
      !CLOUDINARY_PRESET_SIGNED ||
      !CLOUDINARY_API_KEY ||
      !CLOUDINARY_API_SECRET ||
      !DATABASE_URL
    ) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing environment variables" })
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const lastId = Number(body.lastId ?? 0);
    const force = Boolean(body.force ?? false);
    const folder = body.folder ?? "cactus";

    // HARD LIMIT for Netlify safety
    const limit = Math.min(Number(body.limit ?? 3), 10);

    const sql = neon(DATABASE_URL);

    const products = await sql`
      SELECT id, name, image_url, class
      FROM products
      WHERE id > ${lastId}
        AND (
          ${force} = true
          OR image_url NOT LIKE '%res.cloudinary.com%'
        )
      ORDER BY id
      LIMIT ${limit}
    `;

    if (products.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          hasMore: false,
          lastId
        })
      };
    }

    let updated = 0;
    const failures: Array<{ id: number; name: string; error: string }> = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      try {
        if (!force && product.image_url?.includes("res.cloudinary.com")) {
          continue;
        }

        // Rate limit protection: pause between items
        if (i > 0) await sleep(1000);

        let imageRes = await fetch(product.image_url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (ImageMigrator)"
          }
        });

        if (imageRes.status === 429) {
          console.warn(`429 Rate Limit for ${product.name}. Pausing 5s...  ${product.image_url}`);
          await sleep(5000);
          imageRes = await fetch(product.image_url, {
            headers: { "User-Agent": "Mozilla/5.0 (ImageMigrator)" }
          });
        }

        if (!imageRes.ok) {
          throw new Error(`Image fetch failed (${imageRes.status})`);
        }

        const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

        let quality = 85;
        let optimized = await sharp(imageBuffer)
          .resize(1200, null, {
            fit: "inside",
            withoutEnlargement: true
          })
          .webp({ quality })
          .toBuffer();

        console.log(`Original size: ${imageBuffer.byteLength}, Optimized size: ${optimized.byteLength}`);
        const opt = optimized.byteLength
        while (optimized.byteLength > 1024 * 1024 && quality > 10) {
          quality -= 10;
          optimized = await sharp(imageBuffer)
            .resize(1200, null, { fit: "inside", withoutEnlargement: true })
            .webp({ quality })
            .toBuffer();
        }
        console.log(`Original size: ${opt}, Optimized size: ${optimized.byteLength}`);
        const publicId = genSku(product.class, product.name, product.id);

        const timestamp = Math.floor(Date.now() / 1000);

        const paramsToSign = {
          folder,
          invalidate: true,
          public_id: publicId,
          timestamp,
          upload_preset: CLOUDINARY_PRESET_SIGNED
        };

        const signature = crypto
          .createHash("sha1")
          .update(
            Object.keys(paramsToSign)
              .sort()
              .map(
                (k) =>
                  `${k}=${paramsToSign[k as keyof typeof paramsToSign]}`
              )
              .join("&") + CLOUDINARY_API_SECRET
          )
          .digest("hex");

        // ✅ Web-standard multipart upload
        const blob = new Blob([new Uint8Array(optimized)], {
          type: "image/webp"
        });


        const form = new FormData();
        form.append("file", blob, `${publicId}.webp`);
        form.append("api_key", CLOUDINARY_API_KEY);
        form.append("timestamp", String(timestamp));
        form.append("signature", signature);
        form.append("upload_preset", CLOUDINARY_PRESET_SIGNED);
        form.append("public_id", publicId);
        form.append("folder", folder);
        form.append("invalidate", "true");

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
          {
            method: "POST",
            body: form
          }
        );

        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(
            uploadData?.error?.message || "Cloudinary upload failed"
          );
        }

        await sql`
          UPDATE products
          SET image_url = ${uploadData.secure_url}
          WHERE id = ${product.id}
        `;

        updated++;
      } catch (err) {
        console.error(`Upload failed for product ${product.id} (${product.name}):`, err);
        failures.push({
          id: product.id,
          name: product.name,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    const newLastId = products[products.length - 1].id;

    return {
      statusCode: 200,
      body: JSON.stringify({
        updated,
        failures,
        lastId: newLastId,
        hasMore: products.length === limit
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Unhandled error",
        details: err instanceof Error ? err.message : String(err)
      })
    };
  }
};
