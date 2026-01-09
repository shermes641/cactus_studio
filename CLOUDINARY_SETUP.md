# Cloudinary Image Management Setup

This guide covers setting up Cloudinary for image uploads and optimization.

## 1. Create Cloudinary Account

1. Sign up (free): https://cloudinary.com/users/register/free
2. Go to **Dashboard** → copy your **Cloud Name**
3. Go to **Settings** → **Upload** → Create unsigned upload preset:
   - Name: `unsigned_preset` (or your choice)
   - Unsigned = no backend API key needed (safe for client-side uploads)

## 2. Configure Environment

### Option A: Using env.js (Browser)

Edit `env.js`:
```javascript
window.env = {
    CLOUDINARY_CLOUD: "your_cloud_name",
    CLOUDINARY_PRESET: "unsigned_preset",
};
```

### Option B: Using .env (Node.js scripts)

Create `.env` file in project root:
```
CLOUDINARY_CLOUD=your_cloud_name
CLOUDINARY_PRESET=unsigned_preset
```

## 3. Upload Images

### A. Manual Upload via Admin Panel

1. Go to admin panel (password: `LILY`)
2. Click **📤 Upload** button in "Image URL" field
3. Select image from local file
4. System auto-generates optimized Cloudinary URL
5. Click "Add to Inventory"

### B. Batch Upload Using Node.js

First install dependencies:
```bash
npm install form-data node-fetch
```

Then run the batch uploader:
```bash
node cloudinary-upload.js ./images your_cloud_name unsigned_preset
```

Or with env vars:
```bash
$env:CLOUDINARY_CLOUD="your_cloud_name"
$env:CLOUDINARY_PRESET="unsigned_preset"
node cloudinary-upload.js ./images
```

### C. Batch Upload Using PowerShell (Windows)

```powershell
$env:CLOUDINARY_CLOUD="your_cloud_name"
$env:CLOUDINARY_PRESET="unsigned_preset"
.\cloudinary-upload.ps1 -ImageFolder "./images"
```

## 4. Image URL Format

All optimized URLs use this pattern:
```
https://res.cloudinary.com/[CLOUD_NAME]/image/upload/w_500,q_auto,f_webp/v1/uploads/[FILE_NAME].jpg
```

Parameters:
- `w_500` = resize to 500px width
- `q_auto` = auto quality based on browser support
- `f_webp` = serve WebP format (fallback to JPG)

## 5. Responsive Images with srcset

Product images now automatically use:
- **Mobile** (≤600px): 300px width
- **Tablet** (≤900px): 400px width
- **Desktop** (>900px): 500px width
- **Format**: WebP with JPEG fallback
- **Lazy Loading**: Enabled for performance

## 6. Free Tier Limits

- **Storage**: 25 GB
- **Monthly transformations**: 25 GB
- **Unlimited uploads** (each month resets)
- After limit: pay-as-you-go starting ~$0.05/GB

## 7. Troubleshooting

### Upload Button Not Working
- Check Cloudinary credentials in `env.js`
- Ensure unsigned upload preset is created in Cloudinary dashboard
- Check browser console for errors

### Images Not Loading
- Verify Cloud Name is correct
- Check URL format includes optimization params
- Try URL directly in browser to test Cloudinary access

### Slow Uploads
- Images are being optimized (w_500, q_auto, f_webp) — this adds ~1-2s per image
- Batch uploader processes sequentially to avoid rate limits
- Free tier has some throttling

## 8. Integration with data.json

Once uploaded, copy URLs into `data.json`:

```json
{
  "id": 1,
  "name": "Golden Barrel",
  "price_cents": 2500,
  "image_url": "https://res.cloudinary.com/your_cloud/image/upload/w_500,q_auto,f_webp/v1/cactus-studio/image_name.jpg",
  "class": "Opuntia"
}
```

## 9. Next Steps

- Use responsive images dashboard in Cloudinary to monitor usage
- Set up automated backups if needed
- Consider adding watermarks or transformations for branding
- Monitor storage usage monthly

---

**Questions?** See Cloudinary docs: https://cloudinary.com/documentation
