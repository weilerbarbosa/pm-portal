import { skills } from "@/lib/skills/registry";
import { SkillCard } from "@/components/skill-card";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight">PM Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Self-service automation skills for Yalo Project Managers
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      </main>
    </div>
  );
}
