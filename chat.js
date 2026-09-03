// Vercel Serverless Function
// Key API disimpan di Environment Variables Vercel (SAL_API_KEY), BUKAN di kode.
// Browser cuma manggil endpoint ini ("/api/chat"), bukan langsung ke api.anthropic.com,
// jadi key-nya ga pernah kekirim/keliatan ke sisi client.

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { prompt, system } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Field "prompt" wajib diisi' });
        return;
    }

    const apiKey = process.env.SAL_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'SAL_API_KEY belum di-set di Environment Variables Vercel' });
        return;
    }

    try {
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-5',
                max_tokens: 2000,
                system: system || '',
                messages: [{ role: 'user', content: prompt }]
            })
        });

        const data = await anthropicRes.json();

        if (!anthropicRes.ok) {
            const msg = (data && data.error && data.error.message) || ('HTTP ' + anthropicRes.status);
            res.status(anthropicRes.status).json({ error: msg });
            return;
        }

        const textBlock = (data.content || []).find((b) => b.type === 'text');
        res.status(200).json({ reply: textBlock ? textBlock.text : '' });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Gagal menghubungi Claude API' });
    }
};
