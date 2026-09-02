import { createOpenAI } from "@ai-sdk/openai";

/**
 * Lovable AI Gateway provider (Responses API) for the in-app AI Studio agent.
 * Server-only: LOVABLE_API_KEY must never reach the browser.
 */
export function createStudioModel(apiKey: string) {
  const lovable = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
  return lovable.responses("openai/gpt-5.6-sol");
}
