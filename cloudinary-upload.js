#!/usr/bin/env node
/**
 * Batch Upload Images to Cloudinary
 * 
 * Usage:
 *   node cloudinary-upload.js [folder] [cloud_name] [upload_preset]
 * 
 * Example:
 *   node cloudinary-upload.js ./images my_cloud_name unsigned_preset
 * 
 * Or set env vars:
 *   CLOUDINARY_CLOUD=my_cloud_name
 *   CLOUDINARY_PRESET=unsigned_preset
 *   node cloudinary-upload.js ./images
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const args = process.argv.slice(2);
const imageFolder = args[0] || './images';
const cloudName = args[1] || process.env.CLOUDINARY_CLOUD || 'your_cloud_name';
const uploadPreset = args[2] || process.env.CLOUDINARY_PRESET || 'unsigned_preset';

const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

async function uploadImage(filePath, fileName) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('upload_preset', uploadPreset);
    form.append('folder', 'cactus-studio');

    console.log(`  📤 Uploading: ${fileName}...`);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const err = await res.json();
      console.error(`  ❌ Failed: ${err.error?.message || 'Unknown error'}`);
      return null;
    }

    const data = await res.json();
    const optimizedUrl = data.secure_url.replace('/upload/', '/upload/w_500,q_auto,f_webp/');
    console.log(`  ✅ Success: ${optimizedUrl}`);
    return {
      original_url: data.secure_url,
      optimized_url: optimizedUrl,
      public_id: data.public_id,
      filename: fileName,
    };
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
    return null;
  }
}

async function main() {
  if (!fs.existsSync(imageFolder)) {
    console.error(`❌ Folder not found: ${imageFolder}`);
    process.exit(1);
  }

  if (cloudName === 'your_cloud_name') {
    console.error('❌ CLOUDINARY_CLOUD not set. Set via env var or pass as argument.');
    process.exit(1);
  }

  console.log(`🔍 Scanning for images in: ${imageFolder}`);
  console.log(`☁️  Using Cloudinary cloud: ${cloudName}\n`);

  const files = fs.readdirSync(imageFolder);
  const imageFiles = files.filter(f => SUPPORTED_FORMATS.includes(path.extname(f).toLowerCase()));

  if (imageFiles.length === 0) {
    console.log('⚠️  No image files found.');
    process.exit(0);
  }

  console.log(`Found ${imageFiles.length} image(s).\n`);

  const results = [];
  for (const file of imageFiles) {
    const filePath = path.join(imageFolder, file);
    const result = await uploadImage(filePath, file);
    if (result) results.push(result);
  }

  console.log(`\n✨ Upload complete! ${results.length}/${imageFiles.length} succeeded.\n`);

  if (results.length > 0) {
    console.log('📋 URLs for data.json:\n');
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${JSON.stringify({
        "id": i + 1,
        "name": r.filename.replace(/\.[^/.]+$/, ''),
        "price_cents": 2500,
        "image_url": r.optimized_url,
        "class": "Cactus"
      }, null, 2).split('\n').join('\n     ')}`);
    });
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
