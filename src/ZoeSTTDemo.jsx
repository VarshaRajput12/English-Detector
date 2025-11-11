import React, { useEffect, useRef, useState } from "react";
import { ZoeSTT } from "@zoe-ng/stt";

export default function ZoeSTTDemo() {
  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");
  const [status, setStatus] = useState("idle");
  const [englishPercent, setEnglishPercent] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const sttRef = useRef(null);

  // STT init
  useEffect(() => {
    const stt = new ZoeSTT();
    stt.onPartial((t) => setPartial(t));
    stt.onFinal((t) => setFinalText((prev) => (prev ? prev + " " + t : t)));
    stt.onError?.((err) => {
      console.error("STT Error:", err);
      setStatus("error");
    });
    sttRef.current = stt;
    return () => stt.stop();
  }, []);

  // responsive listener
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const update = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  // body background
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#fff";
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, []);

  const analyzeLanguage = async (text) => {
    if (!text || text.trim().length === 0) {
      setEnglishPercent(0);
      return;
    }
    setStatus("analyzing");
    try {
      const res = await fetch("/api/analyze-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await res.json();
      if (res.ok && typeof j.percent === "number") {
        setEnglishPercent(Math.round(j.percent));
        setStatus("stopped");
      } else {
        console.error("Analyze error", j);
        setStatus("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const startListening = async () => {
    try {
      await sttRef.current.start();
      setStatus("listening");
      setPartial("");
      setFinalText("");
      setEnglishPercent(null);
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const stopListening = () => {
    sttRef.current.stop();
    setStatus("stopped");
    analyzeLanguage(finalText.trim());
  };

  // responsive styles generator
  const styles = (() => {
    const page = {
      fontFamily:
        "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      padding: isMobile ? 16 : 24,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#f5f7fb",
      minHeight: "100vh",
      boxSizing: "border-box",
      margin: 0,
      marginLeft: isMobile ? 0 : 400,
    };

    const card = {
      width: isMobile ? "96vw" : "90%",
      maxWidth: isMobile ? 720 : 980,
      margin: "0 auto",
      background: "#fff",
      borderRadius: isMobile ? 10 : 12,
      boxShadow: isMobile ? "0 4px 18px rgba(18,38,63,0.06)" : "0 6px 30px rgba(18,38,63,0.08)",
      padding: isMobile ? 14 : 20,
      boxSizing: "border-box",
    };

    const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" };
    const title = { margin: 0, fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#102a43" };
    const subtitle = { fontSize: isMobile ? 12 : 13, color: "#627d98", marginTop: 6 };

    const controls = { display: "flex", gap: 8, alignItems: "center" };
    const btnBase = {
      padding: isMobile ? "6px 10px" : "8px 14px",
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: isMobile ? 13 : 14,
    };
    const primary = { background: "linear-gradient(90deg,#3b82f6,#06b6d4)", color: "#fff" };
    const ghost = { background: "transparent", border: "1px solid #dbe7f5", color: "#102a43" };

    const statusBadge = { padding: "6px 10px", borderRadius: 999, fontSize: 13, fontWeight: 600, color: "#fff" };
    const statusIdle = { background: "#9aa6b2" };
    const statusListening = { background: "#16a34a" };
    const statusAnalyzing = { background: "#f59e0b" };
    const statusError = { background: "#ef4444" };

    const grid = {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 320px",
      gap: isMobile ? 12 : 16,
      marginTop: 12,
    };

    const box = { background: "#fbfdff", borderRadius: 8, padding: 12, minHeight: 120, boxSizing: "border-box" };
    const partialStyle = { color: "#6b7280", fontStyle: "italic", minHeight: 48, overflow: "auto" };
    const finalTextStyle = { whiteSpace: "pre-wrap", color: "#0f172a", minHeight: 100, overflow: "auto" };

    const percentBox = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 };
    const circle = { width: isMobile ? 96 : 120, height: isMobile ? 96 : 120, borderRadius: 999, display: "grid", placeItems: "center", background: "#f1f5f9" };
    const progressInner = { fontSize: isMobile ? 18 : 22, fontWeight: 700, color: "#0f172a" };
    const progressBarWrap = { width: "100%", height: 10, background: "#e6eefb", borderRadius: 999, overflow: "hidden" };
    const progressBar = (p) => ({ width: `${p}%`, height: "100%", background: "linear-gradient(90deg,#3b82f6,#06b6d4)" });

    const footerNote = { fontSize: isMobile ? 11 : 12, color: "#94a3b8", marginTop: 12 };

    return {
      page, card, header, title, subtitle, controls, btnBase, primary, ghost, statusBadge,
      statusIdle, statusListening, statusAnalyzing, statusError, grid, box, partialStyle,
      finalTextStyle, percentBox, circle, progressInner, progressBarWrap, progressBar, footerNote
    };
  })();

  const statusStyle =
    status === "listening" ? { ...styles.statusBadge, ...styles.statusListening } :
    status === "analyzing" ? { ...styles.statusBadge, ...styles.statusAnalyzing } :
    status === "error" ? { ...styles.statusBadge, ...styles.statusError } :
    { ...styles.statusBadge, ...styles.statusIdle };

  const displayPercent = typeof englishPercent === "number" ? englishPercent : 0;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={styles.title}>English Detector — Demo</h3>
            <div style={styles.subtitle}>Starts listening, stops, and analyzes the transcript to estimate English percentage.</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...statusStyle }}>{status.toUpperCase()}</div>
            <div style={styles.controls}>
              <button
                onClick={startListening}
                disabled={status === "listening"}
                style={{ ...styles.btnBase, ...styles.primary, opacity: status === "listening" ? 0.6 : 1 }}
              >
                Start
              </button>
              <button
                onClick={stopListening}
                disabled={status !== "listening"}
                style={{ ...styles.btnBase, ...styles.ghost, opacity: status !== "listening" ? 0.6 : 1 }}
              >
                Stop
              </button>
            </div>
          </div>
        </div>

        <div style={styles.grid}>
          <div>
            <div style={{ ...styles.box, marginBottom: 12 }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Live (Partial)</h4>
              <div style={styles.partialStyle}>{partial || <span style={{ color: "#cbd5e1" }}>Listening...</span>}</div>
            </div>

            <div style={styles.box}>
              <h4 style={{ margin: "0 0 8px 0" }}>Final Transcript</h4>
              <div style={styles.finalTextStyle}>{finalText || <span style={{ color: "#cbd5e1" }}>No transcript yet.</span>}</div>
            </div>

            <div style={styles.footerNote}>
              Tip: Click Stop to analyze the most recent transcript. The backend calls the model to compute the English percent.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...styles.box, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={styles.percentBox}>
                <div style={styles.circle}>
                  <div style={styles.progressInner}>
                    {englishPercent !== null ? `${englishPercent}%` : "—"}
                  </div>
                </div>

                <div style={{ width: "100%" }}>
                  <div style={styles.progressBarWrap}>
                    <div style={styles.progressBar(displayPercent)} />
                  </div>
                </div>

                <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                  {englishPercent !== null ? "Estimated English" : "Awaiting analysis"}
                </div>
              </div>
            </div>

            <div style={{ ...styles.box }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Status Details</h4>
              <div style={{ fontSize: 13, color: "#475569" }}>
                <div><strong>Status:</strong> {status}</div>
                <div><strong>Words:</strong> {finalText ? finalText.trim().split(/\s+/).filter(Boolean).length : 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}