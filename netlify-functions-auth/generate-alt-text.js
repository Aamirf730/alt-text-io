// Netlify Function for Alt-Text Generation with Supabase Auth
// File: netlify/functions/generate-alt-text.js

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to detect image MIME type from base64
function detectImageMimeType(imageBase64) {
  const prefix = imageBase64.substring(0, 30);

  if (prefix.startsWith('/9j/') || prefix.startsWith('/9j4AAQ')) {
    return 'image/jpeg';
  } else if (prefix.startsWith('iVBORw0KGgo')) {
    return 'image/png';
  } else if (prefix.startsWith('UklGR')) {
    return 'image/webp';
  } else if (prefix.startsWith('R0lGOD')) {
    return 'image/gif';
  } else {
    return 'image/png';
  }
}

function isPlaceholderAltText(text) {
  if (!text || typeof text !== 'string') {
    return true;
  }

  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '');

  if (!normalized) {
    return true;
  }

  const placeholders = [
    'image description unavailable',
    'alt text unavailable',
    'description unavailable',
    'no description available',
    'alt text not available'
  ];

  return placeholders.some(placeholder => normalized === placeholder || normalized.includes(placeholder));
}

function createGeminiError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Gemini AI integration
async function generateAltTextWithGemini(imageBase64, context = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createGeminiError('GEMINI_API_KEY is not configured', 500);
  }

  const mimeType = detectImageMimeType(imageBase64);
  console.log('Detected image MIME type:', mimeType);

  let prompt = `Generate an alt-text description for this image. You must output ONLY one sentence with no formatting.

CRITICAL: Your response must be EXACTLY like these examples (copy this format):
Business team collaborating around conference table in modern office with laptops and documents.
Fresh organic vegetables and fruits colorfully arranged at farmers market.
Snow-capped mountain peaks reflecting in pristine alpine lake during golden hour.

DO NOT output:
- "Here are a few options:"
- "* Option 1:" or "* Option 2:"
- Any asterisks, bullets, or markdown
- Any introductory text
- Multiple sentences or options

OUTPUT FORMAT REQUIREMENTS:
- Start immediately with the description
- Plain text only, no symbols
- One complete sentence
- Under 120 characters
- End with a period
- Describe what you actually see in the image

Now write ONE sentence describing this image (no formatting, no options, just the description):`;

  if (context) {
    prompt += `\n\nContext about the image: ${context}`;
  }

  const generationConfigCamel = {
    temperature: 0.2,
    maxOutputTokens: 120,
    topP: 0.7,
    topK: 20
  };

  const generationConfigSnake = {
    temperature: generationConfigCamel.temperature,
    max_output_tokens: generationConfigCamel.maxOutputTokens,
    top_p: generationConfigCamel.topP,
    top_k: generationConfigCamel.topK
  };

  const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_SEXUAL', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_DANGEROUS', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
  ];

  const modelId = process.env.GEMINI_MODEL || 'models/gemini-1.5-flash-latest';
  const apiBase = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
  const url = `${apiBase}/${modelId}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inline_data: {
              data: imageBase64,
              mime_type: mimeType
            }
          }
        ]
      }
    ],
    generationConfig: generationConfigCamel,
    generation_config: generationConfigSnake,
    safetySettings,
    safety_settings: safetySettings
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = payload?.error?.message || `Gemini API request failed with status ${response.status}`;
    throw createGeminiError(errorMessage);
  }

  const candidate = payload?.candidates?.[0];
  if (!candidate) {
    throw createGeminiError('Gemini API returned no candidate response');
  }

  const parts = candidate.content?.parts || [];
  let altText = parts
    .filter(part => typeof part.text === 'string')
    .map(part => part.text.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!altText) {
    throw createGeminiError('Gemini API returned an empty response');
  }

  console.log('Raw Gemini response (auth function):', altText.substring(0, 200));

  altText = altText
    .replace(/Here are.*?alt-text:?\s*/gi, '')
    .replace(/Here are.*?options?:?\s*/gi, '')
    .replace(/Here are.*?few.*?options?:?\s*/gi, '')
    .replace(/Here are.*?optimized.*?keywords?:?\s*/gi, '')
    .replace(/Here's.*?options?:?\s*/gi, '')
    .replace(/^.*?Here are.*?:\s*/gi, '')
    .replace(/^.*?few.*?options?:?\s*/gi, '')
    .trim();

  if (altText.toLowerCase().includes('here are') || altText.toLowerCase().includes('few options')) {
    const lines = altText.split('\n');
    for (const line of lines) {
      const cleaned = line.trim();
      if (
        cleaned.length > 10 &&
        !cleaned.toLowerCase().includes('here are') &&
        !cleaned.toLowerCase().includes('few options') &&
        !cleaned.toLowerCase().includes('option 1') &&
        !cleaned.match(/^\*\s*/)
      ) {
        altText = cleaned;
        break;
      }
    }
  }

  let extracted = false;

  const option1Pattern1 = /\*\s+\*\*Option\s+1:?\*\*\s*([^*\n]+?)(?:\n|\*\s+\*\*Option\s+2|\*   \*\*Option\s+2|$)/i;
  const match1 = altText.match(option1Pattern1);

  if (match1 && match1[1]) {
    let result = match1[1]
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/Option\s+\d+:?\s*/gi, '')
      .replace(/^[:–—\s]*/, '')
      .trim();

    if (
      result.length > 10 &&
      !result.toLowerCase().match(/^(here are|here's|options?|option\s+\d+|few|alt-text)/i)
    ) {
      altText = result;
      extracted = true;
    }
  }

  if (!extracted) {
    const option1Pattern2 = /\*\s+\*\*Option\s+1:?\*\*\s*([^*]+?)(?:\*\s+\*\*Option\s+2|$)/i;
    const match2 = altText.match(option1Pattern2);

    if (match2 && match2[1]) {
      let result = match2[1]
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/Option\s+\d+:?\s*/gi, '')
        .replace(/^[:–—\s]*/, '')
        .trim();

      if (
        result.length > 10 &&
        !result.toLowerCase().match(/^(here are|options?|option\s+\d+)/i)
      ) {
        altText = result;
        extracted = true;
      }
    }
  }

  if (!extracted && altText.includes('Option 1') && altText.includes('Option 2')) {
    const partsSplit = altText.split(/Option\s+2/i);
    if (partsSplit[0]) {
      const beforeOption2 = partsSplit[0];
      const option1Match = beforeOption2.match(/Option\s+1:?\s*\*?\*?\s*([^*\n]+)/i);
      if (option1Match && option1Match[1]) {
        let result = option1Match[1]
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/^[:–—\s]*/, '')
          .trim();

        if (result.length > 10) {
          altText = result;
          extracted = true;
        }
      }
    }
  }

  if (!extracted) {
    const bulletPattern = /\*\s*(?:\*\*)?(?!Option\s+\d)([^*\n]+?)(?:\n|$)/i;
    const bulletMatch = altText.match(bulletPattern);
    if (bulletMatch && bulletMatch[1]) {
      let result = bulletMatch[1]
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^[:–—\s]*/, '')
        .trim();

      if (
        result.length > 10 &&
        !result.toLowerCase().match(/^(here are|options?|option\s+\d+)/i)
      ) {
        altText = result;
        extracted = true;
      }
    }
  }

  if (!extracted) {
    const colonIndex = altText.indexOf(':');
    if (colonIndex > 0 && colonIndex < altText.length - 10) {
      altText = altText
        .substring(colonIndex + 1)
        .replace(/Option\s+\d+:?\s*/gi, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim();
    }
  }

  if (isPlaceholderAltText(altText)) {
    throw createGeminiError('Gemini API returned placeholder text');
  }

  if (altText.length > 125) {
    let truncated = altText.substring(0, 125);
    const sentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );

    if (sentenceEnd > 100) {
      truncated = truncated.substring(0, sentenceEnd + 1);
    } else {
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 100) {
        truncated = truncated.substring(0, lastSpace);
      }
    }

    return truncated;
  }

  return altText;
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
      statusCode: error.statusCode || 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};
