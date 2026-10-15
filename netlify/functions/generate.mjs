const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

const toList = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map(s => String(s).replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim()).filter(Boolean);

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405, { allow: 'POST' });
  // GEMINI_API_KEY is read server-side only. If you set your own key, requests go straight to Google;
  // otherwise Netlify AI Gateway provides GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL automatically.
  const apiKey = Netlify.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'AI setup abhi complete nahi hai. Admin ko GEMINI_API_KEY set karni hogi.' }, 500);
  const baseUrl = (Netlify.env.get('GOOGLE_GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  let input;
  try { input = await req.json(); } catch { return json({ error: 'Request samajh nahi aayi. Dobara try karo.' }, 400); }
  try {
    const { topic, niche, lang, audience } = input || {};
    if (!topic || !String(topic).trim()) return json({ error: 'Pehle video ka topic likho.' }, 400);
    const prompt = `You are Creator Dost AI, a practical YouTube content strategist for creators. Create a useful content pack for this video topic: ${String(topic).slice(0, 600)}. Channel category: ${String(niche || 'Other').slice(0, 80)}. Output language/style: ${String(lang || 'Hinglish').slice(0, 40)}. Target audience: ${String(audience || 'General YouTube audience').slice(0, 160)}. Return ONLY valid JSON with these exact keys: titles (array of exactly 10 concise, distinct title ideas), thumbnail (array of exactly 6 thumbnail texts, 2-5 words each), description (one ready-to-use YouTube description with a natural CTA and 3-5 relevant hashtags; don't invent facts), hook (a compelling 2-3 sentence opening hook), ideas (array of exactly 5 related follow-up video ideas). Make it specific to the topic, avoid fake claims, misleading clickbait, and repeated generic templates. Use the requested language/style.`;
    const resp = await fetch(`${baseUrl}/v1beta/models/gemini-2.5-flash:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.8 } })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error('Gemini error', resp.status, data?.error?.message);
      const msg = resp.status === 429 ? 'AI abhi busy hai (limit reach ho gayi). Thodi der baad try karo.' : 'AI service se response nahi mila. Thodi der baad try karo.';
      return json({ error: msg }, 502);
    }
    const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    let pack;
    try { pack = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')); } catch { return json({ error: 'AI ka response samajh nahi aaya. Dobara try karo.' }, 502); }
    for (const key of ['titles', 'thumbnail', 'description', 'hook', 'ideas']) if (!pack || !(key in pack)) return json({ error: 'AI ka response adhoora tha. Dobara try karo.' }, 502);
    return json({
      titles: toList(pack.titles),
      thumbnail: toList(pack.thumbnail),
      description: String(pack.description || '').trim(),
      hook: String(pack.hook || '').trim(),
      ideas: toList(pack.ideas)
    });
  } catch (err) {
    console.error('generate failed', err);
    return json({ error: 'Kuch gadbad hui. Topic check karke dobara try karo.' }, 500);
  }
};
