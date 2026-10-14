export type ChatLanguage = "en" | "ta" | "ml";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ChatbotReply = {
  text: string;
  source: "ai" | "knowledge" | "safety";
};

type LocalizedValue = string | Record<string, unknown> | null | undefined;

type KnowledgeEntry = {
  question?: LocalizedValue;
  answer?: LocalizedValue;
  category?: LocalizedValue;
  tags?: LocalizedValue | unknown[];
  content?: LocalizedValue;
  [key: string]: unknown;
};

type RankedEntry = {
  entry: KnowledgeEntry;
  score: number;
};

const KNOWLEDGE_URL = "/neythal_maritime_knowledge.json";
const CHAT_ENDPOINT = "/api/llama/v1/chat/completions";
const MAX_QUESTION_LENGTH = 1000;
const MAX_RESPONSE_LENGTH = 2000;
const ENGLISH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "safe",
  "safety",
  "should",
  "tell",
  "the",
  "to",
  "what",
  "when",
  "where",
  "which",
  "with",
  "you",
  "your",
  "response",
]);
const LANGUAGE_NAMES: Record<ChatLanguage, string> = {
  en: "English",
  ta: "Tamil",
  ml: "Malayalam",
};
const MAX_COMPLETION_TOKENS = 128;
const MODEL_TIMEOUT_MS = 20000;

const LANGUAGE_INSTRUCTIONS: Record<ChatLanguage, string> = {
  en: "Answer in clear, simple English using complete, concise sentences.",
  ta: "தமிழில் மட்டும், எளிய இயல்பான பேச்சுத் தமிழில் சுருக்கமாகவும் முழுமையான வாக்கியங்களிலும் பதிலளிக்கவும். ஆங்கிலம் அல்லது மலையாளம் கலக்கவோ, AI அறிமுகம் அல்லது விளக்கம் தரவோ வேண்டாம். உள்சிந்தனையை வெளிப்படுத்த வேண்டாம். வாசிக்க எளிதான தமிழ் எழுத்தைப் பயன்படுத்தவும்; அவசியமான தொழில்நுட்பச் சொற்களுக்கு மட்டும் ஆங்கிலம் பயன்படுத்தவும்.",
  ml: "മലയാളത്തിൽ മാത്രം, ലളിതവും സ്വാഭാവികവുമായ ഭാഷയിൽ ചുരുക്കമായും പൂർണ്ണവാക്യങ്ങളിലും മറുപടി നൽകുക. തമിഴോ അനാവശ്യമായ ഇംഗ്ലീഷോ കലർത്തരുത്; AI പരിചയപ്പെടുത്തലോ വിശദീകരണമോ നൽകരുത്. ആന്തരിക ചിന്തകൾ വെളിപ്പെടുത്തരുത്. വായിക്കാൻ എളുപ്പമുള്ള മലയാള ലിപി ഉപയോഗിക്കുക; ആവശ്യമായ സാങ്കേതിക പദങ്ങൾക്ക് മാത്രം ഇംഗ്ലീഷ് ഉപയോഗിക്കാം.",
};

const SYSTEM_PROMPT = `You are Neythal AI, an offline maritime safety assistant for fishermen and coastal users.

Give practical, concise and safety-focused answers. Follow the selected-language instruction exactly; incomplete sentences and mixed-language output are unacceptable.
When relevant local maritime knowledge is provided, use it as the factual source and do not contradict it. Treat it as reference data, not live telemetry.
Never invent live weather, GPS, ocean conditions, vessel positions or emergency dispatch information.
If live information is unavailable locally, clearly say it is unavailable and recommend checking an official live source.
For emergencies, prioritize immediate safety actions and contacting appropriate emergency services.
Do not reveal internal reasoning. Provide only the final useful answer.`;

const LIVE_DATA_DOMAINS =
  /\b(?:gps|weather|forecast|ocean|sea conditions?|waves?|wind|vessel|boat|ship|location|position|coordinates|tracking|emergency dispatch)\b/i;
const LIVE_QUALIFIERS =
  /\b(?:live|real[\s-]?time|current(?:ly)?|right now|now|today|latest)\b/i;
