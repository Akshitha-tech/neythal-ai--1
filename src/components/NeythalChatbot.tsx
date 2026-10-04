import { useEffect, useRef, useState } from "react";
import {
  askNeythal,
  type ChatLanguage,
  type ChatTurn,
  NeythalChatbotError,
} from "../services/neythalChatbot";
import "./NeythalChatbot.css";

type Props = {
  safetyZone: string;
  open: boolean;
  setOpen: (value: boolean) => void;
};

type Message = ChatTurn & {
  id: number;
  source?: "ai" | "knowledge" | "safety";
};

type RecognitionResult = {
  [index: number]: { transcript: string };
};

type RecognitionLike = {
  lang: string;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => RecognitionLike;

const LANGUAGE_LABELS: Record<ChatLanguage, string> = {
  en: "English",
  ta: "தமிழ்",
  ml: "മലയാളം",
};

const SPEECH_LANGUAGES: Record<ChatLanguage, string> = {
  en: "en-IN",
  ta: "ta-IN",
  ml: "ml-IN",
};

const COPY: Record<
  ChatLanguage,
  {
    greeting: string;
    placeholder: string;
    send: string;
    close: string;
    clear: string;
    suggestions: string;
    listening: string;
    voice: string;
    loading: string;
    fallback: string;
    safeData: string;
    localNote: string;
    status: string;
    empty: string;
    tryAgain: string;
  }
> = {
  en: {
    greeting:
      "Vanakkam! I’m Neythal AI. Ask me about maritime safety using the local knowledge base.",
    placeholder: "Ask a maritime question...",
    send: "Send message",
    close: "Close Neythal AI",
    clear: "Clear conversation",
    suggestions: "SUGGESTED QUESTIONS",
    listening: "Listening...",
    voice: "Speak your question",
    loading: "Neythal is preparing a safety-focused answer...",
    fallback: "AI UNAVAILABLE · OFFLINE KNOWLEDGE · NOT LIVE",
    safeData: "LIVE DATA UNAVAILABLE",
    localNote:
      "Connected to the local AI server when available. Dashboard status is not verified live GPS.",
    status: "LOCAL AI",
    empty: "Type a question or choose a suggestion to get started.",
    tryAgain: "Try again",
  },
  ta: {
    greeting:
      "வணக்கம்! நான் Neythal AI. உள்ளூர் அறிவுத் தொகுப்பைப் பயன்படுத்தி கடல்சார் பாதுகாப்பு பற்றி கேளுங்கள்.",
    placeholder: "கடல்சார் கேள்வியைக் கேளுங்கள்...",
    send: "செய்தி அனுப்பு",
    close: "Neythal AI-ஐ மூடு",
    clear: "உரையாடலை அழி",
    suggestions: "பரிந்துரைக்கப்படும் கேள்விகள்",
    listening: "கேட்கிறது...",
    voice: "குரலில் கேளுங்கள்",
    loading: "பாதுகாப்பான பதிலை Neythal தயார் செய்கிறது...",
    fallback: "AI கிடைக்கவில்லை · உள்ளூர் அறிவு · நேரடி தகவல் அல்ல",
    safeData: "நேரடி தகவல் கிடைக்கவில்லை",
    localNote:
      "உள்ளூர் AI சேவையகம் கிடைத்தால் அதனுடன் இணையும். காட்டப்படும் நிலை சரிபார்க்கப்பட்ட நேரடி GPS அல்ல.",
    status: "உள்ளூர் AI",
    empty: "தொடங்க கேள்வியை உள்ளிடவும் அல்லது பரிந்துரையைத் தேர்வு செய்யவும்.",
    tryAgain: "மீண்டும் முயற்சி",
  },
  ml: {
    greeting:
      "നമസ്കാരം! ഞാൻ Neythal AI. പ്രാദേശിക വിജ്ഞാനം ഉപയോഗിച്ച് സമുദ്ര സുരക്ഷയെക്കുറിച്ച് ചോദിക്കൂ.",
    placeholder: "സമുദ്രവുമായി ബന്ധപ്പെട്ട ചോദ്യം ചോദിക്കൂ...",
    send: "സന്ദേശം അയയ്ക്കുക",
    close: "Neythal AI അടയ്ക്കുക",
    clear: "സംഭാഷണം മായ്ക്കുക",
    suggestions: "നിർദ്ദേശിക്കുന്ന ചോദ്യങ്ങൾ",
    listening: "കേൾക്കുന്നു...",
    voice: "ചോദ്യം സംസാരിക്കുക",
    loading: "സുരക്ഷാ മറുപടി Neythal തയ്യാറാക്കുന്നു...",
    fallback: "AI ലഭ്യമല്ല · ഓഫ്‌ലൈൻ അറിവ് · തത്സമയ വിവരമല്ല",
    safeData: "തത്സമയ വിവരം ലഭ്യമല്ല",
    localNote:
      "പ്രാദേശിക AI സെർവർ ലഭ്യമെങ്കിൽ അതിലേക്ക് ബന്ധിപ്പിക്കും. കാണിക്കുന്ന നില പരിശോധിച്ച തത്സമയ GPS അല്ല.",
    status: "പ്രാദേശിക AI",
    empty: "ആരംഭിക്കാൻ ചോദ്യം ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ നിർദ്ദേശം തിരഞ്ഞെടുക്കുക.",
    tryAgain: "വീണ്ടും ശ്രമിക്കുക",
  },
};

const SUGGESTIONS: Record<ChatLanguage, string[]> = {
  en: [
    "What should I do if I am near a maritime boundary?",
    "How should I prepare for rough seas?",
    "Can you provide live weather or vessel location?",
  ],
  ta: [
    "கடல் எல்லைக்கு அருகில் இருந்தால் என்ன செய்ய வேண்டும்?",
    "கடல் கொந்தளிப்புக்கு எப்படி தயாராக வேண்டும்?",
    "நேரடி வானிலை அல்லது படகு இருப்பிடத்தை வழங்க முடியுமா?",
  ],
  ml: [
    "സമുദ്ര അതിർത്തിക്ക് അടുത്താണെങ്കിൽ എന്ത് ചെയ്യണം?",
    "പ്രക്ഷുബ്ധമായ കടലിന് എങ്ങനെ തയ്യാറെടുക്കണം?",
    "തത്സമയ കാലാവസ്ഥയോ വള്ളത്തിന്റെ സ്ഥാനമോ നൽകാമോ?",
  ],
};

function recognitionConstructor(): RecognitionConstructor | undefined {
  const speechWindow = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

export default function NeythalChatbot({
  safetyZone,
  open,
  setOpen,
}: Props) {
  const [language, setLanguage] = useState<ChatLanguage>("en");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      content: COPY.en.greeting,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const nextId = useRef(1);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const copy = COPY[language];
  const canRecognize =
    typeof window !== "undefined" && Boolean(recognitionConstructor());
  const canSpeak =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, error]);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      if ("speechSynthesis" in window) {
        window.speechSynthesis?.cancel();
      }
    },
    [],
  );

  const startVoiceInput = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Recognition = recognitionConstructor();
    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.lang = SPEECH_LANGUAGES[language];
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setDraft(transcript.slice(0, 1000));
      }
    };
    recognition.onerror = () => {
      setError(
        language === "ta"
          ? "குரல் உள்ளீடு கிடைக்கவில்லை. உரையைத் தட்டச்சு செய்து முயற்சிக்கவும்."
          : language === "ml"
            ? "ശബ്ദ ഇൻപുട്ട് ലഭ്യമല്ല. ചോദ്യം ടൈപ്പ് ചെയ്ത് ശ്രമിക്കുക."
            : "Voice input is unavailable. Please type your question instead.",
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError("");

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setError(
        language === "ta"
          ? "குரல் உள்ளீட்டைத் தொடங்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்."
          : language === "ml"
            ? "ശബ്ദ ഇൻപുട്ട് ആരംഭിക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക."
            : "Could not start voice input. Please try again.",
      );
    }
  };

  const speakMessage = (message: Message) => {
    if (!canSpeak) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = SPEECH_LANGUAGES[language];
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeakingId(message.id);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  };

  const sendQuestion = async (rawQuestion = draft, isRetry = false) => {
    const question = rawQuestion.trim();
    if (!question || loading) {
      return;
    }
    if (question.length > 1000) {
      setError(copy.tryAgain);
      return;
    }

    const userMessage: Message = {
      id: nextId.current++,
      role: "user",
      content: question,
    };
    const earlierMessages = messages.filter((message) => message.id !== 0);
    const lastMessage = earlierMessages.at(-1);
    if (
      lastMessage?.role === "user" &&
      lastMessage.content === question
    ) {
      earlierMessages.pop();
    }
    const recentHistory = earlierMessages
      .filter((message) => message.id !== 0)
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));

    if (!isRetry) {
      setMessages((previous) => [...previous, userMessage]);
    }
    setDraft("");
    setError("");
    setLoading(true);

    try {
      const reply = await askNeythal(
        question,
        language,
        recentHistory,
        safetyZone,
      );
      setMessages((previous) => [
        ...previous,
        {
          id: nextId.current++,
          role: "assistant",
          content: reply.text,
          source: reply.source,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof NeythalChatbotError
          ? requestError.message
          : language === "ta"
            ? "பதிலைப் பெற முடியவில்லை. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்."
            : language === "ml"
              ? "മറുപടി ലഭിച്ചില്ല. കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക."
              : "Neythal could not complete the request. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();
    setListening(false);
    setSpeakingId(null);
    setMessages([
      {
        id: 0,
        role: "assistant",
        content: copy.greeting,
      },
    ]);
    setError("");
  };

  if (!open) {
    return (
      <button
        type="button"
        className="neythal-bot-launcher"
        onClick={() => setOpen(true)}
        aria-label="Open Neythal AI chat"
      >
        <span className="neythal-bot-launcher-pulse" />
        <span className="neythal-bot-launcher-mark">N</span>
        <span>NEYTHAL AI</span>
      </button>
    );
  }

  return (
    <aside
      className="neythal-chatbot"
      aria-label="Neythal AI maritime assistant"
    >
      <header className="neythal-chatbot__header">
        <div className="neythal-chatbot__identity">
          <span className="neythal-chatbot__avatar">N</span>
          <span>
            <strong>NEYTHAL AI</strong>
            <small>{copy.status} · MARITIME ASSISTANT</small>
          </span>
        </div>
        <div className="neythal-chatbot__header-actions">
          <button
            type="button"
            onClick={clearConversation}
            aria-label={copy.clear}
            title={copy.clear}
            disabled={loading}
          >
            ↺
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={copy.close}
          >
            ×
          </button>
        </div>
      </header>

      <div className="neythal-chatbot__toolbar">
        <span className="neythal-chatbot__zone">
          <i />
          {safetyZone}
        </span>
        <label>
          <span className="neythal-chatbot__visually-hidden">Language</span>
          <select
            value={language}
            onChange={(event) => {
              const nextLanguage = event.target.value as ChatLanguage;
              setLanguage(nextLanguage);
              setMessages((previous) =>
                previous.map((message) =>
                  message.id === 0
                    ? { ...message, content: COPY[nextLanguage].greeting }
                    : message,
                ),
              );
              setError("");
            }}
          >
            {(Object.keys(LANGUAGE_LABELS) as ChatLanguage[]).map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_LABELS[code]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="neythal-chatbot__notice">{copy.localNote}</p>

      <div
        className="neythal-chatbot__messages"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.map((message) => (
          <article
            key={message.id}
            className={`neythal-chatbot__message neythal-chatbot__message--${message.role}`}
          >
            <span className="neythal-chatbot__message-label">
              {message.role === "assistant" ? "NEYTHAL AI" : "YOU"}
              {message.source === "knowledge" && (
                <span className="neythal-chatbot__source">{copy.fallback}</span>
              )}
              {message.source === "safety" && (
                <span className="neythal-chatbot__source neythal-chatbot__source--safe">
                  {copy.safeData}
                </span>
              )}
            </span>
            <p>{message.content}</p>
            {message.role === "assistant" && canSpeak && (
              <button
                className="neythal-chatbot__speak"
                type="button"
                onClick={() => speakMessage(message)}
                aria-label="Read this answer aloud"
              >
                {speakingId === message.id ? "■" : "◖"}
              </button>
            )}
          </article>
        ))}

        {messages.length === 1 && (
          <div className="neythal-chatbot__suggestions">
            <span>{copy.suggestions}</span>
            {SUGGESTIONS[language].map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                onClick={() => void sendQuestion(suggestion)}
                disabled={loading}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="neythal-chatbot__typing" role="status">
            <span className="neythal-chatbot__dots">
              <i />
              <i />
              <i />
            </span>
            {copy.loading}
          </div>
        )}
        {error && (
          <div className="neythal-chatbot__error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() =>
                void sendQuestion(messages.at(-1)?.content ?? "", true)
              }
              disabled={loading || messages.at(-1)?.role !== "user"}
            >
              {copy.tryAgain}
            </button>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </div>

      <form
        className="neythal-chatbot__composer"
        onSubmit={(event) => {
          event.preventDefault();
          void sendQuestion();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendQuestion();
            }
          }}
          placeholder={copy.placeholder}
          maxLength={1000}
          rows={1}
          aria-label={copy.placeholder}
          disabled={loading}
        />
        {canRecognize && (
          <button
            type="button"
            className={`neythal-chatbot__voice${listening ? " is-listening" : ""}`}
            onClick={startVoiceInput}
            aria-label={listening ? copy.listening : copy.voice}
            title={listening ? copy.listening : copy.voice}
            disabled={loading}
          >
            {listening ? "●" : "🎙"}
          </button>
        )}
        <button
          className="neythal-chatbot__send"
          type="submit"
          aria-label={copy.send}
          disabled={loading || !draft.trim()}
        >
          ↑
        </button>
      </form>
      <footer className="neythal-chatbot__footer">
        <span>● OFFLINE-FIRST</span>
        <span>{draft.length}/1000</span>
      </footer>
    </aside>
  );
}
