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
  const lastSpeechTimeRef = useRef(Date.now());
  const currentSpeakerRef = useRef(null);
  const voiceSamplesRef = useRef([]);
  const sampleCountRef = useRef(0);

  // Initialize Gemini AI
  const genAI = useRef(null);
  
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      genAI.current = new GoogleGenerativeAI(apiKey);
    }
  }, []);

  // Collect voice samples continuously
  useEffect(() => {
    if (status !== 'listening' || !analyserRef.current) return;

    const interval = setInterval(() => {
      const features = extractVoiceFeatures();
      if (features && features.avgFrequency > 10) { // Only when there's actual voice
        voiceSamplesRef.current.push({
          features,
          timestamp: Date.now()
        });
        
        // Keep only recent samples (last 500ms)
        const now = Date.now();
        voiceSamplesRef.current = voiceSamplesRef.current.filter(
          sample => now - sample.timestamp < 500
        );
        
        // Debug: Log when collecting voice samples
        if (voiceSamplesRef.current.length % 3 === 0) {
          console.log(`📊 Collecting voice samples: ${voiceSamplesRef.current.length} samples`);
        }
      }
    }, 100); // Sample every 100ms

    return () => clearInterval(interval);
  }, [status]);

  // Extract voice features from audio
  const extractVoiceFeatures = () => {
    if (!analyserRef.current) return null;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyser.getByteFrequencyData(dataArray);
    
    // Filter out silence
    const totalEnergy = dataArray.reduce((a, b) => a + b, 0);
    if (totalEnergy < 100) return null; // Too quiet, likely silence
    
    // Calculate voice characteristics with more precision
    const lowFreq = dataArray.slice(0, Math.floor(bufferLength * 0.15)).reduce((a, b) => a + b, 0);
    const midLowFreq = dataArray.slice(Math.floor(bufferLength * 0.15), Math.floor(bufferLength * 0.3)).reduce((a, b) => a + b, 0);
    const midFreq = dataArray.slice(Math.floor(bufferLength * 0.3), Math.floor(bufferLength * 0.5)).reduce((a, b) => a + b, 0);
    const highFreq = dataArray.slice(Math.floor(bufferLength * 0.5), bufferLength).reduce((a, b) => a + b, 0);
    
    // Calculate spectral features
    const avgFrequency = totalEnergy / bufferLength;
    const spectralCentroid = dataArray.reduce((sum, val, idx) => sum + val * idx, 0) / totalEnergy;
    
    return {
      avgFrequency,
      lowFreq,
      midLowFreq,
      midFreq,
      highFreq,
      spectralCentroid,
      totalEnergy,
      lowMidRatio: lowFreq / (midFreq + 1),
      highMidRatio: highFreq / (midFreq + 1),
    };
  };

  // Get average features from recent samples
  const getAverageFeatures = () => {
    if (voiceSamplesRef.current.length === 0) return null;
    
    const samples = voiceSamplesRef.current;
    const avgFeatures = {
      avgFrequency: 0,
      lowFreq: 0,
      midLowFreq: 0,
      midFreq: 0,
      highFreq: 0,
      spectralCentroid: 0,
      totalEnergy: 0,
      lowMidRatio: 0,
      highMidRatio: 0,
    };
    
    samples.forEach(sample => {
      Object.keys(avgFeatures).forEach(key => {
        avgFeatures[key] += sample.features[key];
      });
    });
    
    Object.keys(avgFeatures).forEach(key => {
      avgFeatures[key] /= samples.length;
    });
    
    return avgFeatures;
  };

  // Compare voice features to identify speaker
  const identifySpeaker = (features) => {
    if (!features) {
      return currentSpeakerRef.current || `Speaker-1`;
    }

    const now = Date.now();
    const timeSinceLastSpeech = now - lastSpeechTimeRef.current;
    
    // If first speaker or no speakers yet
    if (voiceFeaturesRef.current.length === 0) {
      speakerCountRef.current = 1;
      const speaker = `Speaker-1`;
      voiceFeaturesRef.current.push({ 
        speaker, 
        features,
        lastSeen: now
      });
      currentSpeakerRef.current = speaker;
      lastSpeechTimeRef.current = now;
      return speaker;
    }

    // Compare with existing speakers
    let bestMatch = null;
    let minDistance = Infinity;

    voiceFeaturesRef.current.forEach(({ speaker, features: storedFeatures }) => {
      // Calculate normalized distance with proper weighting
      const distance = Math.sqrt(
        Math.pow((features.spectralCentroid - storedFeatures.spectralCentroid) / 200, 2) * 3 +
        Math.pow((features.avgFrequency - storedFeatures.avgFrequency) / 50, 2) * 2 +
        Math.pow(features.lowMidRatio - storedFeatures.lowMidRatio, 2) * 10 +
        Math.pow(features.highMidRatio - storedFeatures.highMidRatio, 2) * 10 +
        Math.pow((features.lowFreq - storedFeatures.lowFreq) / 2000, 2) +
        Math.pow((features.midFreq - storedFeatures.midFreq) / 2000, 2) +
        Math.pow((features.highFreq - storedFeatures.highFreq) / 2000, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = speaker;
      }
    });

    // More aggressive threshold - easier to detect new speakers
    let threshold = 1.5; // Base threshold (lowered from 3.0)
    
    // If there's a pause, be even more aggressive
    if (timeSinceLastSpeech > 1000) {
      threshold = 1.0; // Very sensitive after 1 second pause
    }
    
    // If continuing from same speaker very quickly, be less sensitive
    if (timeSinceLastSpeech < 500 && currentSpeakerRef.current === bestMatch) {
      threshold = 2.5; // Less likely to create new speaker if speaking continuously
    }

    console.log('🎤 Voice Analysis:', {
      distance: minDistance.toFixed(3),
      threshold: threshold.toFixed(3),
      timeSinceLast: timeSinceLastSpeech,
      currentSpeaker: currentSpeakerRef.current,
      bestMatch: bestMatch,
      willCreateNew: minDistance > threshold
    });

    // If distance is too large, it's a new speaker
    if (minDistance > threshold) {
      speakerCountRef.current += 1;
      const newSpeaker = `Speaker-${speakerCountRef.current}`;
      console.log(`✨ NEW SPEAKER DETECTED: ${newSpeaker} (distance: ${minDistance.toFixed(3)} > threshold: ${threshold.toFixed(3)})`);
      voiceFeaturesRef.current.push({ 
        speaker: newSpeaker, 
        features,
        lastSeen: now
      });
      currentSpeakerRef.current = newSpeaker;
      lastSpeechTimeRef.current = now;
      return newSpeaker;
    }

    // Update the features for matched speaker (adaptive learning)
    const matchedSpeaker = voiceFeaturesRef.current.find(s => s.speaker === bestMatch);
    if (matchedSpeaker) {
      // Blend old and new features (80% old, 20% new) - more conservative updates
      Object.keys(features).forEach(key => {
        matchedSpeaker.features[key] = matchedSpeaker.features[key] * 0.8 + features[key] * 0.2;
      });
      matchedSpeaker.lastSeen = now;
    }

    currentSpeakerRef.current = bestMatch;
    lastSpeechTimeRef.current = now;
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
      }

      if (finalTranscript.trim()) {
        console.log(`🎤 Final transcript received: "${finalTranscript}"`);
        console.log(`📊 Voice samples available: ${voiceSamplesRef.current.length}`);
        
        // Get average voice features from recent samples
        const features = getAverageFeatures();
        console.log('🔊 Extracted features:', features);
        
        const speaker = identifySpeaker(features);
        console.log(`✅ Assigned to: ${speaker}`);
        
        setTranscripts((prev) => [
          ...prev,
          {
            speaker,
            text: finalTranscript,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        setPartial("");
        
        // Clear samples after processing
        voiceSamplesRef.current = [];
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
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Cleanup: recognition stop error', e);
        }
      }
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.log('Cleanup: media stream stop error', e);
        }
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (e) {
          console.log('Cleanup: audio context close error', e);
        }
      }
    };
  }, [status]);

  const startListening = async () => {
    if (!recognitionRef.current) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    try {
      // Clean up any existing audio context first
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

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
      voiceSamplesRef.current = [];
      currentSpeakerRef.current = null;
      lastSpeechTimeRef.current = Date.now();
      setAnalysis(null);
      
      // Start recognition after audio setup
      recognitionRef.current.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setStatus("error");
      alert('Failed to access microphone. Please allow microphone access.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Recognition stop error:', e);
      }
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      } catch (e) {
        console.log('Media stream stop error:', e);
      }
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
      } catch (e) {
        console.log('Audio context close error:', e);
      }
    }
    analyserRef.current = null;
    setStatus("stopped");
  };

  const analyzeTranscripts = async (retryCount = 0) => {
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
      
      // Handle specific error cases
      if (error.message && error.message.includes("overloaded")) {
        // Retry logic for overloaded model
        if (retryCount < 3) {
          const waitTime = (retryCount + 1) * 2; // 2s, 4s, 6s
          setAnalysis({
            error: false,
            retrying: true,
            message: `Model is overloaded. Retrying in ${waitTime} seconds... (Attempt ${retryCount + 1}/3)`,
          });
          
          setTimeout(() => {
            analyzeTranscripts(retryCount + 1);
          }, waitTime * 1000);
          return; // Don't set analyzing to false yet
        } else {
          setAnalysis({
            error: true,
            message: "Gemini API is currently overloaded. Please try again in a few minutes.",
            details: "The free tier has usage limits. Wait a moment and try again, or consider using the API during off-peak hours.",
          });
        }
      } else if (error.message && error.message.includes("RESOURCE_EXHAUSTED")) {
        setAnalysis({
          error: true,
          message: "API quota exceeded",
          details: "You've hit the rate limit. Please wait a minute before trying again.",
        });
      } else {
        setAnalysis({
          error: true,
          message: error.message || "Failed to analyze transcripts",
          details: "Please check your API key and internet connection.",
        });
      }
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
            🎤 Automatically detecting speakers... 
            {speakerCountRef.current > 0 && (
              <span style={{ marginLeft: "0.5rem", color: "#FF9800", fontWeight: "bold" }}>
                ({speakerCountRef.current} speaker{speakerCountRef.current > 1 ? 's' : ''} detected)
              </span>
            )}
          </span>
        )}
      </p>

      {status === "listening" && voiceFeaturesRef.current.length > 0 && (
        <div style={{ 
          marginTop: "1rem", 
          padding: "0.75rem", 
          backgroundColor: "#f5f5f5", 
          borderRadius: "4px",
          border: "1px solid #ddd"
        }}>
          <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95em" }}>Detected Speakers:</h4>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {voiceFeaturesRef.current.map(({ speaker }) => (
              <span
                key={speaker}
                style={{
                  padding: "0.25rem 0.75rem",
                  backgroundColor: speaker === currentSpeakerRef.current ? "#4CAF50" : "#2196F3",
                  color: "white",
                  borderRadius: "12px",
                  fontSize: "0.85em",
                  fontWeight: "bold"
                }}
              >
                {speaker} {speaker === currentSpeakerRef.current && "🔊"}
              </span>
            ))}
          </div>
        </div>
      )}

      {status === "listening" && (
        <div style={{ 
          marginTop: "1rem", 
          padding: "0.75rem", 
          backgroundColor: "#e3f2fd", 
          borderRadius: "4px",
          border: "1px solid #2196F3"
        }}>
          <p style={{ margin: 0, fontSize: "0.9em", color: "#1976d2" }}>
            💡 <strong>Tip:</strong> For best results, have speakers pause briefly (1 second) between turns. 
            The system analyzes voice pitch, frequency, and tone to distinguish between speakers.
            <br/>
            <strong>Debug:</strong> Open browser console (F12) to see detailed voice analysis.
          </p>
        </div>
      )}

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
          {analysis.retrying ? (
            <div style={{ 
              padding: "1rem", 
              backgroundColor: "#fff3cd", 
              borderRadius: "4px",
              border: "1px solid #ffc107"
            }}>
              <p style={{ color: "#856404", margin: 0 }}>
                <strong>⏳ {analysis.message}</strong>
              </p>
            </div>
          ) : analysis.error ? (
            <div style={{ 
              padding: "1rem", 
              backgroundColor: "#ffebee", 
              borderRadius: "4px",
              border: "1px solid #f44336"
            }}>
              <p style={{ color: "#c62828", margin: "0 0 0.5rem 0" }}>
                <strong>Error:</strong> {analysis.message}
              </p>
              {analysis.details && (
                <p style={{ color: "#c62828", margin: "0.5rem 0", fontSize: "0.9em" }}>
                  {analysis.details}
                </p>
              )}
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