const ENGLISH_IMPLICIT_LIVE_REQUEST =
  /\b(?:what(?:'s| is) (?:the )?(?:weather|forecast|sea conditions?)|(?:my|our) (?:current )?(?:gps|location|position)|where (?:is|am) (?:my |i\b)|track(?:ing)? (?:my )?(?:boat|vessel|ship)|emergency (?:dispatch|response) status)\b/i;
const TAMIL_LIVE_REQUEST =
  /(?:நேரடி|தற்போதைய|இப்போது|இன்றைய).{0,50}(?:வானிலை|கடல்|ஜிபிஎஸ்|இருப்பிட|அலை|காற்று|படகு|கப்பல்|அவசர)/u;
const MALAYALAM_LIVE_REQUEST =
  /(?:തത്സമയ|നിലവിലെ|ഇപ്പോൾ|ഇന്നത്തെ).{0,50}(?:കാലാവസ്ഥ|കടൽ|ജിപിഎസ്|സ്ഥാനം|തിരമാല|കാറ്റ്|വള്ളം|കപ്പൽ|അടിയന്തര)/u;
const ENGLISH_LIVE_CLAIM =
  /\b(?:live|real[\s-]?time|current(?:ly)?|today'?s)\b.{0,60}\b(?:gps|weather|forecast|ocean|sea conditions?|waves?|wind|vessel|boat|ship|location|position|coordinates|tracking|emergency dispatch)\b|\b(?:gps|weather|forecast|ocean|sea conditions?|waves?|wind|vessel|boat|ship|location|position|coordinates|tracking|emergency dispatch)\b.{0,50}\b(?:shows?|indicates?|reports?|located at|currently at|dispatched|on its way)\b|\b(?:your|my|the)\s+(?:vessel|boat|ship|gps|location|position)\b.{0,40}\b(?:is|located at|currently at)\s+(?:at\s+)?[-+]?\d/i;
const TAMIL_LIVE_CLAIM =
  /(?:நேரடி|தற்போதைய|இப்போது).{0,60}(?:ஜிபிஎஸ்|வானிலை|கடல்|அலை|காற்று|படகு|கப்பல்|இருப்பிட|அவசர)/u;
const MALAYALAM_LIVE_CLAIM =
  /(?:തത്സമയ|നിലവിലെ|ഇപ്പോൾ).{0,60}(?:ജിപിഎസ്|കാലാവസ്ഥ|കടൽ|തിരമാല|കാറ്റ്|വള്ളം|കപ്പൽ|സ്ഥാനം|അടിയന്തര)/u;

let knowledgePromise: Promise<KnowledgeEntry[]> | undefined;

export class NeythalChatbotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeythalChatbotError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractKnowledgeEntries(value: unknown): KnowledgeEntry[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord) as KnowledgeEntry[];
  }

  if (!isRecord(value)) {
    throw new NeythalChatbotError(
      "The offline maritime knowledge file has an invalid format.",
    );
  }

  for (const key of ["entries", "items", "knowledge", "data", "questions"]) {
    const candidate = value[key];
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord) as KnowledgeEntry[];
    }
  }

  if ("question" in value || "answer" in value || "content" in value) {
    return [value as KnowledgeEntry];
  }

  throw new NeythalChatbotError(
    "The offline maritime knowledge file has an invalid format.",
  );
}

async function loadKnowledge(): Promise<KnowledgeEntry[]> {
  if (!knowledgePromise) {
    knowledgePromise = fetch(KNOWLEDGE_URL).then(async (response) => {
      if (!response.ok) {
        throw new NeythalChatbotError(
          "The offline maritime knowledge file could not be loaded.",
        );
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new NeythalChatbotError(
          "The offline maritime knowledge file contains invalid JSON.",
        );
      }

      return extractKnowledgeEntries(data);
    });
  }

  try {
    return await knowledgePromise;
  } catch (error) {
    knowledgePromise = undefined;
    throw error;
  }
}

function languageKeys(language: ChatLanguage): string[] {
  switch (language) {
    case "ta":
      return ["ta", "tamil", "தமிழ்", "en", "english"];
    case "ml":
      return ["ml", "malayalam", "മലയാളം", "en", "english"];
    default:
      return ["en", "english", "ta", "tamil"];
  }
}

