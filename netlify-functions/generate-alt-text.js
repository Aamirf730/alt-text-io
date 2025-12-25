// Netlify Function for Alt-Text Generation
// File: netlify/functions/generate-alt-text.js

const { createClient } = require('@supabase/supabase-js');
const { validateApiKey, updateUserCredits } = require('./utils/api-key-validator');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to detect image MIME type from base64
function detectImageMimeType(imageBase64) {
  // Check base64 prefix to determine image type
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
    // Default to PNG if uncertain
    return 'image/png';
  }
}

// Core AI integration
async function generateAltTextWithGemini(imageBase64, context = null) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Detect the actual image MIME type
    const mimeType = detectImageMimeType(imageBase64);
    console.log('Detected image MIME type:', mimeType);

    // Ultra-strict prompt - MUST output single sentence only
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

    const imageParts = [
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType // Use detected MIME type, not hardcoded PNG
        }
      }
    ];

    // Use strict generationConfig to prevent formatting
    const generationConfig = {
      temperature: 0.2, // Lower temperature for more focused responses
      maxOutputTokens: 120, // Strict limit - just enough for alt-text
      topP: 0.7, // Narrow probability mass
      topK: 20, // Limit token choices
    };

    // Get model with config
    const modelWithConfig = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: generationConfig
    });

    const result = await modelWithConfig.generateContent([prompt, ...imageParts]);

    const response = await result.response;

    // Check for blocked content or safety issues before getting text
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      console.error('AI Service: No candidates in response');
      console.error('Response object:', JSON.stringify(response, null, 2));
      throw new Error('AI service returned no candidates. The response may have been blocked by safety filters.');
    }

    // Check for finish reason (safety blocks, etc.)
    const finishReason = candidates[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.error('AI Service: Finish reason:', finishReason);
      if (finishReason === 'SAFETY') {
        throw new Error('AI Service blocked the response due to safety filters. The image may contain content that violates safety policies.');
      } else if (finishReason === 'MAX_TOKENS') {
        throw new Error('AI Service response was cut off due to token limit.');
      } else if (finishReason === 'RECITATION') {
        throw new Error('AI Service blocked the response due to recitation policy.');
      } else {
        throw new Error(`AI Service returned unexpected finish reason: ${finishReason}`);
      }
    }

    // Check for safety ratings
    const safetyRatings = candidates[0]?.safetyRatings;
    if (safetyRatings && safetyRatings.length > 0) {
      const blockedCategories = safetyRatings.filter(r => r.probability === 'HIGH' || r.probability === 'MEDIUM').map(r => r.category);
      if (blockedCategories.length > 0) {
        console.error('AI Service: Safety ratings blocked:', blockedCategories);
        throw new Error(`AI Service blocked the response due to safety concerns: ${blockedCategories.join(', ')}`);
      }
    }

    // Try to get text from response
    let altText;
    try {
      altText = response.text().trim();
    } catch (textError) {
      console.error('AI Service: Error calling response.text():', textError);
      console.error('Response candidates:', JSON.stringify(candidates, null, 2));
      throw new Error(`AI Service response.text() failed: ${textError.message}. The response may have been blocked or invalid.`);
    }

    console.log('Raw AI response:', altText ? altText.substring(0, 200) : '(empty)'); // Debug log

    // Validate that we got a response
    if (!altText || altText.length === 0) {
      console.error('AI Service: Empty text response');
      console.error('Response candidates:', JSON.stringify(candidates, null, 2));
      console.error('Finish reason:', finishReason);
      console.error('Safety ratings:', JSON.stringify(safetyRatings, null, 2));
      throw new Error('AI service returned empty response. This may be due to safety filters, the model refusing to generate content, or an issue with the image data.');
    }

    // STEP 1: Aggressively remove ALL unwanted introductory sections
    altText = altText
      .replace(/Here are.*?alt-text:?\s*/gi, '')
      .replace(/Here are.*?options?:?\s*/gi, '')
      .replace(/Here are.*?few.*?options?:?\s*/gi, '')
      .replace(/Here are.*?optimized.*?keywords?:?\s*/gi, '')
      .replace(/Here's.*?options?:?\s*/gi, '')
      .replace(/^.*?Here are.*?:\s*/gi, '')  // Match entire line up to colon
      .replace(/^.*?few.*?options?:?\s*/gi, '')
      .trim();

    // If still starts with unwanted patterns, extract first line that doesn't
    if (altText.toLowerCase().includes('here are') || altText.toLowerCase().includes('few options')) {
      const lines = altText.split('\n');
      for (const line of lines) {
        const cleaned = line.trim();
        if (cleaned.length > 10 &&
          !cleaned.toLowerCase().includes('here are') &&
          !cleaned.toLowerCase().includes('few options') &&
          !cleaned.toLowerCase().includes('option 1') &&
          !cleaned.match(/^\*\s*/)) {
          altText = cleaned;
          break;
        }
      }
    }

    // STEP 2: Extract description from "Option 1:" pattern - HANDLE MULTIPLE OPTIONS
    // Pattern examples:
    // "*   **Option 1:** Pink floral dress with bow, girls formal wear."
    // "*   **Option 2:** Cute pink flower"

    let extracted = false;  // Track if we successfully extracted

    // First, try to extract "Option 1:" specifically - stop before Option 2
    // Pattern 1: "*   **Option 1:** Description" (capture description, stop at Option 2 or newline)
    const option1Pattern1 = /\*\s+\*\*Option\s+1:?\*\*\s*([^*\n]+?)(?:\n|\*\s+\*\*Option\s+2|\*   \*\*Option\s+2|$)/i;
    const match1 = altText.match(option1Pattern1);

    if (match1 && match1[1]) {
      let result = match1[1]
        .replace(/\*\*/g, '')                    // Remove bold
        .replace(/\*/g, '')                      // Remove all asterisks
        .replace(/Option\s+\d+:?\s*/gi, '')     // Remove any "Option X:" patterns
        .replace(/^[:–—\s]*/, '')                // Remove leading colon/dash/space
        .trim();

      // Validate it's actual descriptive text
      if (result.length > 10 &&
        !result.toLowerCase().match(/^(here are|here's|options?|option\s+\d+|few|alt-text)/i)) {
        altText = result;
        extracted = true;
      }
    }

    // Pattern 2: If first pattern didn't work, try simpler version
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

        if (result.length > 10 &&
          !result.toLowerCase().match(/^(here are|options?|option\s+\d+)/i)) {
          altText = result;
          extracted = true;
        }
      }
    }

    // Pattern 3: Multi-line pattern - extract first description before Option 2
    if (!extracted && altText.includes('Option 1') && altText.includes('Option 2')) {
      const parts = altText.split(/Option\s+2/i);
      if (parts[0]) {
        // Extract from the part before Option 2
        const beforeOption2 = parts[0];
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

    // If Option 1 pattern didn't work, try extracting from first bullet point
    if (!extracted) {
      // Match first bullet: "*   **text**" or "*   text"
      const firstBulletPattern = /\*\s+\*\*([^*\n]+?)\*\*(?:\n|\*\s+\*\*Option|$)/i;  // "*   **text**"
      const firstBulletMatch = altText.match(firstBulletPattern);

      if (firstBulletMatch && firstBulletMatch[1]) {
        let result = firstBulletMatch[1]
          .replace(/Option\s+\d+:?\s*/gi, '')  // Remove "Option 1:" if embedded
          .replace(/^[:–—\s]*/, '')
          .trim();

        if (result.length > 10 && !result.toLowerCase().match(/^(here are|options?|option\s+\d+)/i)) {
          altText = result;
          extracted = true;
        }
      }

      // Last resort: extract first meaningful line after removing "Here are"
      if (!extracted) {
        const lines = altText.split(/\n/);
        for (const line of lines) {
          // Skip "Here are" lines
          if (line.toLowerCase().match(/^(here are|here's|few options)/i)) continue;

          // Extract from bullet line
          let cleaned = line
            .replace(/^\*\s+/, '')              // Remove bullet marker
            .replace(/\*\*/g, '')                // Remove bold
            .replace(/\*/g, '')                  // Remove asterisks
            .replace(/Option\s+\d+:?\s*/gi, '') // Remove "Option 1:"
            .replace(/^[:–—\s]*/, '')           // Remove leading punctuation
            .trim();

          if (cleaned.length > 15 &&
            !cleaned.toLowerCase().match(/^(here are|options?|option\s+\d+|few)/i) &&
            cleaned.match(/^[A-Z]/)) {  // Starts with capital letter
            altText = cleaned;
            extracted = true;
            break;
          }
        }
      }
    }

    // STEP 2b: If still contains unwanted patterns, extract first real sentence
    if (altText.toLowerCase().includes('option') || altText.match(/^\*\s+/)) {
      // Split by lines and find first line that's an actual description
      const lines = altText.split(/\n/);
      for (const line of lines) {
        let cleaned = line
          .replace(/^\*\s+/, '')        // Remove bullet
          .replace(/\*\*/g, '')         // Remove bold
          .replace(/Option\s+\d+:?\s*/gi, '')  // Remove "Option 1:"
          .replace(/^[:–—]\s*/, '')     // Remove leading punctuation
          .trim();

        // Check if this is actual descriptive text (not intro)
        if (cleaned.length > 15 &&
          !cleaned.toLowerCase().match(/^(here are|here's|options?|option\s+\d+|alt-text|few)/i) &&
          cleaned.match(/^[A-Z]/)) {  // Starts with capital
          altText = cleaned;
          break;
        }
      }
    }

    // STEP 3: ULTRA-AGGRESSIVE cleanup - remove ALL formatting
    altText = altText
      // Remove ALL markdown formatting first
      .replace(/\*\*/g, '')      // Remove all ** (bold markers)
      .replace(/\*/g, '')        // Remove ALL asterisks (including bullets)
      .replace(/#{1,6}\s*/g, '') // Remove headers
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`/g, '')         // Remove inline code
      .replace(/>\s*/g, '')      // Remove blockquotes
      .replace(/---+/g, '')      // Remove horizontal rules
      .replace(/\[|\]|\{|\}/g, '') // Remove brackets
      // Remove ALL unwanted prefixes (very comprehensive list)
      .replace(/^(Here are|Here's|Here\s+are|Here\s+are\s+a\s+few|Options?|Option\s+\d+|Alt-text:?|Description:?|Image description:?|Focus on|SEO|optimized|Gossip:?|few\s+options?:?)\s*/gi, '')
      .replace(/^(\*\*|#|>|\*|-|•|\d+\.)\s*/gm, '') // Remove any markdown/numbering at start
      .replace(/\s*(Option|Focus|Here|few)\s+/gi, ' ') // Remove these words anywhere
      // Remove quotes
      .replace(/^["']|["']$/g, '')
      .replace(/["']/g, '')
      // Clean up whitespace
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // STEP 3b: Remove "Option 1:" patterns if still present
    altText = altText
      .replace(/^Option\s+\d+:?\s*/gi, '')
      .replace(/\s+Option\s+\d+:?\s*/gi, ' ')  // Remove if in middle too
      .replace(/^\d+\.\s*/, '')
      .replace(/^:\s*/, '')
      .trim();

    // Extract actual description from formatted responses
    // Try multiple patterns to extract the real alt-text

    // Pattern 1: Extract text after "Option 1 (Focus on...):" or similar
    const optionPatterns = [
      /Option\s+\d+\s*\([^)]*\)\s*[:\-]\s*(.+?)(?:\n|$|Option\s+\d+)/is,
      /Option\s+\d+\s*[:\-]\s*(.+?)(?:\n|$|Option\s+\d+|$)/is,
      /^\d+\.\s*(.+?)(?:\n|$)/i,
      />\s*(.+?)(?:\n|$|Option|Here)/i,  // Extract text after > (blockquote markdown)
      /:\s*(.+?)(?:\n|$|Option|Here)/i,   // Extract text after first colon
    ];

    for (const pattern of optionPatterns) {
      const match = altText.match(pattern);
      if (match && match[1]) {
        let extracted = match[1]
          .replace(/\*\*|#|>|```|`/g, '')
          .replace(/\([^)]*\)/g, '') // Remove parenthetical notes
          .trim();
        if (extracted.length > 5 && !extracted.toLowerCase().includes('focus') && !extracted.toLowerCase().includes('option')) {
          altText = extracted;
          break;
        }
      }
    }

    // If we still have unwanted patterns, try to find the first line that doesn't contain keywords
    if (altText.toLowerCase().includes('option') || altText.toLowerCase().includes('here are') || altText.toLowerCase().includes('focus')) {
      const lines = altText.split('\n');
      for (const line of lines) {
        const cleaned = line
          .replace(/\*\*|#|>|```|`|Option|Focus|Here/gi, '')
          .replace(/\([^)]*\)/g, '')
          .trim();
        if (cleaned.length > 10 &&
          !cleaned.toLowerCase().includes('option') &&
          !cleaned.toLowerCase().includes('focus') &&
          !cleaned.toLowerCase().includes('here') &&
          !cleaned.toLowerCase().includes('seo')) {
          altText = cleaned;
          break;
        }
      }
    }

    // If still contains "Focus on" or other explanatory text, extract the actual description
    const focusMatch = altText.match(/(?:focus\s+on|description|alt-text):\s*(.+)/i);
    if (focusMatch && focusMatch[1]) {
      altText = focusMatch[1].trim();
    }

    // Extract text from bullet points or lists (already handled above, but keep as fallback)
    const listMatch = altText.match(/^[-•*]\s*\*\*?(.+?)\*\*?(?:\n|$)/m) ||
      altText.match(/^[-•*]\s*(.+?)(?:\n|$)/m);
    if (listMatch && listMatch[1]) {
      altText = listMatch[1]
        .replace(/\*\*/g, '')
        .trim();
    }

    // Final cleanup: If the text still contains unwanted patterns, extract clean parts
    if (altText.includes('Here are') || altText.includes('Here\'s') || altText.toLowerCase().includes('options') || altText.toLowerCase().includes('option')) {
      // Split by common unwanted patterns
      const unwantedPatterns = /Here are|Here's|Option\s+\d+|options?|Focus on|SEO keywords/i;
      const cleanParts = altText.split(unwantedPatterns);

      // Find the first substantial descriptive text
      for (const part of cleanParts) {
        let cleaned = part
          .replace(/\*\*|#|>|```|`|\[|\]|\{|\}/g, '')  // Remove all markdown
          .replace(/^\s*[:\-\(\)]\s*/g, '')  // Remove leading punctuation
          .replace(/^\s*\([^)]*\)\s*/g, '')  // Remove parenthetical notes
          .replace(/\s{2,}/g, ' ')  // Normalize spaces
          .trim();

        // Check if this part is actual descriptive text
        if (cleaned.length > 10 &&
          !cleaned.toLowerCase().includes('focus') &&
          !cleaned.toLowerCase().includes('option') &&
          !cleaned.toLowerCase().includes('here') &&
          !cleaned.toLowerCase().includes('optimized') &&
          !cleaned.toLowerCase().includes('seo')) {
          altText = cleaned;
          break;
        }
      }

      // If still contains unwanted patterns, try to extract text after first colon or dash
      if (altText.includes('Here are') || altText.includes('Option')) {
        const colonMatch = altText.match(/[:\-]\s*(.+?)(?:\n|$|Option|Here)/i);
        if (colonMatch && colonMatch[1]) {
          altText = colonMatch[1].replace(/\*\*|#|>|```/g, '').trim();
        }
      }
    }

    // FINAL SAFETY CHECK: If text still contains unwanted patterns, extract only meaningful content
    const unwantedKeywords = ['here are', 'option', 'focus on', 'seo', 'optimized', 'keywords'];
    const hasUnwantedKeywords = unwantedKeywords.some(keyword =>
      altText.toLowerCase().includes(keyword)
    );

    if (hasUnwantedKeywords || altText.includes('Here are') || altText.includes('Option')) {
      // Try to extract the first actual descriptive sentence
      // Split by common separators and find first meaningful part
      const parts = altText.split(/[:\n\-]|Option\s+\d+|Here are|Here's/i);

      for (const part of parts) {
        let cleaned = part
          .replace(/\*\*|#|>|```|`|\[|\]|\{|\}|\([^)]*\)/g, '')
          .replace(/^\s*[:\-\(\)]\s*/g, '')
          .trim();

        // Check if this is actual descriptive text
        if (cleaned.length > 15 &&
          !unwantedKeywords.some(k => cleaned.toLowerCase().includes(k)) &&
          !cleaned.match(/^\d+\.?\s*$/)) { // Not just a number
          altText = cleaned;
          break;
        }
      }

      // If still bad, try extracting after the first colon or dash
      if (hasUnwantedKeywords) {
        const match = altText.match(/[:\-]\s*([^*#>\n]{20,})/i);
        if (match && match[1]) {
          altText = match[1].trim();
        }
      }
    }

    // If the text is still too complex, take the first sentence or meaningful phrase
    if (altText.length > 150 || altText.includes('Here are') || altText.includes('Option')) {
      // Split by sentence and take the first substantial one
      const sentences = altText.split(/[.!?]+/).filter(s =>
        s.trim().length > 10 &&
        !unwantedKeywords.some(k => s.toLowerCase().includes(k))
      );
      if (sentences.length > 0) {
        altText = sentences[0].trim();
      } else {
        // Fallback: take first meaningful words (skip common intro words)
        const words = altText.split(/\s+/).filter(w =>
          w.length > 0 &&
          !['here', 'are', 'options', 'option', 'for', 'the', 'image', 'focus', 'on', 'seo', 'optimized'].includes(w.toLowerCase())
        );
        altText = words.slice(0, 20).join(' ').trim() || altText.substring(0, 120).trim();
      }
    }

    // ULTIMATE FALLBACK: If we still have unwanted text, extract first real sentence
    const finalUnwantedKeywords = ['here are', 'option', 'few options', 'options'];
    if (finalUnwantedKeywords.some(k => altText.toLowerCase().includes(k))) {
      // Split by sentences and find first one that's clean
      const sentences = altText.split(/[.!?]+/).filter(s => {
        const cleaned = s.trim();
        return cleaned.length > 15 &&
          !finalUnwantedKeywords.some(k => cleaned.toLowerCase().includes(k)) &&
          !cleaned.match(/^\d+\.?\s*$/) &&  // Not just a number
          cleaned.match(/^[A-Z]/);  // Starts with capital
      });

      if (sentences.length > 0) {
        altText = sentences[0].trim() + '.';
      } else {
        // Last resort: extract words after removing unwanted patterns
        const words = altText.split(/\s+/).filter(w =>
          w.length > 2 &&
          !finalUnwantedKeywords.some(k => w.toLowerCase().includes(k)) &&
          !w.match(/^\d+$/)  // Not just a number
        );
        if (words.length > 5) {
          altText = words.join(' ').trim();
        }
      }
    }

    // FINAL VALIDATION: If output still contains unwanted patterns, log and extract
    if (altText.toLowerCase().includes('here are') ||
      altText.toLowerCase().includes('option') ||
      altText.match(/^\*\s+/)) {
      console.warn('⚠️ Still contains unwanted patterns after cleanup:', altText.substring(0, 100));
      // Force extract: take everything after first colon or after first real word
      const colonIndex = altText.indexOf(':');
      if (colonIndex > 0 && colonIndex < altText.length - 10) {
        altText = altText.substring(colonIndex + 1)
          .replace(/Option\s+\d+:?\s*/gi, '')
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .trim();
      }
    }

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

      altText = truncated;
    }

    // Final validation - ensure alt-text is not empty after all processing
    altText = altText.trim();
    if (!altText || altText.length === 0) {
      throw new Error('Generated alt-text is empty after processing');
    }

    // Ensure minimum length (at least 10 characters)
    if (altText.length < 10) {
      throw new Error(`Generated alt-text is too short: "${altText}"`);
    }

    return altText;
  } catch (error) {
    console.error('AI Service error:', error);

    // Extract error message from AI Service
    let errorMessage = "Failed to generate alt-text";
    if (error.message) {
      errorMessage = error.message;
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    // Check for specific AI Service errors
    if (errorMessage.includes('leaked') || errorMessage.includes('reported')) {
      throw new Error('Your AI API key was reported as leaked. Please generate a new API key and update it in Netlify environment variables.');
    }

    // Throw error so it can be properly handled by the main handler
    throw new Error(`AI service error: ${errorMessage}`);
  }
}

exports.handler = async (event, context) => {
  // Get secure CORS headers (origin-validated)
  const headers = getCorsHeaders(event.headers, ['POST', 'OPTIONS']);

  // Handle preflight OPTIONS request
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  // Rate limiting (60 requests per minute for main API)
  const clientIp = getClientIp(event);
  const rateLimit = checkRateLimit(clientIp, 60);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  if (event.httpMethod !== 'POST') {
    return methodNotAllowedResponse(headers);
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

    const token = authHeader.replace('Bearer ', '');

    let user = null;
    let creditsRemaining = 0;

    // Check if token is a Supabase auth token or API key (accepts both altai_ and alt_ formats)
    if (token.startsWith('altai_') || token.startsWith('alt_')) {
      // API key authentication
      user = await validateApiKey(token);
      if (!user) {
        console.error('API key validation failed for:', token.substring(0, 20) + '...');
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid or expired token' }),
        };
      }
      creditsRemaining = user.credits_remaining;
      console.log('API key validated successfully. User:', user.email, 'Credits:', creditsRemaining);
    } else {
      // Supabase auth token authentication
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authUser) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Invalid or expired token' }),
          };
        }

        // Get user profile from profiles table
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('credits_remaining, subscription_plan, total_processed, id, email')
          .eq('id', authUser.id)
          .single();

        if (profileError || !profile) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User profile not found. Please contact support.' }),
          };
        }

        user = {
          id: profile.id,
          email: profile.email || authUser.email,
          credits_remaining: profile.credits_remaining || 0,
          total_processed: profile.total_processed || 0,
          plan: profile.subscription_plan || 'free_trial'
        };
        creditsRemaining = profile.credits_remaining || 0;
      } catch (authErr) {
        console.error('Auth error:', authErr);
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Authentication failed' }),
        };
      }
    }

    // Check if user has sufficient credits
    console.log('Credit check - User:', user?.email, 'Credits remaining:', creditsRemaining);
    if (!user || creditsRemaining <= 0) {
      console.error('Credit check FAILED - User:', user?.email, 'Credits:', creditsRemaining);
      return {
        statusCode: 402,
        headers,
        body: JSON.stringify({ error: 'No credits remaining. Please upgrade your plan.' }),
      };
    }
    console.log('Credit check PASSED - Proceeding with alt-text generation');

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    const { image_base64, context } = requestBody;
    if (!image_base64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'image_base64 is required' }),
      };
    }

    // Validate base64 data size (Gemini API limit is ~20MB for base64)
    // Base64 increases size by ~33%, so ~15MB raw = ~20MB base64
    const base64SizeBytes = Buffer.byteLength(image_base64, 'utf8');
    const maxBase64Size = 20 * 1024 * 1024; // 20MB

    if (base64SizeBytes > maxBase64Size) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: `Image data is too large (${Math.round(base64SizeBytes / 1024 / 1024)}MB). Maximum size is 20MB.`
        }),
      };
    }

    // Validate base64 format (basic check)
    if (!/^[A-Za-z0-9+/=]+$/.test(image_base64)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid base64 image data format' }),
      };
    }

    // CRITICAL: Re-check credits RIGHT BEFORE generation to prevent race conditions
    // This ensures we don't generate alt-text if credits were exhausted by another request
    let finalCreditCheck;
    if (token.startsWith('altai_') || token.startsWith('alt_')) {
      // API key method - re-validate user
      const recheckUser = await validateApiKey(token);
      if (!recheckUser || recheckUser.credits_remaining <= 0) {
        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({ error: 'No credits remaining. Please upgrade your plan.' }),
        };
      }
      finalCreditCheck = recheckUser.credits_remaining;
    } else {
      // Supabase auth - re-check credits from database
      const { data: recheckProfile, error: recheckError } = await supabase
        .from('profiles')
        .select('credits_remaining')
        .eq('id', user.id)
        .single();

      if (recheckError || !recheckProfile || (recheckProfile.credits_remaining || 0) <= 0) {
        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({ error: 'No credits remaining. Please upgrade your plan.' }),
        };
      }
      finalCreditCheck = recheckProfile.credits_remaining;
    }

    console.log('Pre-generation credit check - Credits remaining:', finalCreditCheck);

    // Generate alt-text using AI with retry logic
    let altText;
    let lastError;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        altText = await generateAltTextWithGemini(image_base64, context);

        // Validate alt-text is not empty
        if (!altText || altText.trim().length === 0) {
          throw new Error('Generated alt-text is empty');
        }

        // Success - break out of retry loop
        break;
      } catch (aiError) {
        lastError = aiError;

        // Don't retry on certain errors (auth, invalid input, etc.)
        const errorMessage = aiError.message || '';
        if (errorMessage.includes('API key') ||
          errorMessage.includes('invalid') ||
          errorMessage.includes('leaked') ||
          errorMessage.includes('reported') ||
          attempt === maxRetries) {
          // Return error immediately for non-retryable errors or last attempt
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              success: false,
              error: aiError.message || 'Failed to generate alt-text',
              message: aiError.message || 'Failed to generate alt-text'
            }),
          };
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // If we get here and altText is still empty, return error
    if (!altText || altText.trim().length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: lastError?.message || 'Failed to generate alt-text',
          message: lastError?.message || 'Failed to generate alt-text'
        }),
      };
    }

    // Deduct credit and update usage in profiles table (single source of truth)
    // Uses unified updateUserCredits function for both API key and Supabase auth users
    const creditUpdateResult = await updateUserCredits(user.id, 1, altText, context || null);

    if (!creditUpdateResult.success) {
      console.error('Failed to update credits:', creditUpdateResult.error);

      // Check if it's a "no credits" error
      if (creditUpdateResult.error &&
        (creditUpdateResult.error.toLowerCase().includes('insufficient') ||
          creditUpdateResult.error.toLowerCase().includes('no credits'))) {
        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({ error: 'No credits remaining. Please upgrade your plan.' }),
        };
      }

      // For other errors, return 500
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to process credit deduction. Please try again.' }),
      };
    }

    const newCreditsRemaining = creditUpdateResult.credits_remaining;
    const newTotalProcessed = creditUpdateResult.total_processed;

    console.log('✅ Credit deducted successfully:', {
      user: user.email,
      credits_remaining: newCreditsRemaining,
      total_processed: newTotalProcessed
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        alt_text: altText,
        credits_used: 1,
        credits_remaining: newCreditsRemaining,
        total_processed: newTotalProcessed
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