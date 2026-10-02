"use client";

import type { ReactElement } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  hasNativeSpeechInput,
  startNativeSpeechInput,
} from "../lib/mobile-capabilities";

interface VoiceCaptureButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

interface BrowserSpeechResult {
  results: {
    0: {
      0: { transcript: string };
    };
  };
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type BrowserSpeechConstructor = new () => BrowserSpeechRecognition;

function browserSpeechConstructor(): BrowserSpeechConstructor | null {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechConstructor;
    webkitSpeechRecognition?: BrowserSpeechConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function subscribeToCapability(): () => void {
  return () => undefined;
}

function speechCapabilitySnapshot(): boolean {
  return hasNativeSpeechInput() || Boolean(browserSpeechConstructor());
}

/** Capture free speech transcription through Android or the supporting browser. */
export default function VoiceCaptureButton({
  onTranscript,
  disabled = false,
}: VoiceCaptureButtonProps): ReactElement | null {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isSupported = useSyncExternalStore(
    subscribeToCapability,
    speechCapabilitySnapshot,
    () => false,
  );
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  if (!isSupported) return null;

  const startListening = async (): Promise<void> => {
    setError("");
    setIsListening(true);
    if (hasNativeSpeechInput()) {
      try {
        const text = await startNativeSpeechInput();
        if (text) onTranscript(text);
      } catch {
        setError("Voice input unavailable.");
      } finally {
        setIsListening(false);
      }
      return;
    }

    const SpeechRecognition = browserSpeechConstructor();
    if (!SpeechRecognition) {
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.trim();
      if (text) onTranscript(text);
    };
    recognition.onerror = () => setError("Voice input unavailable.");
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
    recognition.start();
  };

  return (
    <div className="voice-capture">
      <button
        type="button"
        aria-label={isListening ? "Stop voice input" : "Start voice input"}
        aria-pressed={isListening}
        disabled={disabled}
        onClick={() => {
          if (isListening) recognitionRef.current?.stop();
          else void startListening();
        }}
      >
        <i aria-hidden="true" />
        <span>{isListening ? "Listening" : "Speak"}</span>
      </button>
      {error && <small role="status">{error}</small>}
    </div>
  );
}
