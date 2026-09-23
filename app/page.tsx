import Link from "next/link";
import { getAllProjects } from "@/lib/projects";

export default function HomePage() {
  const projects = getAllProjects();

  return (
    <div>
      <section className="bg-paper px-6 py-24 text-center sm:py-32">
        <p className="text-sm font-semibold text-accent">Learning in public</p>
        <h1 className="mx-auto mt-2 max-w-3xl text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          From raw data to AI-ready agents.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-xl text-muted">
          Each project traces how the data was collected and cleaned, why
          the use case actually called for AI, and the interview questions it raises
          along the way.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        {projects.length === 0 ? (
          <p className="text-center text-muted">
            No projects found. Add a folder with a <code>content.yaml</code> at the repo
            root.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {projects.map((project) => (
              <Link
                key={project.slug}
                href={`/projects/${project.slug}`}
                className="group block rounded-[28px] bg-white p-8 shadow-[0_2px_20px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-ink">
                  {project.title}
                </h2>
                <p className="mt-2 text-[17px] leading-relaxed text-muted">
                  {project.tagline}
                </p>
                {project.tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink/70"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <span className="mt-6 inline-flex items-center gap-1 text-[17px] font-medium text-accent">
                  Learn more
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
