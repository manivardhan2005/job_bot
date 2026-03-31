// background.js – FormFill AI Agent (Direct-to-Groq Unlimited)

const STORAGE_KEY = 'formfill_profile';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getProfile') {
    chrome.storage.local.get([STORAGE_KEY, 'formfill_resume', 'formfill_resume_summary'], (r) => {
      sendResponse({ profile: r[STORAGE_KEY]||{}, resume: r['formfill_resume']||null, resumeSummary: r['formfill_resume_summary']||'' });
    });
    return true;
  }
  if (msg.action === 'captureScreenshot') {
    chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 60 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ screenshot: dataUrl });
      }
    });
    return true;
  }
  if (msg.action === 'identifyFieldsWithVision') {
    identifyFieldsWithVision(msg).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.action === 'agentAnalyzePage') {
    agentAnalyzePage(msg).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
});

// Full page analysis — hits Groq API DIRECTLY bypassing the extension server limits entirely.
async function agentAnalyzePage({ fields, localFillCount, pageContext, pageTitle, pageUrl, pageText, profile, resumeSummary }) {
  const apiKey = (profile?.apiKey || '').trim();
  if (!apiKey.startsWith('gsk_')) {
    return { error: 'Please set a valid Groq API Key in the settings.' };
  }

  try {
    const prompt = `You are an expert AI job application filler. Analyze the user's profile and the job description to fill out the form fields perfectly.
Be confident, highlight transferable skills, and never say you lack experience. Use a highly professional tone.
Job Context: ${pageTitle}\n${pageText}
User Profile: ${JSON.stringify(profile)}
Resume Summary: ${resumeSummary}
Fields to fill: ${JSON.stringify(fields)}

Respond strictly in JSON with this structure:
{
  "plan": {
    "pageType": "form",
    "fills": [
      { "index": field_index_number, "value": "best_answer", "fieldType": "subjective" }
    ]
  }
}
Only include fields that you have confident answers for. Do not wrap the JSON in Markdown.`;

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { error: `Groq API Error: ${errText}` };
    }

    const data = await resp.json();
    const content = data.choices[0].message.content;
    const result = JSON.parse(content);

    if (result.plan && result.plan.fills) {
      result.plan.fills = sanitizeNegativeFills(result.plan.fills);
    }
    return { plan: result.plan, tokenUsage: data.usage };

  } catch (e) {
    return { error: 'Request failed: ' + e.message };
  }
}

const NEGATIVE_PATTERNS = [
  /\bI don'?t have experience\b/i,
  /\bI have no experience\b/i,
  /\bI lack\b/i,
  /\bno experience\b/i,
  /\bunfortunately\b/i,
];

function sanitizeNegativeFills(fills) {
  return fills.map(fill => {
    if (!fill.value || typeof fill.value !== 'string' || fill.skip) return fill;
    let flagged = false;
    for (const pattern of NEGATIVE_PATTERNS) {
      if (pattern.test(fill.value)) { flagged = true; break; }
    }
    if (flagged) fill._negativityFlagged = true;
    return fill;
  });
}

// Vision-based field identification - Direct to Groq Vision
async function identifyFieldsWithVision({ screenshots, fields, profile }) {
  const apiKey = (profile?.apiKey || '').trim();
  if (!apiKey.startsWith('gsk_')) return { error: 'No Groq API Key provided.' };

  try {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: `Analyze these screenshots of a job form. The fields provided lack good metadata. Match the fields to the user profile JSON: ${JSON.stringify(profile)}. Return JSON with array of { "fills": [{ "index": id, "value": "matched_value" }] } only for factual fields you are certain about.` }
        ]
      }
    ];

    if (screenshots && screenshots.length) {
      for (const b64 of screenshots) {
        messages[0].content.push({ type: "image_url", image_url: { url: b64 } });
      }
    }

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.2-90b-vision-preview',
        messages: messages,
        response_format: { type: 'json_object' }
      })
    });

    if (!resp.ok) return { error: `Vision API Error: ${await resp.text()}` };
    
    const data = await resp.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return { localFills: parsed.fills || [] };
  } catch (e) {
    return { error: 'Vision request failed: ' + e.message };
  }
}
