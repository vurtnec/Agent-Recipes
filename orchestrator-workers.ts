import dedent from "dedent";
import { z } from "zod";

import assert from "node:assert";
import Together from "together-ai";
import { Schema } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

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

export async function jsonLLM<T>(
  userPrompt: string,
  schema: Schema<T>,
  systemPrompt?: string,
) {
  const messages: { role: "system" | "user"; content: string }[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({ role: "user", content: userPrompt });

  const response = await client.chat.completions.create({
    model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    messages,
    response_format: {
      type: "json_object",
      schema: zodToJsonSchema(schema, {
        target: "openAi",
      }),
    },
  });


function ORCHESTRATOR_PROMPT(task: string) {
  return dedent`
    Analyze this task and break it down into 2-3 distinct approaches:

    Task: ${task}

    Provide an Analysis:

    Explain your understanding of the task and which variations would be valuable.
    Focus on how each approach serves different aspects of the task.

    Along with the analysis, provide 2-3 approaches to tackle the task, each with a brief description:

    Formal style: Write technically and precisely, focusing on detailed specifications
    Conversational style: Write in a friendly and engaging way that connects with the reader
    Hybrid style: Tell a story that includes technical details, combining emotional elements with specifications

    Return only JSON output.
  `;
}

function WORKER_PROMPT(
  originalTask: string,
  taskType: string,
  taskDescription: string,
) {
  return dedent`
    Generate content based on:
    Task: ${originalTask}
    Style: ${taskType}
    Guidelines: ${taskDescription}

    Return only your response:
    [Your content here, maintaining the specified style and fully addressing requirements.]
  `;
}

const taskListSchema = z.object({
  analysis: z.string(),
  tasks: z.array(
    z.object({
      type: z.enum(["formal", "conversational", "hybrid"]),
      description: z.string(),
    }),
  ),
});

/*
  Use an orchestrator model to break down a task into sub-tasks,
  then use worker models to generate and return responses.
*/
async function orchestratorWorkflow(
  originalTask: string,
  orchestratorPrompt: (task: string) => string,
  workerPrompt: (
    originalTask: string,
    taskType: string,
    taskDescription: string,
  ) => string,
) {
  // Use orchestrator model to break the task up into sub-tasks
  const { analysis, tasks } = await jsonLLM(
    orchestratorPrompt(originalTask),
    taskListSchema,
  );

  console.log(dedent`
    ## Analysis:
    ${analysis}

    ## Tasks:
  `);
  console.log("```json", JSON.stringify(tasks, null, 2), "\n```\n");

  const workerResponses = await Promise.all(
    tasks.map(async (task) => {
      const response = await runLLM(
        workerPrompt(originalTask, task.type, task.description),
        "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      );

      return { task, response };
    }),
  );

  return workerResponses;
}

async function main() {
  const task = `Write a product description for a new eco-friendly water bottle. 
    The target_audience is environmentally conscious millennials and key product
    features are: plastic-free, insulated, lifetime warranty
  `;

  const workerResponses = await orchestratorWorkflow(
    task,
    ORCHESTRATOR_PROMPT,
    WORKER_PROMPT,
  );

  console.log(
    workerResponses
      .map((w) => `## WORKER RESULT (${w.task.type})\n${w.response}`)
      .join("\n\n"),
  );
}

main();


