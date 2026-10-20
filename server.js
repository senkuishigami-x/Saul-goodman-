import express from 'express';
import cors from 'cors';

const app = express();

app.disable('x-powered-by');

app.use(express.json({
  limit: '20kb'
}));

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || ''
)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.length === 0 ||
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed'));
  },

  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Health check.
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'subaru-api'
  });
});

// AI chat endpoint.
app.post('/api/chat', async (req, res) => {
  const message =
    typeof req.body?.message === 'string'
      ? req.body.message.trim()
      : '';

  if (!message) {
    return res.status(400).json({
      error: 'Message is required.'
    });
  }

  if (message.length > 5000) {
    return res.status(413).json({
      error: 'Message is too long.'
    });
  }

  // These values must be configured on the server.
  const apiKey = process.env.AI_API_KEY;

  const apiUrl =
    process.env.AI_API_URL ||
    'https://api.openai.com/v1/chat/completions';

  const model =
    process.env.AI_MODEL ||
    'gpt-4o-mini';

  if (!apiKey) {
    return res.status(503).json({
      error: 'AI_API_KEY is not configured on the server.'
    });
  }

  try {
    const upstream = await fetch(apiUrl, {
      method: 'POST',

      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        model,

        messages: [
          {
            role: 'system',

            content: `
You are SUBARU, the user's personal AI assistant.

PERSONALITY:
Be intelligent, natural, conversational, clear, and helpful.
Avoid robotic language and repetitive disclaimers.
Think through complicated questions carefully.
Ask focused questions when important information is missing.
Explain uncertainty honestly.

REASONING:
Break complicated problems into manageable parts.
Compare options, constraints, benefits, and risks.
Offer practical next steps.
Adapt your response to the user's actual request.

ACTIONS:
You do not have external tools in this version.
Never claim you executed an action that you did not execute.
Never claim to have accessed the user's device or private information.
Ask for appropriate approval before consequential actions.

IDENTITY:
Your name is SUBARU.
You are a personal assistant, not merely a task-list application.
            `.trim()
          },

          {
            role: 'user',
            content: message
          }
        ],

        temperature: 0.7
      })
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      console.error(
        'AI provider error:',
        upstream.status,
        JSON.stringify(data).slice(0, 1000)
      );

      return res.status(502).json({
        error:
          data?.error?.message ||
          `AI provider returned HTTP ${upstream.status}.`
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content;

    if (typeof reply !== 'string' || !reply.trim()) {
      return res.status(502).json({
        error: 'AI provider returned no text.'
      });
    }

    return res.json({
      reply: reply.trim()
    });

  } catch (error) {
    console.error(
      'Chat request failed:',
      error.message
    );

    return res.status(502).json({
      error: 'Could not reach the AI provider.'
    });
  }
});

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`SUBARU API listening on port ${port}`);
});
