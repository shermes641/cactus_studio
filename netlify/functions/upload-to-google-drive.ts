import { Handler } from "@netlify/functions";
import { google } from "googleapis";
import busboy from "busboy";
import { Readable } from "stream";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const {
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY,
      GOOGLE_DRIVE_CACTUS_ID,
      GOOGLE_DRIVE_RECEIPTS_ID
    } = process.env;

    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_DRIVE_CACTUS_ID || !GOOGLE_DRIVE_RECEIPTS_ID) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing Google Drive configuration" })
      };
    }

    // Parse multipart form data
    const { file, filename, mimeType, folderType } = await parseMultipartForm(event);

    if (!file || !filename) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing file or filename" })
      };
    }

    // Determine which folder to use (default to cactus)
    const folderId = folderType === 'receipts' 
      ? GOOGLE_DRIVE_RECEIPTS_ID 
      : GOOGLE_DRIVE_CACTUS_ID;

    // Initialize Google Auth
    // Handle private key - it might need different formatting
    let privateKey = GOOGLE_PRIVATE_KEY;
    
    // If the key doesn't have newlines, add them back
    if (!privateKey.includes('\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // Ensure proper key format
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Invalid private key format" })
      };
    }

    const auth = new google.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/drive"]
    });

    const drive = google.drive({ version: "v3", auth });

    // Convert buffer to stream
    const fileStream = Readable.from(file);

    // Upload file to Shared Drive
    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType: mimeType || "application/octet-stream",
        body: fileStream,
      },
      fields: "id, name, webViewLink, webContentLink",
      supportsAllDrives: true,  // Required for Shared Drives
    });

    const fileId = response.data.id;

    // Make the file publicly accessible
    await drive.permissions.create({
      fileId: fileId!,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });

    // Return direct download link instead
    const directLink = `https://drive.google.com/uc?export=download&id=${fileId}`;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        ...response.data,
        webViewLink: directLink, // Override with direct link
        directLink: directLink
      }),
    };
  } catch (error: any) {
    console.error("Google Drive upload error:", error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        error: "Upload failed",
        details: error.message
      })
    };
  }
};

function parseMultipartForm(event: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    
    const bb = busboy({ headers: { 'content-type': contentType } });
    
    let fileBuffer: Buffer;
    let filename: string;
    let mimeType: string;
    let folderType = 'cactus';

    bb.on('file', (fieldname, file, info) => {
      const { filename: fname, mimeType: mime } = info;
      filename = fname;
      mimeType = mime;
      
      const chunks: Buffer[] = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on('field', (fieldname, value) => {
      if (fieldname === 'filename') filename = value;
      if (fieldname === 'mimeType') mimeType = value;
      if (fieldname === 'folderType') folderType = value;
    });

    bb.on('finish', () => {
      resolve({
        file: fileBuffer,
        filename,
        mimeType,
        folderType
      });
    });

    bb.on('error', (error) => {
      reject(error);
    });

    // Netlify provides the body as base64 encoded string
    const body = event.isBase64Encoded 
      ? Buffer.from(event.body, 'base64') 
      : event.body;
    
    bb.write(body);
    bb.end();
  });
}
