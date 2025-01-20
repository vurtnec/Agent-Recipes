import assert from "node:assert";
import Together from "together-ai";

const client = new Together();

export async function runLLM(userPrompt: string, model: string) {
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = response.choices[0].message?.content;
  assert(typeof content === "string");
  return content;
}
/*
  Run a serial chain of LLM calls to address the `inputQuery` 
  using a list of prompts specified in `promptChain`.
*/
async function serialChainWorkflow(inputQuery: string, promptChain: string[]) {
  const responseChain: string[] = [];
  let response = inputQuery;

  for (const prompt of promptChain) {
    console.log(`Step ${promptChain.indexOf(prompt) + 1}`);

    response = await runLLM(
      `${prompt}\nInput:\n${response}`,
      "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    );
    console.log(`${response}\n`);
    responseChain.push(response);
  }

  return responseChain;
}

const question =
  "Sally earns $12 an hour for babysitting. Yesterday, she just did 50 minutes of babysitting. How much did she earn?";

const promptChain = [
  "Given the math problem, ONLY extract any relevant numerical information and how it can be used.",
  "Given the numberical information extracted, ONLY express the steps you would take to solve the problem.",
  "Given the steps, express the final answer to the problem.",
];

async function main() {
  await serialChainWorkflow(question, promptChain);
}

main();