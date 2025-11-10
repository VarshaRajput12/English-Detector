import React, { useEffect, useRef, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default function ZoeSTTDemo() {
  const [partial, setPartial] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [status, setStatus] = useState("idle");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const voiceFeaturesRef = useRef([]);
  const speakerCountRef = useRef(0);
  const currentTranscriptRef = useRef({ text: '', features: null });

  // Initialize Gemini AI
  const genAI = useRef(null);
  
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      genAI.current = new GoogleGenerativeAI(apiKey);
    }
  }, []);

  // Extract voice features from audio
  const extractVoiceFeatures = () => {
    if (!analyserRef.current) return null;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate voice characteristics
    const avgFrequency = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
    const lowFreq = dataArray.slice(0, bufferLength / 4).reduce((a, b) => a + b, 0) / (bufferLength / 4);
    const midFreq = dataArray.slice(bufferLength / 4, bufferLength / 2).reduce((a, b) => a + b, 0) / (bufferLength / 4);
    const highFreq = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b, 0) / (bufferLength / 2);
    
    return {
      avgFrequency,
      lowFreq,
      midFreq,
      highFreq,
      ratio: lowFreq / (midFreq + 1), // Voice pitch indicator
    };
  };

  // Compare voice features to identify speaker
  const identifySpeaker = (features) => {
    if (!features || voiceFeaturesRef.current.length === 0) {
      // First speaker
      speakerCountRef.current += 1;
      const speaker = `Speaker-${speakerCountRef.current}`;
      voiceFeaturesRef.current.push({ speaker, features });
      return speaker;
    }

    // Compare with existing speakers
    let bestMatch = null;
    let minDistance = Infinity;

    voiceFeaturesRef.current.forEach(({ speaker, features: storedFeatures }) => {
      const distance = Math.sqrt(
        Math.pow(features.avgFrequency - storedFeatures.avgFrequency, 2) +
        Math.pow(features.lowFreq - storedFeatures.lowFreq, 2) +
        Math.pow(features.midFreq - storedFeatures.midFreq, 2) +
        Math.pow(features.highFreq - storedFeatures.highFreq, 2) +
        Math.pow(features.ratio - storedFeatures.ratio, 2) * 100
      );

      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = speaker;
      }
    });

    // If distance is too large, it's a new speaker
    const threshold = 50; // Adjust this for sensitivity
    if (minDistance > threshold) {
      speakerCountRef.current += 1;
      const newSpeaker = `Speaker-${speakerCountRef.current}`;
      voiceFeaturesRef.current.push({ speaker: newSpeaker, features });
      return newSpeaker;
    }

    return bestMatch;
  };

  useEffect(() => {
    // Check if browser supports Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Web Speech API not supported');
      setStatus('unsupported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        setPartial(interimTranscript);
        currentTranscriptRef.current.text = interimTranscript;
      }

      if (finalTranscript.trim()) {
        // Extract voice features and identify speaker automatically
        const features = extractVoiceFeatures();
        const speaker = identifySpeaker(features);
        
        setTranscripts((prev) => [
          ...prev,
          {
            speaker,
            text: finalTranscript,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        setPartial("");
        currentTranscriptRef.current = { text: '', features: null };
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        console.log('No speech detected');
      } else if (event.error === 'not-allowed') {
        setStatus('error');
        alert('Microphone access denied. Please allow microphone access.');
      } else {
        setStatus('error');
      }
    };

    recognition.onend = () => {
      if (status === 'listening') {
        // Restart recognition if it ends unexpectedly
        try {
          recognition.start();
        } catch (e) {
          console.log('Recognition restart failed:', e);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [status]);

  const startListening = async () => {
    if (!recognitionRef.current) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    try {
      // Setup audio analysis for voice recognition
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      setStatus("listening");
      setTranscripts([]);
      speakerCountRef.current = 0;
      voiceFeaturesRef.current = [];
      setAnalysis(null);
      recognitionRef.current.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setStatus("error");
      alert('Failed to access microphone. Please allow microphone access.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setStatus("stopped");
  };

  const analyzeTranscripts = async () => {
    if (!genAI.current) {
      alert("Please add your Gemini API key in the .env file");
      return;
    }

    if (transcripts.length === 0) {
      alert("No transcripts to analyze");
      return;
    }

    setAnalyzing(true);
    try {
      const model = genAI.current.getGenerativeModel({ model: "gemini-2.5-flash" });

      const transcriptText = transcripts
        .map((t) => `${t.speaker}: ${t.text}`)
        .join("\n");

      const prompt = `Analyze the following conversation transcript and provide:
1. For each speaker, identify what language(s) they are speaking
2. For each speaker, calculate the percentage of English words vs other languages
3. Overall English speaking percentage across all speakers
4. List any non-English languages detected

Transcript:
${transcriptText}

Provide your response in the following JSON format:
{
  "speakers": [
    {
      "speaker": "Speaker-1",
      "languages": ["English", "Spanish"],
      "englishPercentage": 80,
      "details": "brief description"
    }
  ],
  "overallEnglishPercentage": 75,
  "nonEnglishLanguages": ["Spanish", "French"],
  "summary": "brief summary of language usage"
}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysisData = JSON.parse(jsonMatch[0]);
        setAnalysis(analysisData);
      } else {
        setAnalysis({
          error: true,
          message: "Could not parse analysis",
          rawResponse: text,
        });
      }
    } catch (error) {
      console.error("Analysis error:", error);
      setAnalysis({
        error: true,
        message: error.message || "Failed to analyze transcripts",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <h2>Multi-Speaker Voice Recognition with Language Detection</h2>
      
      <div style={{ marginBottom: "1rem" }}>
        <button 
          onClick={startListening} 
          disabled={status === "listening"}
          style={{
            padding: "0.5rem 1rem",
            marginRight: "0.5rem",
            backgroundColor: status === "listening" ? "#ccc" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: status === "listening" ? "not-allowed" : "pointer",
          }}
        >
          Start Recording
        </button>
        <button 
          onClick={stopListening} 
          disabled={status !== "listening"}
          style={{
            padding: "0.5rem 1rem",
            marginRight: "0.5rem",
            backgroundColor: status !== "listening" ? "#ccc" : "#f44336",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: status !== "listening" ? "not-allowed" : "pointer",
          }}
        >
          Stop Recording
        </button>
        <button 
          onClick={analyzeTranscripts}
          disabled={transcripts.length === 0 || analyzing}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: transcripts.length === 0 || analyzing ? "#ccc" : "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: transcripts.length === 0 || analyzing ? "not-allowed" : "pointer",
          }}
        >
          {analyzing ? "Analyzing..." : "Analyze Languages"}
        </button>
      </div>

      <p>
        Status: <strong style={{ color: status === "listening" ? "green" : "gray" }}>{status}</strong>
        {status === "listening" && (
          <span style={{ marginLeft: "1rem", color: "#2196F3", fontSize: "0.9em" }}>
            🎤 Automatically detecting speakers based on voice characteristics...
          </span>
        )}
      </p>

      {partial && (
        <div style={{ 
          marginTop: "1rem", 
          padding: "1rem", 
          backgroundColor: "#f0f0f0", 
          borderRadius: "4px" 
        }}>
          <h4 style={{ margin: "0 0 0.5rem 0" }}>Listening...</h4>
          <p style={{ color: "#666", margin: 0 }}>{partial}</p>
        </div>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <h3>Transcripts</h3>
        {transcripts.length === 0 ? (
          <p style={{ color: "#999" }}>No transcripts yet. Start recording to begin.</p>
        ) : (
          <div style={{ 
            border: "1px solid #ddd", 
            borderRadius: "4px", 
            padding: "1rem",
            maxHeight: "300px",
            overflowY: "auto"
          }}>
            {transcripts.map((item, index) => (
              <div 
                key={index} 
                style={{ 
                  marginBottom: "0.75rem",
                  paddingBottom: "0.75rem",
                  borderBottom: index < transcripts.length - 1 ? "1px solid #eee" : "none"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <strong style={{ color: "#2196F3" }}>{item.speaker}</strong>
                  <span style={{ color: "#999", fontSize: "0.85em" }}>{item.timestamp}</span>
                </div>
                <p style={{ margin: 0, paddingLeft: "1rem" }}>{item.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {analysis && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Language Analysis</h3>
          {analysis.error ? (
            <div style={{ 
              padding: "1rem", 
              backgroundColor: "#ffebee", 
              borderRadius: "4px",
              border: "1px solid #f44336"
            }}>
              <p style={{ color: "#c62828", margin: 0 }}><strong>Error:</strong> {analysis.message}</p>
              {analysis.rawResponse && (
                <details style={{ marginTop: "0.5rem" }}>
                  <summary>Raw Response</summary>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85em" }}>{analysis.rawResponse}</pre>
                </details>
              )}
            </div>
          ) : (
            <div style={{ 
              border: "1px solid #ddd", 
              borderRadius: "4px", 
              padding: "1rem" 
            }}>
              <div style={{ 
                marginBottom: "1.5rem",
                padding: "1rem",
                backgroundColor: "#e3f2fd",
                borderRadius: "4px"
              }}>
                <h4 style={{ margin: "0 0 0.5rem 0" }}>Overall Results</h4>
                <p style={{ fontSize: "1.5em", margin: "0.5rem 0", color: "#1976d2" }}>
                  <strong>{analysis.overallEnglishPercentage}%</strong> English
                </p>
                {analysis.nonEnglishLanguages && analysis.nonEnglishLanguages.length > 0 && (
                  <p style={{ margin: "0.5rem 0" }}>
                    <strong>Other Languages Detected:</strong> {analysis.nonEnglishLanguages.join(", ")}
                  </p>
                )}
                {analysis.summary && (
                  <p style={{ margin: "0.5rem 0", fontSize: "0.9em", color: "#555" }}>
                    {analysis.summary}
                  </p>
                )}
              </div>

              {analysis.speakers && analysis.speakers.length > 0 && (
                <div>
                  <h4>Per-Speaker Analysis</h4>
                  {analysis.speakers.map((speaker, index) => (
                    <div 
                      key={index}
                      style={{ 
                        marginBottom: "1rem",
                        padding: "1rem",
                        backgroundColor: "#f5f5f5",
                        borderRadius: "4px"
                      }}
                    >
                      <h5 style={{ margin: "0 0 0.5rem 0", color: "#2196F3" }}>
                        {speaker.speaker}
                      </h5>
                      <p style={{ margin: "0.25rem 0" }}>
                        <strong>Languages:</strong> {speaker.languages.join(", ")}
                      </p>
                      <p style={{ margin: "0.25rem 0" }}>
                        <strong>English Percentage:</strong> {speaker.englishPercentage}%
                      </p>
                      {speaker.details && (
                        <p style={{ margin: "0.25rem 0", fontSize: "0.9em", color: "#666" }}>
                          {speaker.details}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ 
        marginTop: "2rem", 
        padding: "1rem", 
        backgroundColor: "#fff3cd", 
        borderRadius: "4px",
        border: "1px solid #ffc107"
      }}>
        <h4 style={{ margin: "0 0 0.5rem 0" }}>ℹ️ How It Works</h4>
        <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
          <li><strong>Automatic Speaker Detection:</strong> The system analyzes voice characteristics (pitch, frequency, tone) to automatically identify different speakers</li>
          <li><strong>Start Recording:</strong> Click to begin voice recognition</li>
          <li><strong>Speak Naturally:</strong> Multiple people can speak - the system will automatically detect and label different speakers</li>
          <li><strong>Stop & Analyze:</strong> Stop recording and click "Analyze Languages" to get language breakdown and English percentage</li>
        </ul>
        <p style={{ margin: "0.5rem 0", fontSize: "0.9em", color: "#666" }}>
          <strong>Note:</strong> Make sure you've added your Gemini API key to the <code>.env</code> file before analyzing. 
          The voice detection works best when speakers have distinct voice characteristics.
        </p>
      </div>
    </div>
  );
}
