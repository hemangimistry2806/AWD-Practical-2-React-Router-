const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 15000;

const generateTaskDescription = async (title) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("AI service is not configured");
    }

    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Write one concise, practical task description. Return only the description."
                },
                {
                    role: "user",
                    content: `Write a short description for this task: ${title}`
                }
            ],
            max_tokens: 120
        })
    });

    if (!response.ok) {
        throw new Error(`AI provider returned status ${response.status}`);
    }

    const result = await response.json();
    const description = result.choices?.[0]?.message?.content?.trim();
    if (typeof description !== "string" || !description) {
        throw new Error("AI provider returned an empty description");
    }

    return description.slice(0, 1000);
};

module.exports = { generateTaskDescription };
