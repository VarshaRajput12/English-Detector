import React, { useEffect, useRef, useState } from "react";
import { ZoeSTT } from "@zoe-ng/stt";

export default function ZoeSTTDemo() {
  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");
  const [status, setStatus] = useState("idle");
  const [englishPercent, setEnglishPercent] = useState(null);
  const sttRef = useRef(null);

  useEffect(() => {
    const stt = new ZoeSTT();

    stt.onPartial((t) => setPartial(t));
    stt.onFinal((t) => setFinalText((prev) => (prev ? prev + " " + t : t)));
    stt.onError?.((err) => {
      console.error("STT Error:", err);
      setStatus("error");
    });

    sttRef.current = stt;
    return () => {
      stt.stop();
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
    // send current finalText for analysis
    const transcript = finalText.trim();
    analyzeLanguage(transcript);
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Zoe Speech-to-Text Demo</h2>
      <div>
        <button onClick={startListening} disabled={status === "listening"}>
          Start
        </button>
        <button onClick={stopListening} disabled={status !== "listening"}>
          Stop
        </button>
      </div>

      <p>Status: <strong>{status}</strong></p>

      <div style={{ marginTop: "1rem" }}>
        <h4>Partial:</h4>
        <p style={{ color: "#666" }}>{partial}</p>

        <h4>Final Transcript:</h4>
        <p style={{ whiteSpace: "pre-wrap" }}>{finalText}</p>

        <h4>English Percent:</h4>
        <p>{englishPercent !== null ? `${englishPercent}%` : "—"}</p>
      </div>
    </div>
  );
}