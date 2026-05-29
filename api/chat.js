// Vercel / Node serverless function — deploy this alongside index.html.
// IMPORTANT: This is server-side code. It is NOT executed by the static-site
// preview here; you must deploy it to a platform that runs Node functions
// (Vercel, Netlify Functions, etc.) and set the GEMINI_API_KEY env var.
//
// The frontend now sends a "model" field. We pick the right upstream endpoint:
//   - Gemini models  -> v1beta/models/{model}:generateContent
//   - Gemma models   -> v1beta/models/{model}:generateContent  (same shape)
//
// NOTE: model ids like "gemma-4-26b", "gemini-3.1-flash-lite", "gemini-3-flash"
// must match real model names available on your API key/tier. If Google's
// catalog name differs, map them in MODEL_MAP below.

const MODEL_MAP = {
  "gemini-2.5-flash":      "gemini-2.5-flash",
  "gemini-3-flash":        "gemini-3-flash",        // adjust if catalog name differs
  "gemini-3.1-flash-lite": "gemini-3.1-flash-lite", // adjust if catalog name differs
  "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
  "gemma-4-26b":           "gemma-4-26b",           // adjust to real Gemma id
  "gemma-4-31b":           "gemma-4-31b"            // adjust to real Gemma id
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { model: requestedModel, ...rest } = req.body || {};
    const model = MODEL_MAP[requestedModel] || requestedModel || 'gemini-2.5-flash';

    // Gemma models do not support systemInstruction the same way Gemini does.
    // If targeting Gemma and a systemInstruction is present, fold it into the
    // first user message instead.
    let payload = rest;
    if (model.startsWith('gemma') && payload.systemInstruction) {
      const sysText = payload.systemInstruction?.parts?.map(p => p.text).join('\n') || '';
      const contents = Array.isArray(payload.contents) ? [...payload.contents] : [];
      if (sysText && contents[0]?.role === 'user') {
        contents[0] = {
          role: 'user',
          parts: [{ text: sysText + '\n\n' }, ...(contents[0].parts || [])]
        };
      }
      const { systemInstruction, ...noSys } = payload;
      payload = { ...noSys, contents };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    // Pass through the upstream status so the frontend can show real errors.
    res.status(response.status).json(data);

  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}
