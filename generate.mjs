export default async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST.' }), { status: 405, headers: { 'content-type': 'application/json' } });
  const apiKey = Netlify.env.get('GEMINI_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'AI setup abhi complete nahi hai. Admin ko GEMINI_API_KEY set karni hogi.' }), { status: 500, headers: { 'content-type': 'application/json' } });
  try {
    const { topic, niche, lang, audience } = await req.json();
    if (!topic || !String(topic).trim()) return new Response(JSON.stringify({ error: 'Pehle video ka topic likho.' }), { status: 400, headers: { 'content-type': 'application/json' } });
    const prompt = `You are Creator Dost AI, a practical YouTube content strategist for creators. Create a useful content pack for this video topic: ${String(topic).slice(0, 600)}. Channel category: ${String(niche || 'Other').slice(0, 80)}. Output language/style: ${String(lang || 'Hinglish').slice(0, 40)}. Target audience: ${String(audience || 'General YouTube audience').slice(0, 160)}. Return ONLY valid JSON with these exact keys: titles (array of exactly 10 concise, distinct title ideas), thumbnail (array of exactly 6 thumbnail texts, 2-5 words each), description (one ready-to-use YouTube description with a natural CTA and 3-5 relevant hashtags; don't invent facts), hook (a compelling 2-3 sentence opening hook), ideas (array of exactly 5 related follow-up video ideas). Make it specific to the topic, avoid fake claims, misleading clickbait, and repeated generic templates. Use the requested language/style.`;
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.8 } })
    });
    const data = await resp.json();
    if (!resp.ok) return new Response(JSON.stringify({ error: data?.error?.message || 'AI service se response nahi mila. Thodi der baad try karo.' }), { status: 502, headers: { 'content-type': 'application/json' } });
    const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    let pack;
    try { pack = JSON.parse(raw); } catch { return new Response(JSON.stringify({ error: 'AI ka response samajh nahi aaya. Dobara try karo.' }), { status: 502, headers: { 'content-type': 'application/json' } }); }
    for (const key of ['titles','thumbnail','description','hook','ideas']) if (!(key in pack)) throw new Error('AI response incomplete');
    return new Response(JSON.stringify(pack), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Kuch gadbad hui. Topic check karke dobara try karo.' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
};
