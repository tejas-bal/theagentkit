import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const REPO_ROOT = path.join(process.cwd());

// Folders at repo root that are part of the app itself, not content projects.
const IGNORED_DIRS = new Set([
  "app",
  "lib",
  "node_modules",
  ".git",
  ".next",
  ".claude",
  "public",
]);

export interface InterviewQuestion {
  q: string;
  a: string;
}

export interface ProjectContent {
  slug: string;
  dir: string;
  title: string;
  tagline: string;
  tags: string[];
  useCase: string;
  dataCollection: string;
  aiAgent: string;
  interviewQuestions: InterviewQuestion[];
  hasRagIndex: boolean;
}

function readProjectContent(dirName: string): ProjectContent | null {
  const contentPath = path.join(REPO_ROOT, dirName, "content.yaml");
  if (!fs.existsSync(contentPath)) return null;

  const raw = fs.readFileSync(contentPath, "utf8");
  const parsed = yaml.load(raw) as Partial<ProjectContent>;

  if (!parsed || !parsed.title) return null;

  const ragIndexPath = path.join(REPO_ROOT, dirName, "rag", "index", "index.json");

  return {
    slug: parsed.slug ?? dirName,
    dir: dirName,
    title: parsed.title,
    tagline: parsed.tagline ?? "",
    tags: parsed.tags ?? [],
    useCase: parsed.useCase ?? "",
    dataCollection: parsed.dataCollection ?? "",
    aiAgent: parsed.aiAgent ?? "",
    interviewQuestions: parsed.interviewQuestions ?? [],
    hasRagIndex: fs.existsSync(ragIndexPath),
  };
}

export function getAllProjects(): ProjectContent[] {
  const entries = fs.readdirSync(REPO_ROOT, { withFileTypes: true });

  const projects: ProjectContent[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (IGNORED_DIRS.has(entry.name)) continue;

    const project = readProjectContent(entry.name);
    if (project) projects.push(project);
  }

  return projects.sort((a, b) => a.title.localeCompare(b.title));
}

export function getProjectBySlug(slug: string): ProjectContent | null {
  return getAllProjects().find((p) => p.slug === slug) ?? null;
}
