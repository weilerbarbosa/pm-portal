import { skills } from "@/lib/skills/registry";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(skills);
}
