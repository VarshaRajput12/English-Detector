import React, { useEffect, useRef, useState } from "react";
import { ZoeSTT } from "@zoe-ng/stt";

export default function ZoeSTTDemo() {
  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");
  const [status, setStatus] = useState("idle");
  const sttRef = useRef(null);

  useEffect(() => {
    const stt = new ZoeSTT();

    stt.onPartial((t) => setPartial(t));
    stt.onFinal((t) => setFinalText((prev) => prev + " " + t));
    stt.onError?.((err) => {
      console.error("STT Error:", err);
      setStatus("error");
    });

    sttRef.current = stt;
    return () => {
      stt.stop();
    };
  }, []);

  const startListening = async () => {
    try {
      await sttRef.current.start();
      setStatus("listening");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const stopListening = () => {
    sttRef.current.stop();
    setStatus("stopped");
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
      </div>
    </div>
  );
}
