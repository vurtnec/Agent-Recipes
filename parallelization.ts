import dedent from "dedent";
import { runLLM } from "./helpers";

/*
  Run a parallel chain of LLM calls to address the `inputQuery` 
  using a list of models specified in `proposerModels`.

  Returns output from final aggregator model.
*/
async function parallelWorkflow(
  inputQuery: string,
  proposerModels: string[],
  aggregatorModel: string,
  aggregatorSystemPrompt: string,
) {
  // Gather intermediate responses from proposer models
  const proposedResponses = await Promise.all(
    proposerModels.map((model) => runLLM(inputQuery, model)),
  );

  // Aggregate responses using an aggregator model
  const aggregatorSystemPromptWithResponses = dedent`
    ${aggregatorSystemPrompt}

    ${proposedResponses.map((response, i) => `${i + 1}. response`)}
  `;

  const finalOutput = await runLLM(
    inputQuery,
    aggregatorModel,
    aggregatorSystemPromptWithResponses,
  );

  return [finalOutput, proposedResponses];
}

const referenceModels = [
  "microsoft/WizardLM-2-8x22B",
  "Qwen/Qwen2.5-72B-Instruct-Turbo",
  "google/gemma-2-27b-it",
  "meta-llama/Llama-3.3-70B-Instruct-Turbo",
];

const userPrompt = dedent`
  Jenna and her mother picked some apples from their apple farm.
  Jenna picked half as many apples as her mom.
  
  If her mom got 20 apples, how many apples did they both pick?
`;

const aggregatorModel = "deepseek-ai/DeepSeek-V3";

const aggregatorSystemPrompt = dedent`
  You have been provided with a set of responses from various
  open-source models to the latest user query. Your task is to
  synthesize these responses into a single, high-quality response.
  It is crucial to critically evaluate the information provided in
  these responses, recognizing that some of it may be biased or incorrect.
  Your response should not simply replicate the given answers but
  should offer a refined, accurate, and comprehensive reply to the
  instruction. Ensure your response is well-structured, coherent, and
  adheres to the highest standards of accuracy and reliability.

  Responses from models:
`;

async function main() {
  const [answer, intermediateResponses] = await parallelWorkflow(
    userPrompt,
    referenceModels,
    aggregatorModel,
    aggregatorSystemPrompt,
  );
  for (const response of intermediateResponses) {
    console.log(
      `## Intermediate Response: ${intermediateResponses.indexOf(response) + 1}:\n`,
    );
    console.log(`${response}\n`);
  }
  console.log(`## Final Answer:`);
  console.log(`${answer}\n`);
}

main();