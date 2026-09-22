"use client";

import { useEffect, useState } from "react";
import type { InterviewQuestion } from "@/lib/projects";
import MarkdownContent from "./MarkdownContent";
import AskTab from "./AskTab";

const TABS = [
  { id: "use-case", label: "Use Case" },
  { id: "data-collection", label: "Data Collection" },
  { id: "ai-agent", label: "AI Agent" },
  { id: "interview-questions", label: "Interview Questions" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface ProjectTabsProps {
  slug: string;
  useCase: string;
  dataCollection: string;
  aiAgent: string;
  interviewQuestions: InterviewQuestion[];
  hasRagIndex: boolean;
}

export default function ProjectTabs({
  slug,
  useCase,
  dataCollection,
  aiAgent,
  interviewQuestions,
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
        {activeTab === "interview-questions" && (
          <div className="space-y-4">
            {interviewQuestions.length === 0 && (
              <p className="text-muted">No interview questions added yet.</p>
            )}
            {interviewQuestions.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <p className="font-semibold text-ink">{item.q}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{item.a}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
