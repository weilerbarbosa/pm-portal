import { skills } from "@/lib/skills/registry";
import { notFound } from "next/navigation";
import { ExecutionChat } from "@/components/execution-chat";
import { SkillIcon } from "@/components/skill-icon";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function RunSkillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const skill = skills.find((s) => s.id === id);

  if (!skill) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Back
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                <SkillIcon
                  name={skill.icon}
                  className="h-4 w-4 text-zinc-700"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold">{skill.name}</h1>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    ~{skill.estimatedDuration}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {skill.requiredTools.join(" + ").toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-6 py-8">
        <ExecutionChat skill={skill} />
      </main>
    </div>
  );
}
