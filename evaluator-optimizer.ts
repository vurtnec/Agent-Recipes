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
      // @ts-expect-error Expected error
      schema: zodToJsonSchema(schema, {
        target: "openAi",
      }),
    },
  });

  const content = response.choices[0].message?.content;
  assert(typeof content === "string");

  return schema.parse(JSON.parse(content));
}


const task = dedent`
  Implement a Stack with:

    1. push(x)
    2. pop()
    3. getMin()

  All operations should be O(1).
`;

const GENERATOR_PROMPT = dedent`
  Your goal is to complete the task based on <user input>. If there is feedback 
  from your previous generations, you should reflect on them to improve your solution.

  Output your answer concisely in the following format: 

  Thoughts:
  [Your understanding of the task and feedback and how you plan to improve]

  Response:
  [Your code implementation here]
`;

/*
  Generate and improve a solution based on feedback.
*/
async function generate(task: string, generatorPrompt: string, context = "") {
  const fullPrompt = dedent`
    ${generatorPrompt}

    Task: ${task}

    ${context}
  `;

  const response = await runLLM(fullPrompt, "Qwen/Qwen2.5-Coder-32B-Instruct");
  console.log(dedent`
    ## Generation start

    ${response}
    \n
  `);

  return response;
}

const EVALUATOR_PROMPT = dedent`
  Evaluate this following code implementation for:

    1. code correctness
    2. time complexity
    3. style and best practices

  You should be evaluating only and not attempting to solve the task.

  Only output "PASS" if all criteria are met and you have no further suggestions for improvements.

  Provide detailed feedback if there are areas that need improvement. You should specify what needs improvement and why. Make sure to only use a single line without newlines for the feedback.

  Only output JSON.
`;

/*
  Evaluate if a solution meets the requirements.
*/
async function evaluate(
  task: string,
  evaluatorPrompt: string,
  generatedContent: string,
) {
  const fullPrompt = dedent`
    ${evaluatorPrompt}

    Original task: ${task}

    Content to evaluate: ${generatedContent}
  `;

  const schema = z.object({
    evaluation: z.enum(["PASS", "NEEDS_IMPROVEMENT", "FAIL"]),
    feedback: z.string(),
  });
  const { evaluation, feedback } = await jsonLLM(fullPrompt, schema);

  console.log(dedent`
    ## Evaluation start

    Status: ${evaluation}

    Feedback: ${feedback}
    \n
  `);

  return { evaluation, feedback };
}

/*
  Keep generating and evaluating until the evaluator passes the last generated response.
*/
async function loopWorkflow(
  task: string,
  evaluatorPrompt: string,
  generatorPrompt: string,
) {
  // Store previous responses from generator
  const memory = [];

  // Generate initial response
  let response = await generate(task, generatorPrompt);
  memory.push(response);

  while (true) {
    const { evaluation, feedback } = await evaluate(
      task,
      evaluatorPrompt,
      response,
    );

    if (evaluation === "PASS") {
      break;
    }

    const context = dedent`
      Previous attempts:

      ${memory.map((m, i) => `### Attempt ${i + 1}\n\n${m}`).join("\n\n")}

      Feedback: ${feedback}
    `;

    response = await generate(task, generatorPrompt, context);
    memory.push(response);
  }
}

loopWorkflow(task, EVALUATOR_PROMPT, GENERATOR_PROMPT);
