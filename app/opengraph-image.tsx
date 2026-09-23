import { ImageResponse } from "next/og";

// Link-preview card for LinkedIn, X, Slack etc. Project pages inherit it.
export const alt = "theagentkit: from raw data to AI-ready agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#f5f5f7",
          color: "#1d1d1f",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 600, color: "#0071e3" }}>Learning in public</div>
        <div style={{ marginTop: 16, fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          From raw data to AI-ready agents.
        </div>
        <div style={{ marginTop: 28, fontSize: 34, color: "#86868b", maxWidth: 950 }}>
          Real projects built end to end: data collection, RAG, and knowing when not to use an LLM.
        </div>
        <div style={{ marginTop: "auto", fontSize: 32, fontWeight: 600 }}>theagentkit.info</div>
      </div>
    ),
    size
  );
}
