/* eslint-disable */
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const apiKey = env.split('GROQ_API_KEY=')[1].split('\n')[0].trim();

async function testModel(model) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } }
          ]
        }
      ]
    })
  });
  if (!r.ok) {
    console.log(model, "ERROR", r.status, await r.text());
  } else {
    console.log(model, "SUCCESS", await r.json());
  }
}

async function run() {
  await testModel('meta-llama/llama-4-scout-17b-16e-instruct');
  await testModel('qwen/qwen3.6-27b');
}

run();
