import {
  extractLetterFromDocument,
  ExtractionRequest,
  formatGeminiError,
} from '../../server/geminiExtractor';

export const handler = async (event: {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string>;
}) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'POST',
      },
      body: JSON.stringify({
        success: false,
        error: 'Metode tidak diizinkan. Gunakan POST.',
      }),
    };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Bad request: request body kosong.',
        }),
      };
    }

    const payload: ExtractionRequest = JSON.parse(event.body);

    if (!payload.fileBase64 || !payload.mimeType) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Bad request: fileBase64 dan mimeType diperlukan.',
        }),
      };
    }

    const result = await extractLetterFromDocument(payload);

    return {
      statusCode: result.success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    console.error('Netlify function error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: formatGeminiError(err),
      }),
    };
  }
};