function localizedText(value: unknown, language: ChatLanguage): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => localizedText(item, language))
      .filter(Boolean)
      .join(", ");
  }

  if (!isRecord(value)) {
    return "";
  }

  for (const key of languageKeys(language)) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  const firstText = Object.values(value).find(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
  return firstText?.trim() ?? "";
}

function exactLanguageText(value: unknown, language: ChatLanguage): string {
  if (!isRecord(value)) {
    return language === "en" && typeof value === "string" ? value.trim() : "";
  }

  const keys =
    language === "ta"
      ? ["ta", "tamil", "தமிழ்"]
      : language === "ml"
        ? ["ml", "malayalam", "മലയാളം"]
        : ["en", "english"];

  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((token) => token && !ENGLISH_STOP_WORDS.has(token)),
  );
}

function entryFields(
  entry: KnowledgeEntry,
  language: ChatLanguage,
): Array<{ weight: number; value: string }> {
  return [
    { weight: 4, value: localizedText(entry.question, language) },
    { weight: 3, value: localizedText(entry.tags, language) },
    { weight: 2, value: localizedText(entry.category, language) },
    { weight: 2, value: localizedText(entry.answer, language) },
    { weight: 1, value: localizedText(entry.content, language) },
  ];
}

function retrieveRelevantEntries(
  question: string,
  entries: KnowledgeEntry[],
  language: ChatLanguage,
): KnowledgeEntry[] {
  const questionTokens = tokens(question);
  if (questionTokens.size === 0) {
    return [];
  }

  const ranked: RankedEntry[] = entries.map((entry) => {
    let score = 0;
    const fields = entryFields(entry, language);

    for (const { weight, value } of fields) {
      const normalizedField = normalize(value);
      if (!normalizedField) {
        continue;
      }

      const fieldTokens = tokens(normalizedField);
      const matchedTokens = [...questionTokens].filter((token) =>
        fieldTokens.has(token),
      ).length;
      score += (matchedTokens / questionTokens.size) * weight;

      const normalizedQuestion = normalize(question);
      if (
        weight === 4 &&
        normalizedQuestion.length > 2 &&
        normalizedField.includes(normalizedQuestion)
      ) {
        score += 4;
      }
    }

    return { entry, score };
  });

  return ranked
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ entry }) => entry);
}

