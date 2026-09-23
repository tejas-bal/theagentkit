import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllProjects, getProjectBySlug } from "@/lib/projects";
import ProjectTabs from "@/components/ProjectTabs";
import { GITHUB_URL, GitHubIcon } from "@/components/SocialIcons";

export function generateStaticParams() {
  return getAllProjects().map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return {};

  const url = `/projects/${project.slug}`;
  return {
    title: project.title,
    description: project.tagline,
    alternates: { canonical: url },
    // Setting openGraph/twitter here replaces the inherited objects, so the
    // root preview card (app/opengraph-image.tsx) has to be re-attached.
    openGraph: { type: "article", url, title: project.title, description: project.tagline, images: ["/opengraph-image"] },
    twitter: { card: "summary_large_image", title: project.title, description: project.tagline, images: ["/opengraph-image"] },
  };
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
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white"
          >
            <GitHubIcon size={16} />
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
