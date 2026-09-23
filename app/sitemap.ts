import type { MetadataRoute } from "next";
import { getAllProjects } from "@/lib/projects";

const SITE_URL = "https://www.theagentkit.info";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...getAllProjects().map((project) => ({
      url: `${SITE_URL}/projects/${project.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