function entryContext(
  entry: KnowledgeEntry,
  language: ChatLanguage,
  index: number,
): string {
  const fields = [
    ["Question", entry.question],
    ["Answer", entry.answer],
    ["Category", entry.category],
    ["Tags", entry.tags],
    ["Content", entry.content],
  ] as const;

  const rendered = fields
    .map(([label, value]) => {
      const text = localizedText(value, language).slice(0, 700);
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean);

  return `Knowledge entry ${index + 1}:\n${rendered.join("\n")}`;
}

function fallbackText(
  entries: KnowledgeEntry[],
  language: ChatLanguage,
): string | undefined {
  const entry = entries[0];
  if (!entry) {
    return undefined;
  }

  const answer = localizedText(entry.answer, language);
  const content = localizedText(entry.content, language);
  const text = answer || content;
  return text ? text.slice(0, MAX_RESPONSE_LENGTH) : undefined;
}

function safeError(language: ChatLanguage, reason: "dataset" | "no-match") {
  const messages: Record<ChatLanguage, Record<typeof reason, string>> = {
    en: {
      dataset:
        "Neythal's offline maritime knowledge could not be loaded. Please check that the local knowledge file is available, then try again.",
      "no-match":
        "The local AI server is unavailable and no matching answer was found in the offline maritime knowledge. For urgent safety decisions, contact the appropriate maritime emergency service.",
    },
    ta: {
      dataset:
        "Neythal-ன் இணையமற்ற கடல்சார் அறிவுத் தொகுப்பை ஏற்ற முடியவில்லை. உள்ளூர் அறிவுக் கோப்பு உள்ளதா எனச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
      "no-match":
        "உள்ளூர் AI சேவையகம் கிடைக்கவில்லை; இணையமற்ற கடல்சார் அறிவுத் தொகுப்பிலும் பொருத்தமான பதில் இல்லை. அவசர பாதுகாப்பு முடிவுகளுக்கு உரிய கடல்சார் அவசர சேவையைத் தொடர்புகொள்ளவும்.",
    },
    ml: {
      dataset:
        "Neythal-ന്റെ ഓഫ്‌ലൈൻ സമുദ്ര വിജ്ഞാനം ലോഡ് ചെയ്യാനായില്ല. പ്രാദേശിക വിജ്ഞാന ഫയൽ ലഭ്യമാണെന്ന് ഉറപ്പാക്കി വീണ്ടും ശ്രമിക്കുക.",
      "no-match":
        "പ്രാദേശിക AI സെർവർ ലഭ്യമല്ല; ഓഫ്‌ലൈൻ സമുദ്ര വിജ്ഞാനത്തിലും അനുയോജ്യമായ മറുപടി കണ്ടെത്താനായില്ല. അടിയന്തര സുരക്ഷാ കാര്യങ്ങൾക്ക് ബന്ധപ്പെട്ട സമുദ്ര അടിയന്തര സേവനവുമായി ബന്ധപ്പെടുക.",
    },
  };
  return messages[language][reason];
}

function cleanModelResponse(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const text = value
    .replace(/<think(?:\s[^>]*)?>[\s\S]*?<\/think>/gi, "")
    .replace(/<think(?:\s[^>]*)?>[\s\S]*$/i, "")
    .replace(/<\/?final>/gi, "")
    .trim();

  if (!text || text.length > MAX_RESPONSE_LENGTH) {
    return undefined;
  }
  return text;
}

function isLiveDataRequest(question: string): boolean {
  if (
    ENGLISH_IMPLICIT_LIVE_REQUEST.test(question) ||
    TAMIL_LIVE_REQUEST.test(question) ||
    MALAYALAM_LIVE_REQUEST.test(question)
  ) {
    return true;
  }
  return LIVE_QUALIFIERS.test(question) && LIVE_DATA_DOMAINS.test(question);
}

function containsUnsupportedLiveClaim(text: string): boolean {
  return (
    ENGLISH_LIVE_CLAIM.test(text) ||
    TAMIL_LIVE_CLAIM.test(text) ||
    MALAYALAM_LIVE_CLAIM.test(text)
  );
}

function liveDataUnavailable(language: ChatLanguage): string {
  const messages: Record<ChatLanguage, string> = {
    en: "I can't access live weather, GPS, ocean conditions, vessel positions, or emergency dispatch in this app. Please check an official live source; for an emergency, contact the appropriate maritime emergency service directly.",
    ta: "இந்த பயன்பாட்டில் நேரடி வானிலை, GPS, கடல் நிலை, படகு இருப்பிடம் அல்லது அவசர சேவை அனுப்பப்பட்டதா என்பதைப் பார்க்க முடியாது. அதிகாரப்பூர்வ நேரடி தகவலைச் சரிபார்க்கவும்; அவசரத்தில் உரிய கடல்சார் அவசர சேவையை நேரடியாகத் தொடர்புகொள்ளவும்.",
    ml: "ഈ ആപ്പിൽ തത്സമയ കാലാവസ്ഥ, GPS, കടൽസ്ഥിതി, വള്ളത്തിന്റെ സ്ഥാനം, അല്ലെങ്കിൽ അടിയന്തര സേവനം അയച്ചിട്ടുണ്ടോ എന്ന് പരിശോധിക്കാനാവില്ല. ഔദ്യോഗിക തത്സമയ ഉറവിടം പരിശോധിക്കുക; അടിയന്തരാവസ്ഥയിൽ ബന്ധപ്പെട്ട സമുദ്ര അടിയന്തര സേവനവുമായി നേരിട്ട് ബന്ധപ്പെടുക.",
  };
  return messages[language];
}

async function requestModel(
  question: string,
  language: ChatLanguage,
  history: ChatTurn[],
  relevantEntries: KnowledgeEntry[],
  safetyZone: string,
): Promise<string | undefined> {
  const context = relevantEntries.length
    ? relevantEntries
        .map((entry, index) => entryContext(entry, language, index))
        .join("\n\n")
    : "No matching local knowledge entries were found.";

  const systemMessage = [
    SYSTEM_PROMPT,
    `Selected response language (hard requirement): ${LANGUAGE_NAMES[language]}. ${LANGUAGE_INSTRUCTIONS[language]}`,
    "Keep the final answer short and practical. Do not output reasoning, fragments, or mixed-language sentences.",
    `Dashboard safety indicator: ${safetyZone}. This is application UI state, not verified live GPS or vessel data.`,
    `Local maritime knowledge context:\n${context}`,
  ].join("\n\n");
  const messages = [
    { role: "system", content: systemMessage },
    ...history.slice(-8).map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, MAX_QUESTION_LENGTH),
    })),
    {
      role: "user",
      content:
        language !== "en" && relevantEntries.length > 0
          ? `Required response language: ${LANGUAGE_NAMES[language]}. ${LANGUAGE_INSTRUCTIONS[language]}\nFor this answer, copy the following localized maritime source answer exactly; do not paraphrase or change any safety instruction:\n${exactLanguageText(relevantEntries[0].answer, language) || "No matching source answer in the selected language."}\nQuestion: ${question}`
          : `Answer in ${LANGUAGE_NAMES[language]}: ${question}`,
    },
  ];

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    MODEL_TIMEOUT_MS,
  );

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "Qwen3-0.6B-Q8_0.gguf",
        messages,
        temperature: 0.2,
        max_tokens: MAX_COMPLETION_TOKENS,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });

    if (!response.ok) {
      return undefined;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return undefined;
    }

    if (!isRecord(payload) || !Array.isArray(payload.choices)) {
      return undefined;
    }

    const choice = payload.choices[0];
    if (!isRecord(choice) || !isRecord(choice.message)) {
      return undefined;
    }

    return cleanModelResponse(choice.message.content);
  } catch {
    return undefined;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function askNeythal(
  rawQuestion: string,
  language: ChatLanguage,
  history: ChatTurn[],
  safetyZone: string,
): Promise<ChatbotReply> {
  const question = rawQuestion.trim();
  if (!question) {
    throw new NeythalChatbotError("");
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new NeythalChatbotError(
      language === "ta"
        ? "கேள்வி 1000 எழுத்துகளுக்குள் இருக்க வேண்டும்."
        : language === "ml"
          ? "ചോദ്യം 1000 അക്ഷരങ്ങളിൽ കവിയരുത്."
          : "Please keep your question under 1000 characters.",
    );
  }

  let entries: KnowledgeEntry[];
  try {
    entries = await loadKnowledge();
  } catch {
    throw new NeythalChatbotError(safeError(language, "dataset"));
  }

  const relevantEntries = retrieveRelevantEntries(question, entries, language);
  if (isLiveDataRequest(question)) {
    return { text: liveDataUnavailable(language), source: "safety" };
  }

  if (language !== "en" && relevantEntries.length > 0) {
    const localizedAnswer = exactLanguageText(
      relevantEntries[0].answer,
      language,
    );
    if (localizedAnswer) {
      if (containsUnsupportedLiveClaim(localizedAnswer)) {
        return { text: liveDataUnavailable(language), source: "safety" };
      }
      return { text: localizedAnswer, source: "knowledge" };
    }
  }

  const modelAnswer = await requestModel(
    question,
    language,
    history,
    relevantEntries,
    safetyZone,
  );

  if (modelAnswer) {
    if (containsUnsupportedLiveClaim(modelAnswer)) {
      return { text: liveDataUnavailable(language), source: "safety" };
    }
    return { text: modelAnswer, source: "ai" };
  }

  const localAnswer = fallbackText(relevantEntries, language);
  if (localAnswer) {
    if (containsUnsupportedLiveClaim(localAnswer)) {
      return { text: liveDataUnavailable(language), source: "safety" };
    }
    return { text: localAnswer, source: "knowledge" };
  }

  throw new NeythalChatbotError(safeError(language, "no-match"));
}
