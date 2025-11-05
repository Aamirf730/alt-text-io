// Netlify Function for Alt-Text Generation with Supabase Auth
// File: netlify/functions/generate-alt-text.js

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Gemini AI integration
async function generateAltTextWithGemini(imageBase64, context = null) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let prompt = "Generate a concise, SEO-friendly alt-text for this image. Focus on the main subject, actions, and important visual elements. Keep it under 125 characters.";
    if (context) {
      prompt += ` Context: ${context}`;
    }

    const imageParts = [
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/png"
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    let altText = response.text().trim().replace(/"/g, '').replace("Alt-text:", "").trim();
    
    return altText.length > 125 ? altText.substring(0, 125) : altText;
  } catch (error) {
    console.error('Gemini API error:', error);
    return "Image description unavailable";
  }
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get authorization token
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' }),
      };
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify user with Supabase Auth using the access token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    // Parse request body
    const { image_base64, context } = JSON.parse(event.body);
    if (!image_base64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'image_base64 is required' }),
      };
    }

    // Check user credits from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_remaining, subscription_plan, total_processed')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User profile not found' }),
      };
    }

    if (!profile || profile.credits_remaining <= 0) {
      return {
        statusCode: 402,
        headers,
        body: JSON.stringify({ error: 'No credits remaining. Please upgrade your plan.' }),
      };
    }

    // Generate alt-text using Gemini
    console.log(`Generating alt-text for user ${user.id}`);
    const altText = await generateAltTextWithGemini(image_base64, context);

    // Use credit and log usage (using the database function)
    const { data: result, error: creditError } = await supabase
      .rpc('use_credit', {
        user_uuid: user.id,
        alt_text: altText,
        context: context || null
      });

    if (creditError) {
      console.error('Credit usage error:', creditError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update credits' }),
      };
    }

    // Log successful generation
    console.log(`Alt-text generated successfully for user ${user.id}: "${altText}"`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        alt_text: altText,
        credits_used: result.credits_used,
        credits_remaining: result.credits_remaining
      }),
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
