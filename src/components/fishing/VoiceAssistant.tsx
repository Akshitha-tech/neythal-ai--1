import { useEffect, useRef, useState } from "react";
import type { FishingLanguage, FishingCopy } from "../../i18n/fishing";
import { fishingLocales } from "../../i18n/fishing";
import type { DataSource } from "../../services/fishing/types";

type AssistantState = "READY" | "LISTENING" | "SPEAKING";
type SpeechIntent = "suitability" | "temperature" | "wind" | "species" | "favorable";

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult extends ArrayLike<RecognitionAlternative> {
  isFinal: boolean;
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export interface VoiceIntelligence {
  score: number;
  classification: string;
  temperature: string;
  waves: string;
  wind: string;
  species: string;
  source: DataSource;
}

function getSpeechIntent(transcript: string): SpeechIntent {
  const question = transcript.toLocaleLowerCase();

  if (
    /temperature|sea temp|sea temperature|வெப்பநிலை|வெப்பம்|താപനില|ചൂട്/.test(
      question
    )
  ) return "temperature";
  if (/wind|காற்று|കാറ്റ്/.test(question)) return "wind";
  if (
    /species|target fish|fish (?:type|varieties)|இனம்|மீன் வகை|മത്സ്യ ഇനം|മത്സ്യങ്ങൾ/.test(
      question
    )
  ) {
    return "species";
  }
  if (/favorable|favourable|good|நல்லதா|சாதக|അനുകൂല|നല്ലതാണോ/.test(question)) {
    return "favorable";
  }
  return "suitability";
}

function createAnswer(
  transcript: string,
  intelligence: VoiceIntelligence,
  copy: FishingCopy
): string {
  const intent = getSpeechIntent(transcript);
  let answer: string;

  switch (intent) {
    case "temperature":
      answer = copy.temperatureAnswer(intelligence.temperature);
      break;
    case "wind":
      answer = copy.windAnswer(intelligence.wind);
      break;
    case "species":
      answer = copy.speciesAnswer(intelligence.species);
      break;
    case "favorable":
      answer = copy.favorableAnswer(intelligence.score, intelligence.classification);
      break;
    default:
      answer = copy.suitabilityAnswer(
        intelligence.score,
        intelligence.classification,
        intelligence.temperature,
        intelligence.waves
      );
  }

  return intelligence.source === "SIMULATED"
    ? `${answer} ${copy.simulatedWarning}`
    : answer;
}

export default function VoiceAssistant({
  language,
  copy,
  intelligence,
}: {
  language: FishingLanguage;
  copy: FishingCopy;
  intelligence: VoiceIntelligence;
}) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const stateRef = useRef<AssistantState>("READY");
  const [assistantState, setAssistantState] = useState<AssistantState>("READY");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");

  const setState = (next: AssistantState) => {
    stateRef.current = next;
    setAssistantState(next);
  };

  const speechWindow =
    typeof window === "undefined" ? null : (window as SpeechWindow);
  const Recognition =
    speechWindow?.SpeechRecognition ?? speechWindow?.webkitSpeechRecognition;
  const stateLabel =
    assistantState === "READY"
      ? copy.ready
      : assistantState === "LISTENING"
        ? copy.listening
        : copy.speaking;
  const canSpeak =
    typeof window !== "undefined" &&
    typeof window.speechSynthesis?.speak === "function" &&
    typeof SpeechSynthesisUtterance !== "undefined";

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      if (
        typeof window !== "undefined" &&
        typeof window.speechSynthesis?.cancel === "function"
      ) {
        window.speechSynthesis.cancel();
      }
    },
    []
  );

  const startListening = () => {
    if (!Recognition) return;

    setFeedback("");
    setAnswer("");
    try {
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = fishingLocales[language];
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = event.results[event.resultIndex]?.[0]?.transcript;
        if (!transcript) return;

        const response = createAnswer(transcript, intelligence, copy);
        setAnswer(response);
        recognition.stop();

        if (!canSpeak) {
          setFeedback(copy.speechOutputUnsupported);
          setState("READY");
          return;
        }

        try {
          if (typeof window.speechSynthesis.cancel === "function") {
            window.speechSynthesis.cancel();
          }
          const utterance = new SpeechSynthesisUtterance(response);
          utterance.lang = fishingLocales[language];
          utterance.rate = 0.92;
          utterance.onend = () => setState("READY");
          utterance.onerror = () => {
            setFeedback(copy.speechOutputUnsupported);
            setState("READY");
          };
          setState("SPEAKING");
          window.speechSynthesis.speak(utterance);
        } catch {
          setFeedback(copy.speechOutputUnsupported);
          setState("READY");
        }
      };
      recognition.onerror = () => {
        setFeedback(copy.voiceError);
        setState("READY");
      };
      recognition.onend = () => {
        if (stateRef.current === "LISTENING") setState("READY");
      };
      setState("LISTENING");
      recognition.start();
    } catch {
      setFeedback(copy.voiceError);
      setState("READY");
    }
  };

  return (
    <section className="marine-voice" aria-label={copy.voiceAssistant}>
      <div className="marine-voice-heading">
        <div>
          <span className="advisory-title">{copy.voiceAssistant}</span>
          <p>{copy.listeningPrompt}</p>
        </div>
        <span className={`marine-voice-state ${assistantState.toLowerCase()}`}>
          {stateLabel}
        </span>
      </div>
      <button
        className="marine-voice-button"
        type="button"
        onClick={startListening}
        disabled={!Recognition || assistantState === "LISTENING"}
        aria-label={copy.microphone}
        title={copy.microphone}
      >
        <span aria-hidden="true">🎙</span>
        {copy.microphone}
      </button>
      {!Recognition && (
        <p className="marine-voice-feedback" role="status">
          {copy.voiceInputUnsupported}
        </p>
      )}
      {feedback && (
        <p className="marine-voice-feedback" role="status">{feedback}</p>
      )}
      {answer && <p className="marine-voice-answer" aria-live="polite">{answer}</p>}
    </section>
  );
}
