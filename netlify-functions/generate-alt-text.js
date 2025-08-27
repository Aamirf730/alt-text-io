// Netlify Function for Alt-Text Generation
// File: netlify/functions/generate-alt-text.js

const { createClient } = require('@supabase/supabase-js');
const { validateApiKey, hasSufficientCredits, deductCredits, updateUserCredits } = require('./utils/api-key-validator');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Gemini AI integration
async function generateAltTextWithGemini(imageBase64, context = null) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    let prompt = "Generate a concise, SEO-friendly alt-text for this image. Focus on the main subject, actions, and important visual elements. Keep it under 120 characters to ensure it fits properly. Be specific but concise.";
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
    
    // Smart truncation to complete words and sentences
    if (altText.length > 125) {
      // Try to find a good breaking point
      let truncated = altText.substring(0, 125);
      
      // Look for sentence endings first (., !, ?)
      const sentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('!'),
        truncated.lastIndexOf('?')
      );
      
      if (sentenceEnd > 100) {
        // If we have a sentence ending, use it
        truncated = truncated.substring(0, sentenceEnd + 1);
      } else {
        // Otherwise, try to complete the word
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 100) {
          truncated = truncated.substring(0, lastSpace);
        }
      }
      
      return truncated;
    }
    
    return altText;
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
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' }),
      };
    }

    const apiKey = authHeader.replace('Bearer ', '');
    
    // Validate API key and get user info
    const user = await validateApiKey(apiKey);
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid API key' }),
      };
    }

    // Check if user has sufficient credits
    if (!hasSufficientCredits(user, 1)) {
      return {
        statusCode: 402,
        headers,
        body: JSON.stringify({ error: 'No credits remaining. Please upgrade your plan.' }),
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

    // Generate alt-text using Gemini
    const altText = await generateAltTextWithGemini(image_base64, context);

    // Deduct credit and update usage
    const updatedUser = deductCredits(user, 1);

    // Try to update credits in database
    await updateUserCredits(user.id, updatedUser.credits_remaining, updatedUser.total_processed);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        alt_text: altText,
        credits_used: 1,
        credits_remaining: updatedUser.credits_remaining,
        total_processed: updatedUser.total_processed
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