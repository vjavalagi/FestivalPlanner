import fs from "fs";
import path from "path";
import { Festival } from "./types";

const FESTIVAL_DIR = path.join(process.cwd(), "data", "festivals");

export function getFestivals(): Festival[] {
  const files = fs.readdirSync(FESTIVAL_DIR).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => JSON.parse(fs.readFileSync(path.join(FESTIVAL_DIR, f), "utf8")) as Festival)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function getFestival(id: string): Festival | undefined {
  return getFestivals().find((f) => f.id === id);
}

export const PHASE_LABELS: Record<number, string> = {
  1: "Phase 1 · lineup announced",
  2: "Phase 2 · daily lineups out",
  3: "Phase 3 · full schedule out",
};
