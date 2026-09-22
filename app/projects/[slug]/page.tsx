import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllProjects, getProjectBySlug } from "@/lib/projects";
import ProjectTabs from "@/components/ProjectTabs";

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
      </section>

      <ProjectTabs
        slug={project.slug}
        useCase={project.useCase}
        dataCollection={project.dataCollection}
        aiAgent={project.aiAgent}
        hasRagIndex={project.hasRagIndex}
      />
    </div>
  );
}
