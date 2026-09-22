"use client";

import { useEffect, useState } from "react";
import MarkdownContent from "./MarkdownContent";
import AskTab from "./AskTab";
import RagSearchTab from "./RagSearchTab";

const TABS = [
  { id: "use-case", label: "Use Case" },
  { id: "data-collection", label: "Data Collection" },
  { id: "ai-agent", label: "AI Agent" },
  { id: "rag", label: "RAG" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface ProjectTabsProps {
  slug: string;
  useCase: string;
  dataCollection: string;
  aiAgent: string;
  hasRagIndex: boolean;
}

export default function ProjectTabs({
  slug,
  useCase,
  dataCollection,
  aiAgent,
  hasRagIndex,
}: ProjectTabsProps) {
  // Default tab renders in the initial (server-rendered/static) HTML. The URL's
  // ?tab= param, if any, is only read after mount so tabs stay real static
  // content rather than being gated behind client-only search-param hydration.
  const [activeTab, setActiveTab] = useState<TabId>("use-case");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab") as TabId | null;
    if (requested && TABS.some((t) => t.id === requested)) {
      setActiveTab(requested);
    }
  }, []);

  function selectTab(id: TabId) {
    setActiveTab(id);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", id);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  return (
    <div>
      <div className="sticky top-11 z-40 border-t border-white/10 bg-[#2c2c2e]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-8 px-6 sm:gap-12">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className="flex flex-col items-center gap-1.5 py-3.5"
            >
              <span
                className={`text-[13px] font-normal tracking-wide transition-colors sm:text-sm ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-white/60 hover:text-white/90"
                }`}
              >
                {tab.label}
              </span>
              <span
                className={`h-1 w-1 rounded-full transition-opacity ${
                  activeTab === tab.id ? "bg-white opacity-100" : "opacity-0"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-16">
        {activeTab === "use-case" && <MarkdownContent content={useCase} />}
        {activeTab === "data-collection" && <MarkdownContent content={dataCollection} />}
        {activeTab === "ai-agent" &&
          (hasRagIndex ? <AskTab slug={slug} /> : <MarkdownContent content={aiAgent} />)}
        {activeTab === "rag" &&
          (hasRagIndex ? (
            <RagSearchTab slug={slug} />
          ) : (
            <p className="text-muted">No search index available for this project yet.</p>
          ))}
      </div>
    </div>
  );
}
