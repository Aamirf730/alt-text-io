import { ImageResponse } from "next/og";

export const alt = "Alt Text Examples compares “Mountain landscape” with “Snowy peaks reflected in a lake.”";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        width: "100%", height: "100%", padding: "66px 76px", background: "#fffbee", color: "#1a1917",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 27, fontWeight: 700 }}>
          <div style={{ display: "flex", width: 22, height: 22, borderRadius: 6, background: "#f4c82b" }} />
          Alt Text Pro
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 89, letterSpacing: -5, fontWeight: 700 }}>Alt Text Examples</div>
          <div style={{ display: "flex", fontSize: 32, color: "#524e43" }}>
            Image descriptions in context
          </div>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          <div style={{
            display: "flex", flexDirection: "column", gap: 10, flex: 1, padding: "22px 26px",
            border: "2px solid #e7ddbc", borderRadius: 18, background: "white",
          }}>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700 }}>× Weak</div>
            <div style={{ display: "flex", fontSize: 28 }}>Mountain landscape</div>
          </div>
          <div style={{
            display: "flex", flexDirection: "column", gap: 10, flex: 1, padding: "22px 26px",
            border: "2px solid #e7ddbc", borderRadius: 18, background: "#ffec9a",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 700 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="m5 12 4 4 10-10" stroke="#1a1917" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Better
            </div>
            <div style={{ display: "flex", fontSize: 28 }}>Snowy peaks reflected in a lake</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
