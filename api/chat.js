// AI Tutor API — Vercel serverless function (Node runtime)
// Provider chain: local LLM (your own hardware, off until LOCAL_LLM_URL is set)
//              -> Google Gemini (free tier)
//              -> OpenRouter free model (fallback)
// Retrieval: lightweight keyword-overlap scoring over the course knowledge base
// (kb/knowledge-base.json), built from the DBNov2026 course material.

const kb = require('./kb/knowledge-base.json');

const SYSTEM_PROMPT = `You are the AI Tutor for "CCAR-P x Databricks" — a course covering:
1) Building RAG Agents with Agent Bricks
2) Building Agentic Applications on Databricks
3) Agent Evaluation on Databricks
4) Deploy and Monitor (production agent deployment & observability)

Answer using the provided COURSE CONTEXT first. If the context does not cover the
question, say so plainly, then answer from general knowledge of Databricks /
agentic AI concepts. Keep answers concise, concrete, and cite which module/lecture
a fact came from when the context supplies one. Use plain text with short
paragraphs or a short list; avoid filler.`;

const STOP = new Set('the a an of for and to in on with is are this that your you we will how what why when it its as be can or at by from into'.split(' '));

function tokenize(s) {
  return (s.toLowerCase().match(/[a-z][a-z0-9\-]{2,}/g) || []).filter(w => !STOP.has(w));
}

// Build an inverted doc-frequency table once per cold start.
const docTokens = kb.chunks.map(c => tokenize(c.heading + ' ' + c.text));
const df = new Map();
docTokens.forEach(tokens => {
  new Set(tokens).forEach(t => df.set(t, (df.get(t) || 0) + 1));
});
const N = kb.chunks.length;

function scoreQuery(queryTokens) {
  const qSet = new Set(queryTokens);
  return docTokens.map((tokens, i) => {
    let score = 0;
    const tf = new Map();
    tokens.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
    qSet.forEach(qt => {
      if (tf.has(qt)) {
        const idf = Math.log((N + 1) / ((df.get(qt) || 1)));
        score += (1 + Math.log(tf.get(qt))) * idf;
      }
    });
    return { i, score };
  });
}

function retrieve(query, topK = 6) {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const scored = scoreQuery(qTokens).filter(s => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => kb.chunks[s.i]);
}

function buildContext(chunks) {
  if (chunks.length === 0) return '(No closely matching course material found for this question.)';
  return chunks.map(c =>
    `### ${c.module} — ${c.lecture} (${c.heading})\n${c.text}`
  ).join('\n\n---\n\n');
}

// ---- Provider chain ----

async function tryLocalLLM(messages) {
  const url = process.env.LOCAL_LLM_URL; // e.g. https://your-tunnel.example.com/v1/chat/completions
  if (!url) return null;
  const model = process.env.LOCAL_LLM_MODEL || 'llama3';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(process.env.LOCAL_LLM_KEY ? { Authorization: `Bearer ${process.env.LOCAL_LLM_KEY}` } : {}) },
    body: JSON.stringify({ model, messages, temperature: 0.3, stream: false }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`local LLM ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('local LLM: empty response');
  return { text, provider: `local (${model})` };
}

async function tryGemini(messages) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const system = messages.find(m => m.role === 'system')?.content || '';
  const turns = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  if (!text) throw new Error('gemini: empty response');
  return { text, provider: `gemini (${model})` };
}

async function tryOpenRouterFree(messages) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('openrouter: empty response');
  return { text, provider: `openrouter (${model})` };
}

const PROVIDERS = [tryLocalLLM, tryGemini, tryOpenRouterFree];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST with { "message": "...", "history": [...] }' });
    return;
  }
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Missing "message" string in request body.' });
      return;
    }

    const chunks = retrieve(message, 6);
    const context = buildContext(chunks);

    const messages = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nCOURSE CONTEXT:\n${context}` },
      ...((Array.isArray(history) ? history : []).slice(-8)),
      { role: 'user', content: message },
    ];

    const errors = [];
    for (const provider of PROVIDERS) {
      try {
        const result = await provider(messages);
        if (result) {
          res.status(200).json({
            reply: result.text,
            provider: result.provider,
            sources: chunks.map(c => ({ module: c.module, lecture: c.lecture, heading: c.heading })),
          });
          return;
        }
      } catch (e) {
        errors.push(String(e && e.message || e));
      }
    }

    res.status(503).json({
      error: 'No AI provider is configured or reachable yet.',
      hint: 'Add GEMINI_API_KEY (free tier) in Vercel project settings, or set LOCAL_LLM_URL once your local model is reachable from the internet, or OPENROUTER_API_KEY for a free fallback model.',
      details: errors,
      sources: chunks.map(c => ({ module: c.module, lecture: c.lecture, heading: c.heading })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
