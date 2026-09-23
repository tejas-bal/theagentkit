import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllProjects, getProjectBySlug } from "@/lib/projects";
import ProjectTabs from "@/components/ProjectTabs";

const REPO_URL = "https://github.com/tejas-bal/theagentkit";

export function generateStaticParams() {
  return getAllProjects().map((project) => ({ slug: project.slug }));
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) notFound();

  return (
    <div>
      <section className="bg-black px-6 py-10 text-center text-white sm:py-12">
        <Link
          href="/"
          className="text-xs font-medium text-white/50 transition hover:text-white"
        >
          ← All projects
        </Link>

        <h1 className="mx-auto mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {project.title}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/60 sm:text-base">
          {project.tagline}
        </p>

        {project.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
        </div>
      </section>

      <ProjectTabs
        slug={project.slug}
        useCase={project.useCase}
        dataCollection={project.dataCollection}
        aiAgent={project.aiAgent}
        hasRagIndex={project.hasRagIndex}
        exampleQuestions={project.exampleQuestions}
      />
    </div>
  );
}
