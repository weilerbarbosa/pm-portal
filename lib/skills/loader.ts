import fs from "fs";
import path from "path";

const DEFINITIONS_DIR = path.join(
  process.cwd(),
  "lib/skills/definitions"
);

export function loadSkillPrompt(skillId: string): string {
  const filePath = path.join(DEFINITIONS_DIR, `${skillId}.md`);
  const content = fs.readFileSync(filePath, "utf-8");

  // Strip YAML frontmatter
  const stripped = content.replace(/^---[\s\S]*?---\n*/, "");
  return stripped;
}

export function loadSkillReferences(skillId: string): string {
  const refsDir = path.join(DEFINITIONS_DIR, "references", skillId);
  if (!fs.existsSync(refsDir)) return "";

  const files = fs.readdirSync(refsDir).filter((f) => f.endsWith(".md"));
  const parts: string[] = [];

  for (const file of files) {
    if (file === "SKILL_backup.md") continue;
    const content = fs.readFileSync(path.join(refsDir, file), "utf-8");
    parts.push(`\n\n--- Reference: ${file} ---\n\n${content}`);
  }

  return parts.join("");
}

export interface UserConfig {
  jiraAccountId: string;
  jiraCloudId: string;
  displayName: string;
  sfUserId: string;
  hourlyRate: number;
}

const DEFAULT_CONFIG: UserConfig = {
  jiraAccountId: "712020:7745fbc3-d130-433f-8d04-8db407c9f1ab",
  jiraCloudId: "e00406a0-58b2-420b-91c5-399d29821b17",
  displayName: "Weiler Barbosa",
  sfUserId: "005Ns000002Lc5xIAC",
  hourlyRate: 125,
};

export function buildSystemPrompt(
  skillId: string,
  userConfig?: Partial<UserConfig>
): string {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  let prompt = loadSkillPrompt(skillId);
  const refs = loadSkillReferences(skillId);

  if (refs) {
    prompt += refs;
  }

  // Config injection — replace hardcoded values with user's config
  // (For MVP, these match the defaults, but this enables per-user config later)
  prompt = prompt
    .replace(
      /712020:7745fbc3-d130-433f-8d04-8db407c9f1ab/g,
      config.jiraAccountId
    )
    .replace(
      /e00406a0-58b2-420b-91c5-399d29821b17/g,
      config.jiraCloudId
    );

  return prompt;
}
