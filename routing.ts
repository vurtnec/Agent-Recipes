import dedent from "dedent";
import assert from "node:assert";
import Together from "together-ai";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

const client = new Together();

const prompts = [
  "Produce python snippet to check to see if a number is prime or not.",
  "Plan and provide a short itenary for a 2 week vacation in Europe.",
  "Write a short story about a dragon and a knight.",
];

const modelRoutes = {
  "Qwen/Qwen2.5-Coder-32B-Instruct":
    "Best model choice for code generation tasks.",
  "Gryphe/MythoMax-L2-13b":
    "Best model choice for story-telling, role-playing and fantasy tasks.",
  "Qwen/QwQ-32B-Preview":
    "Best model for reasoning, planning and multi-step tasks",
};

const schema = z.object({
  route: z.enum(Object.keys(modelRoutes) as [keyof typeof modelRoutes]),
  reason: z.string(),
});
const jsonSchema = zodToJsonSchema(schema, {
  target: "openAi",
});

async function routerWorkflow(
  inputQuery: string,
  routes: { [key: string]: string },
) {
  const routerPrompt = dedent`
    Given a user prompt/query: ${inputQuery}, select the best option out of the following routes:

    ${Object.keys(routes)
      .map((key) => `${key}: ${routes[key]}`)
      .join("\n")}
    
    Answer only in JSON format.`;

  // Call LLM to select route
  const routeResponse = await client.chat.completions.create({
    messages: [
      { role: "system", content: routerPrompt },
      { role: "user", content: inputQuery },
    ],
    model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    response_format: {
      type: "json_object",
      schema: jsonSchema,
    },
  });

  const content = routeResponse.choices[0].message?.content;
  assert(typeof content === "string");
  const selectedRoute = schema.parse(JSON.parse(content));

  // Use LLM on selected route.
  // Could also have different prompts that need to be used for each route.
  const response = await client.chat.completions.create({
    messages: [{ role: "user", content: inputQuery }],
    model: selectedRoute.route,
  });
  const responseContent = response.choices[0].message?.content;
  console.log(`${responseContent}\n`);
}

async function main() {
  for (const prompt of prompts) {
    console.log(`Task ${prompts.indexOf(prompt) + 1}: ${prompt}`);
    console.log("====================");
    await routerWorkflow(prompt, modelRoutes);
  }
}

main();
