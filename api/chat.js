// /api/chat.js

const MODEL_MAP = {
  // Gemini
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
  "gemini-3-flash": "gemini-3-flash",
  "gemini-3.1-flash-lite": "gemini-3.1-flash-lite",

  // Gemma
  "gemma-4-26b": "gemma-4-26b",
  "gemma-4-31b": "gemma-4-31b",

  // Groq
  "llama-3.3-70b-versatile": "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant": "llama-3.1-8b-instant",
  "qwen-qwq-32b": "qwen-qwq-32b",
  "gpt-oss-120b": "openai/gpt-oss-120b",
  "gpt-oss-20b": "openai/gpt-oss-20b"
};

function isGroq(model) {
  return (
    model.includes("llama") ||
    model.includes("qwen") ||
    model.includes("gpt-oss")
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: {
        message: "Method not allowed"
      }
    });
  }

  try {
    const body = req.body || {};

    const requestedModel =
      body.model || "gemini-2.5-flash";

    const model =
      MODEL_MAP[requestedModel] || requestedModel;

    // -------------------------
    // GROQ
    // -------------------------

    if (isGroq(model)) {
      const groqKey = process.env.GROQ_API_KEY;

      if (!groqKey) {
        return res.status(500).json({
          error: {
            message: "Missing GROQ_API_KEY"
          }
        });
      }

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages: body.messages || [],
            temperature: body.temperature ?? 0.7,
            max_tokens: body.max_tokens
          })
        }
      );

      const data = await response.json();

      return res.status(response.status).json(data);
    }

    // -------------------------
    // GEMINI / GEMMA
    // -------------------------

    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return res.status(500).json({
        error: {
          message: "Missing GEMINI_API_KEY"
        }
      });
    }

    let payload = {
      ...body
    };

    delete payload.model;

    // Gemma doesn't support systemInstruction
    if (
      model.startsWith("gemma") &&
      payload.systemInstruction
    ) {
      const sys =
        payload.systemInstruction?.parts
          ?.map(p => p.text)
          .join("\n") || "";

      const contents = [...(payload.contents || [])];

      if (contents.length && contents[0].role === "user") {
        contents[0] = {
          role: "user",
          parts: [
            {
              text: sys + "\n\n"
            },
            ...(contents[0].parts || [])
          ]
        };
      }

      delete payload.systemInstruction;
      payload.contents = contents;
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({
      error: {
        message: err.message || "Unknown server error"
      }
    });
  }
}
