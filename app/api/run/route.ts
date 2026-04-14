import { streamText, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildSystemPrompt } from "@/lib/skills/loader";
import { getToolsForSkill } from "@/lib/tools";
import { getSkill } from "@/lib/skills/registry";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages, skillId } = await req.json();

  const skill = getSkill(skillId);
  if (!skill) {
    return new Response(`Skill not found: ${skillId}`, { status: 404 });
  }

  const systemPrompt = buildSystemPrompt(skillId);
  const tools = getToolsForSkill(skillId);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(50),
  });

  return result.toUIMessageStreamResponse();
}
