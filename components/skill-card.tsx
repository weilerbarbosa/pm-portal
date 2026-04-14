"use client";

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SkillDefinition } from "@/lib/skills/registry";
import { SkillIcon } from "@/components/skill-icon";

const categoryColors: Record<string, string> = {
  automation: "bg-blue-100 text-blue-800",
  sync: "bg-green-100 text-green-800",
  report: "bg-purple-100 text-purple-800",
  analysis: "bg-amber-100 text-amber-800",
};

export function SkillCard({ skill }: { skill: SkillDefinition }) {
  return (
    <Card className="flex flex-col justify-between hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
              <SkillIcon name={skill.icon} className="h-5 w-5 text-zinc-700" />
            </div>
            <div>
              <CardTitle className="text-base">{skill.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className={categoryColors[skill.category] || ""}
                >
                  {skill.category}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ~{skill.estimatedDuration}
                </span>
              </div>
            </div>
          </div>
        </div>
        <CardDescription className="mt-3 text-sm leading-relaxed">
          {skill.description}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Link href={`/run/${skill.id}`} className="w-full">
          <Button className="w-full cursor-pointer">Run Skill</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
