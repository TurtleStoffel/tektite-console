import OpenAI from "openai";

const PROMPT_SUMMARY_RESPONSE_SCHEMA = {
    name: "worktree_prompt_summary",
    strict: true,
    schema: {
        type: "object",
        properties: {
            summary: {
                type: "string",
                description: "A short summary of the task prompt in 6-12 words, plain text only.",
                minLength: 6,
                maxLength: 120,
            },
        },
        required: ["summary"],
        additionalProperties: false,
    },
} as const;

type PromptSummaryResult = {
    summary: string;
};

function createLmStudioClient() {
    const baseURL = process.env.LMSTUDIO_BASE_URL?.trim() || "http://127.0.0.1:1234/v1";
    const apiKey = process.env.LMSTUDIO_API_KEY?.trim() || "lm-studio";
    return new OpenAI({ baseURL, apiKey });
}

function getLmStudioModel() {
    const model = process.env.LMSTUDIO_MODEL?.trim();
    if (!model) {
        throw new Error("LMSTUDIO_MODEL must be set to a loaded LM Studio model identifier.");
    }
    return model;
}

export async function summarizeWorktreePromptWithLmStudio(prompt: string): Promise<string> {
    const client = createLmStudioClient();
    const model = getLmStudioModel();

    const completion = await client.chat.completions.create({
        model,
        messages: [
            {
                role: "system",
                content: "Summarize prompts for worktree naming. Keep output concise and factual.",
            },
            {
                role: "user",
                content: `Summarize this coding prompt:\n\n${prompt}`,
            },
        ],
        response_format: {
            type: "json_schema",
            json_schema: PROMPT_SUMMARY_RESPONSE_SCHEMA,
        },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
        throw new Error("LM Studio returned an empty structured response.");
    }
    const parsed = JSON.parse(content) as Partial<PromptSummaryResult>;
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    if (!summary) {
        throw new Error("LM Studio response did not include a valid summary.");
    }

    console.info("[lmstudio] generated prompt summary", {
        summary,
        model,
    });
    return summary;
}
