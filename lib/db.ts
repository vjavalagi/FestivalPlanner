import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Database, Group, MemberSnapshot } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

function load(): Database {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Database;
  } catch {
    return { groups: {} };
  }
}

function save(db: Database) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// No ambiguous characters (0/O, 1/I/L) so codes are easy to share out loud
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function createGroup(name: string): Group {
  const db = load();
  let code = generateCode();
  while (db.groups[code]) code = generateCode();
  const group: Group = {
    code,
    name: name.trim() || "Festival Crew",
    createdAt: new Date().toISOString(),
    members: [],
  };
  db.groups[code] = group;
  save(db);
  return group;
}

export function getGroup(code: string): Group | undefined {
  return load().groups[code.toUpperCase()];
}

export function saveMemberSnapshot(
  code: string,
  memberName: string,
  snapshot: MemberSnapshot
): Group | undefined {
  const db = load();
  const group = db.groups[code.toUpperCase()];
  if (!group) return undefined;
  const trimmed = memberName.trim();
  const existing = group.members.find(
    (m) => m.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) {
    existing.snapshot = snapshot;
  } else {
    group.members.push({ name: trimmed, snapshot });
  }
  save(db);
  return group;
}

export function removeMember(code: string, memberName: string): Group | undefined {
  const db = load();
  const group = db.groups[code.toUpperCase()];
  if (!group) return undefined;
  group.members = group.members.filter(
    (m) => m.name.toLowerCase() !== memberName.trim().toLowerCase()
  );
  save(db);
  return group;
}
