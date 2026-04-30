const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

interface AIMessage {
role: "user" | "model";
parts: { text: string }[];
}

export async function callGemini(messages: AIMessage[], systemInstruction?: string): Promise<string> {
// Try DeepSeek first if available
if (process.env.DEEPSEEK_API_KEY) {
try {
return await callDeepSeek(messages, systemInstruction);
} catch (err: any) {
console.warn("[AI] DeepSeek failed, falling back to Gemini:", err.message);
}
}

// Fallback to Gemini
return await callGeminiOriginal(messages, systemInstruction);
}

async function callDeepSeek(messages: AIMessage[], systemInstruction?: string): Promise<string> {
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) throw new Error("DEEPSEEK_API_KEY non configurée");

// Convert Gemini-style messages to OpenAI-style
const openaiMessages: { role: string; content: string }[] = [];
if (systemInstruction) {
openaiMessages.push({ role: "system", content: systemInstruction });
}
messages.forEach((m) => {
openaiMessages.push({
role: m.role === "model" ? "assistant" : "user",
content: m.parts.map((p) => p.text).join("\n"),
});
});

const response = await fetch(DEEPSEEK_API_URL, {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: "Bearer " + apiKey,
},
body: JSON.stringify({
model: "deepseek-chat",
messages: openaiMessages,
temperature: 0.7,
max_tokens: 2048,
response_format: { type: "json_object" },
}),
});

if (!response.ok) {
const errText = await response.text();
console.error("[DeepSeek] API error", response.status, errText);
throw new Error("Erreur API DeepSeek : " + response.status);
}

const data = await response.json();
const text = data?.choices?.[0]?.message?.content;
if (!text) throw new Error("Réponse DeepSeek vide");
return text;
}

async function callGeminiOriginal(messages: AIMessage[], systemInstruction?: string): Promise<string> {
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY non configurée");

const body: any = {
contents: messages,
generationConfig: {
temperature: 0.7,
topP: 0.95,
maxOutputTokens: 2048,
responseMimeType: "application/json",
},
};

if (systemInstruction) {
body.systemInstruction = { parts: [{ text: systemInstruction }] };
}

const response = await fetch(GEMINI_API_URL + "?key=" + apiKey, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(body),
});

if (!response.ok) {
const errText = await response.text();
console.error("[Gemini] API error", response.status, errText);
if (response.status === 429) {
throw new Error("Limite API atteinte, réessayez dans quelques secondes");
}
throw new Error("Erreur API Gemini : " + response.status);
}

const data = await response.json();
const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
if (!text) throw new Error("Réponse Gemini vide");
return text;
}