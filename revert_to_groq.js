const fs = require('fs');

function replaceInFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf-8');
    for (const [search, replace] of replacements) {
        content = content.replaceAll(search, replace);
    }
    fs.writeFileSync(path, content);
}

replaceInFile('background.js', [
    ['(Direct-to-OpenAI Unlimited)', '(Direct-to-Groq Unlimited)'],
    ["if (!apiKey.startsWith('sk-')) {", "if (!apiKey.startsWith('gsk_')) {"],
    ["return { error: 'Please set a valid OpenAI API Key in the settings.' };", "return { error: 'Please set a valid Groq API Key in the settings.' };"],
    ["https://api.openai.com/v1/chat/completions", "https://api.groq.com/openai/v1/chat/completions"],
    ["model: 'gpt-4o-mini',", "model: 'llama-3.3-70b-versatile',"],
    ["return { error: `OpenAI API Error: ${errText}` };", "return { error: `Groq API Error: ${errText}` };"],
    ["Direct to OpenAI Vision", "Direct to Groq Vision"],
    ["if (!apiKey.startsWith('sk-')) return { error: 'No OpenAI API Key provided.' };", "if (!apiKey.startsWith('gsk_')) return { error: 'No Groq API Key provided.' };"],
    ["model: 'gpt-4o',", "model: 'llama-3.2-90b-vision-preview',"]
]);

replaceInFile('popup.html', [
    ['OpenAI Analysis Preview', 'Groq Analysis Preview'],
    ['<!-- OPENAI API KEY -->', '<!-- GROQ API KEY -->'],
    ['OpenAI API Key', 'Groq API Key'],
    ['https://platform.openai.com/api-keys', 'https://console.groq.com/keys'],
    ['platform.openai.com/api-keys', 'console.groq.com/keys'],
    ['OpenAI for AI processing', 'Groq for AI processing'],
    ['placeholder="sk-..."', 'placeholder="gsk_..."']
]);

replaceInFile('popup.js', [
    ["if (!apiKey.startsWith('sk-')) {", "if (!apiKey.startsWith('gsk_')) {"],
    ["⚠ Please add your OpenAI API key in the Settings tab first.", "⚠ Please add your Groq API key in the Settings tab first."],
    ["if (key.startsWith('sk-')) {", "if (key.startsWith('gsk_')) {"]
]);

replaceInFile('content.js', [
    ["if (!profile.apiKey || !profile.apiKey.startsWith('sk-')) {", "if (!profile.apiKey || !profile.apiKey.startsWith('gsk_')) {"],
    ["⚠ Please add your OpenAI API key in the extension popup → Settings tab.", "⚠ Please add your Groq API key in the extension popup → Settings tab."],
    ["Missing or invalid OpenAI API key", "Missing or invalid Groq API key"]
]);

console.log('Reverted successfully!');
