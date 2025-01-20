import assert from "node:assert";
import Together from "together-ai";

const client = new Together();

export async function runLLM(
  userPrompt: string,
  model: string,
  systemPrompt?: string,
) {
  const messages: { role: "system" | "user"; content: string }[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({ role: "user", content: userPrompt });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = response.choices[0].message?.content;
  assert(typeof content === "string");
  return content;
}
