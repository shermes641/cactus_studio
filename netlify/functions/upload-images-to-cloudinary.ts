import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import sharp from 'sharp';
import crypto from 'crypto';

export const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD;
    const uploadPreset = process.env.CLOUDINARY_PRESET_SIGNED;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const databaseUrl = process.env.DATABASE_URL;

    if (!cloudName || !uploadPreset || !apiKey || !apiSecret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Cloudinary configuration missing. Please set CLOUDINARY_CLOUD, CLOUDINARY_PRESET_SIGNED, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.' 
        })
      };
    }

    if (!databaseUrl) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'DATABASE_URL not configured' })
      };
    }

    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    const force = body.force || false;
    const offset = body.offset || 0;
    const limit = body.limit || 5; // Process 20 products per request

    // Connect to database
    const sql = neon(databaseUrl);

    // Get total count
    const countResult = await sql`SELECT COUNT(*) as total FROM products`;
    const totalProducts = parseInt(countResult[0].total);

    // Fetch batch of products
    const products = await sql`
      SELECT id, name, image_url 
      FROM products 
      where image_url not like '%res.cloudinary.com%'
      ORDER BY id 
      LIMIT ${limit} 
      OFFSET ${offset}
    `;

    if (!products || products.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No products in this batch',
          updated: 0,
          total: totalProducts,
          processed: offset,
          skipped: 0,
          failures: [],
          hasMore: false
        })
      };
    }

    console.log('PRODUCTS TO PROCESS:', products.toString());
    let updated = 0;
    let skipped = 0;
    const failures: Array<{ id: number; name: string; error: string }> = [];

    // Process products in parallel (but only this batch)
    await Promise.all(products.map(async (product) => {
      try {
        // Skip if already has Cloudinary URL (unless force is true)
        if (!force && product.image_url && product.image_url.includes('cloudinary.com')) {
          skipped++;
          return;
        }

        // Fetch the image as a buffer
        // const imageResponse = await fetch(product.image_url, {
        //   signal: AbortSignal.timeout(10000) // 10 second timeout per image
        // });

        const imageResponse = await fetch(product.image_url, {
           signal: AbortSignal.timeout(10000),
           headers: {
             'User-Agent': 'Mozilla/5.0 (compatible; YourAppName/1.0; +https://your-site.com/contact)' // Customize with your app/site details
           }
        });
        
        if (!imageResponse.ok) {
          failures.push({
            id: product.id,
            name: product.name,
            error: `Failed to fetch image: ${imageResponse.statusText}`
          });
          return;
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        
        // Resize image to max 1200px width, convert to WebP for smaller file size
        const resizedBuffer = await sharp(Buffer.from(imageBuffer))
          .resize(1200, null, { 
            withoutEnlargement: true, // Don't enlarge smaller images
            fit: 'inside' // Maintain aspect ratio
          })
          .webp({ quality: 85 }) // Convert to WebP with 85% quality
          .toBuffer();
        
        const base64Image = resizedBuffer.toString('base64');
        
        // Generate a clean public_id from product name
        const cleanPublicId = `product_${product.id}_${product.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        
        const timestamp = Math.round((new Date()).getTime() / 1000);
        
        // Params to sign (sorted alphabetically)
        const paramsStr = `invalidate=true&public_id=${cleanPublicId}&timestamp=${timestamp}&upload_preset=${uploadPreset}`;
        const signature = crypto.createHash('sha1').update(paramsStr + apiSecret).digest('hex');

        // Upload to Cloudinary using base64
        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              file: `data:image/webp;base64,${base64Image}`,
              upload_preset: uploadPreset,
              public_id: cleanPublicId,
              invalidate: true, // Invalidate CDN cache on overwrite
              api_key: apiKey,
              timestamp: timestamp,
              signature: signature
            }),
            signal: AbortSignal.timeout(15000) // 15 second timeout for upload
          }
        );

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          failures.push({
            id: product.id,
            name: product.name,
            error: errorData.error?.message || 'Upload failed'
          });
          return;
        }

        const uploadData = await uploadResponse.json();
        const newImageUrl = uploadData.secure_url;

        // Update database with new Cloudinary URL
        await sql`
          UPDATE products 
          SET image_url = ${newImageUrl}
          WHERE id = ${product.id}
        `;

        updated++;
      } catch (error) {
        failures.push({
          id: product.id,
          name: product.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }));

    const processed = offset + products.length;
    const hasMore = processed < totalProducts;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Processed batch: ${updated} uploaded, ${skipped} skipped, ${failures.length} failed`,
        updated,
        total: totalProducts,
        processed,
        skipped,
        failures,
        hasMore
      })
    };
  } catch (error) {
    console.error('Error uploading images to Cloudinary:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to upload images',
        details: error instanceof Error ? error.message : String(error)
      })
    };
  }
};