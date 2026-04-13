export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const { jobType, salary } = JSON.parse(event.body);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        tools: [{ type: 'web_search_20260209', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Search for ${jobType} jobs paying ${salary} in High Wycombe and Buckinghamshire, UK.

Find at least 6 real current job listings. Return a JSON array only:
[{"title":"...","company":"...","salary":"...","location":"...","description":"...","url":"..."}]

Only jobs within 15 miles of High Wycombe, salary £33k-£47k, posted in 2025 or 2026.
Return ONLY the JSON array, no other text.`
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || 'API error' })
      };
    }

    let text = '';
    for (const block of data.content || []) {
      if (block.type === 'text') text += block.text;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Server error' })
    };
  }
}
