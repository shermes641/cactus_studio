import { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD;
    const uploadPreset = process.env.CLOUDINARY_PRESET;

    if (!cloudName || !uploadPreset) {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Cloudinary configuration missing. Please set CLOUDINARY_CLOUD and CLOUDINARY_PRESET environment variables.' 
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cloudName,
        uploadPreset
      })
    };
  } catch (error) {
    console.error('Error getting Cloudinary config:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to get Cloudinary configuration',
        details: error instanceof Error ? error.message : String(error)
      })
    };
  }
};
