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
const ROMANIZED_SEARCH_ALIASES: Record<string, string[]> = {
  alai: ["wave"],
  athirthi: ["boundary"],
  kaatru: ["wind"],
  kaattu: ["wind"],
  kadal: ["sea", "ocean"],
  kadalil: ["sea", "ocean"],
  meen: ["fish", "fishing"],
  meenpidikka: ["fish", "fishing"],
  meenpidutham: ["fish", "fishing"],
  paathukaappu: ["safety"],
  puyal: ["storm"],
  thiramaala: ["wave"],
};
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
  "that",
  "this",
  "mean",
  "about",
  "explain",
  "simple",
  "simply",
  "என்ன",
  "நீ",
  "நீங்கள்",
  "செய்ய",
  "செய்யும்",
  "முடியும்",
  "வேண்டும்",
  "எப்படி",
  "எது",
  "எங்கே",
  "என்னால்",
  "നീ",
  "നിനക്ക്",
  "നിങ്ങൾ",
  "എന്ത്",
  "എന്തൊക്കെ",
  "ചെയ്യാൻ",
  "ചെയ്യാം",
  "കഴിയും",
  "വേണം",
  "എങ്ങനെ",
  "എവിടെ",
]);
const LANGUAGE_NAMES: Record<ChatLanguage, string> = {
  en: "English",
  ta: "Tamil",
  ml: "Malayalam",
};
const MAX_COMPLETION_TOKENS = 128;
const MODEL_TIMEOUT_MS = 12000;

const LANGUAGE_INSTRUCTIONS: Record<ChatLanguage, string> = {
  en: "Answer in clear, simple English using complete, concise sentences.",
  ta: "தமிழில் மட்டும், எளிய இயல்பான பேச்சுத் தமிழில் சுருக்கமாகவும் முழுமையான வாக்கியங்களிலும் பதிலளிக்கவும். ஆங்கிலம் அல்லது மலையாளம் கலக்கவோ, AI அறிமுகம் அல்லது விளக்கம் தரவோ வேண்டாம். உள்சிந்தனையை வெளிப்படுத்த வேண்டாம். வாசிக்க எளிதான தமிழ் எழுத்தைப் பயன்படுத்தவும்; அவசியமான தொழில்நுட்பச் சொற்களுக்கு மட்டும் ஆங்கிலம் பயன்படுத்தவும்.",
  ml: "മലയാളത്തിൽ മാത്രം, ലളിതവും സ്വാഭാവികവുമായ ഭാഷയിൽ ചുരുക്കമായും പൂർണ്ണവാക്യങ്ങളിലും മറുപടി നൽകുക. തമിഴോ അനാവശ്യമായ ഇംഗ്ലീഷോ കലർത്തരുത്; AI പരിചയപ്പെടുത്തലോ വിശദീകരണമോ നൽകരുത്. ആന്തരിക ചിന്തകൾ വെളിപ്പെടുത്തരുത്. വായിക്കാൻ എളുപ്പമുള്ള മലയാള ലിപി ഉപയോഗിക്കുക; ആവശ്യമായ സാങ്കേതിക പദങ്ങൾക്ക് മാത്രം ഇംഗ്ലീഷ് ഉപയോഗിക്കാം.",
};

const ROMANIZED_TAMIL_TERMS = new Set([
  "aama",
  "aachu",
  "enna",
  "epdi",
  "eppadi",
  "iruka",
  "irukku",
  "inniku",
  "innaiku",
  "innaiki",
  "kadal",
  "kaatru",
  "meen",
  "meenpidikka",
  "paathukaappu",
  "puyal",
  "naalai",
  "poganuma",
  "poga",
  "sollunga",
  "pogalama",
  "sollu",
  "sollunga",
  "vanakkam",
  "venum",
]);
const ROMANIZED_MALAYALAM_TERMS = new Set([
  "aano",
  "cheyyam",
  "engane",
  "enthanu",
  "innu",
  "kadalu",
  "kadalil",
  "kaattu",
  "meen",
  "meenpidutham",
  "namaskaram",
  "nale",
  "naale",
  "pokan",
  "povam",
  "parayamo",
  "parayu",
  "parayan",
  "cheyyanam",
  "surakshithamano",
  "thiramaala",
  "undo",
  "venam",
]);

export function detectChatLanguage(
  message: string,
  preferredLanguage: ChatLanguage = "en",
): ChatLanguage {
  const tamilLetters = message.match(/[\u0B80-\u0BFF]/gu)?.length ?? 0;
  const malayalamLetters = message.match(/[\u0D00-\u0D7F]/gu)?.length ?? 0;
  if (tamilLetters > malayalamLetters) return "ta";
  if (malayalamLetters > tamilLetters) return "ml";

  const words = normalize(message).split(" ");
  const tamilScore = words.filter((word) => ROMANIZED_TAMIL_TERMS.has(word)).length;
  const malayalamScore = words.filter((word) =>
    ROMANIZED_MALAYALAM_TERMS.has(word),
  ).length;
  if (tamilScore > malayalamScore) return "ta";
  if (malayalamScore > tamilScore) return "ml";

  return /[\p{L}\p{N}]/u.test(message) ? "en" : preferredLanguage;
}

const SYSTEM_PROMPT = `You are Neythal AI, an offline maritime safety assistant for fishermen and coastal users.

Give practical, concise and safety-focused answers. Follow the selected-language instruction exactly; incomplete sentences and mixed-language output are unacceptable.
When relevant local maritime knowledge is provided, use it as the factual source and do not contradict it. Treat it as reference data, not live telemetry.
Never invent live weather, GPS, ocean conditions, vessel positions or emergency dispatch information.
If live information is unavailable locally, clearly say it is unavailable and recommend checking an official live source.
For emergencies, prioritize immediate safety actions and contacting appropriate emergency services.
Do not reveal internal reasoning. Provide only the final useful answer.`;

const LIVE_QUALIFIERS =
  /\b(?:live|real[\s-]?time|current(?:ly)?|right now|now|today|latest)\b/i;
const ENGLISH_IMPLICIT_LIVE_REQUEST =
  /\b(?:what(?:'s| is) (?:the )?(?:weather|forecast|sea conditions?)|(?:my|our) (?:current )?(?:gps|location|position)|where (?:is|am) (?:my |i\b)|track(?:ing)? (?:my )?(?:boat|vessel|ship)|emergency (?:dispatch|response) status)\b/i;
const TAMIL_LIVE_REQUEST =
  /(?:நேரடி|தற்போதைய|இப்போது|இன்றைய).{0,50}(?:வானிலை|கடல்|ஜிபிஎஸ்|இருப்பிட|அலை|காற்று|படகு|கப்பல்|அவசர)/u;
const MALAYALAM_LIVE_REQUEST =
  /(?:തത്സമയ|നിലവിലെ|ഇപ്പോൾ|ഇന്നത്തെ).{0,50}(?:കാലാവസ്ഥ|കടൽ|ജിപിഎസ്|സ്ഥാനം|തിരമാല|കാറ്റ്|വള്ളം|കപ്പൽ|അടിയന്തര)/u;
const ENGLISH_LIVE_CLAIM =
  /\b(?:live|real[\s-]?time|current(?:ly)?|today'?s)\b.{0,60}\b(?:gps|weather|forecast|ocean|sea conditions?|waves?|wind|vessel|boat|ship|location|position|coordinates|tracking|emergency dispatch)\b|\b(?:gps|weather|forecast|ocean|sea conditions?|waves?|wind|vessel|boat|ship|location|position|coordinates|tracking|emergency dispatch)\b.{0,45}\b(?:shows?|indicates?|reports?|is|are)\b.{0,30}\b[-+]?\d+(?:\.\d+)?\s*(?:m\/s|km\/h|knots?|m|ft|degrees?|°|coordinates?)\b|\b(?:your|my|the)\s+(?:vessel|boat|ship|gps|location|position)\b.{0,40}\b(?:is|located at|currently at)\s+(?:at\s+)?[-+]?\d/i;
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
  const result = new Set(
    normalize(text)
      .split(" ")
      .filter((token) => token && !ENGLISH_STOP_WORDS.has(token)),
  );
  for (const token of result) {
    for (const alias of ROMANIZED_SEARCH_ALIASES[token] ?? []) {
      result.add(alias);
    }
  }
  return result;
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
  const querySegments = question
    .split(/[.!?;।！？]+/u)
    .map(tokens)
    .filter((segment) => segment.size > 0);
  if (querySegments.length === 0) {
    return [];
  }

  const ranked: RankedEntry[] = entries.map((entry) => {
    const fields = entryFields(entry, language);
    const score = Math.max(
      ...querySegments.map((questionTokens) => {
        const semanticFields = fields.slice(0, 3);
        const hasSemanticMatch = semanticFields.some(({ value }) => {
          const fieldTokens = tokens(value);
          return [...questionTokens].some((token) => fieldTokens.has(token));
        });
        if (!hasSemanticMatch) return 0;

        let segmentScore = 0;
        const normalizedQuestion = [...questionTokens].join(" ");
        for (const { weight, value } of fields) {
          const normalizedField = normalize(value);
          if (!normalizedField) continue;

          const fieldTokens = tokens(normalizedField);
          const matchedTokens = [...questionTokens].filter((token) =>
            fieldTokens.has(token),
          ).length;
          segmentScore += (matchedTokens / questionTokens.size) * weight;

          if (
            weight === 4 &&
            normalizedQuestion.length > 2 &&
            normalizedField.includes(normalizedQuestion)
          ) {
            segmentScore += 4;
          }
        }
        return segmentScore;
      }),
    );

    return { entry, score };
  });

  return ranked
    .filter(({ score }) => score >= 1.25)
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
  const text = entries
    .map((entry) => {
      const answer = exactLanguageText(entry.answer, language);
      const content = exactLanguageText(entry.content, language);
      return answer || content;
    })
    .filter((answer, index, answers) => answer && answers.indexOf(answer) === index)
    .slice(0, 3)
    .join("\n\n");
  return text && responseUsesLanguage(text, language)
    ? text.slice(0, MAX_RESPONSE_LENGTH)
    : undefined;
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

function responseUsesLanguage(text: string, language: ChatLanguage): boolean {
  const latinLetters = text.match(/[A-Za-z]/gu)?.length ?? 0;
  if (language === "ta") {
    const tamilLetters = text.match(/[\u0B80-\u0BFF]/gu)?.length ?? 0;
    return tamilLetters >= 3 && tamilLetters >= latinLetters * 0.35;
  }
  if (language === "ml") {
    const malayalamLetters = text.match(/[\u0D00-\u0D7F]/gu)?.length ?? 0;
    return malayalamLetters >= 3 && malayalamLetters >= latinLetters * 0.35;
  }
  return (
    !/[\u0B80-\u0BFF]/u.test(text) &&
    !/[\u0D00-\u0D7F]/u.test(text)
  );
}

function emergencyResponse(language: ChatLanguage): string {
  const messages: Record<ChatLanguage, string> = {
    en: "If anyone is in immediate danger, contact the local maritime emergency service now and share your position if known. Put on life jackets, keep the crew together, use the vessel's distress equipment, and follow official instructions. Do not enter the water unless staying aboard is more dangerous.",
    ta: "யாருக்காவது உடனடி ஆபத்து இருந்தால், உள்ளூர் கடல்சார் அவசர சேவையை இப்போதே தொடர்புகொண்டு, தெரிந்தால் உங்கள் இருப்பிடத்தைத் தெரிவிக்கவும். உயிர்காப்பு அங்கிகளை அணிந்து, குழுவினர் ஒன்றாக இருக்கவும்; படகின் அவசரத் தொடர்பு சாதனத்தைப் பயன்படுத்தி அதிகாரிகளின் அறிவுறுத்தலைப் பின்பற்றவும். படகில் இருப்பது அதிக ஆபத்தாக இல்லாவிட்டால் கடலில் இறங்க வேண்டாம்.",
    ml: "ആർക്കെങ്കിലും ഉടൻ അപകടമുണ്ടെങ്കിൽ പ്രാദേശിക സമുദ്ര അടിയന്തര സേവനവുമായി ഇപ്പോൾ തന്നെ ബന്ധപ്പെടുക; അറിയാമെങ്കിൽ നിങ്ങളുടെ സ്ഥാനം അറിയിക്കുക. ലൈഫ് ജാക്കറ്റ് ധരിച്ച് സംഘമായി തുടരുക, ബോട്ടിലെ ദുരന്തസൂചനാ ഉപകരണങ്ങൾ ഉപയോഗിച്ച് അധികൃതരുടെ നിർദ്ദേശങ്ങൾ പാലിക്കുക. ബോട്ടിൽ തുടരുന്നത് കൂടുതൽ അപകടകരമല്ലെങ്കിൽ വെള്ളത്തിലേക്ക് ഇറങ്ങരുത്.",
  };
  return messages[language];
}

function capabilitiesResponse(language: ChatLanguage): string {
  const messages: Record<ChatLanguage, string> = {
    en: "I can explain fishing safety, maritime boundaries, emergency preparation, fishing conditions, and the app's maps and safety features. I can use local knowledge offline, but I cannot verify live weather, sea conditions, GPS, or vessel positions unless a live data service is connected.",
    ta: "மீன்பிடிப் பாதுகாப்பு, கடல் எல்லைகள், அவசரத் தயாரிப்பு, மீன்பிடி நிலைமைகள், மேலும் இந்த செயலியின் வரைபடம் மற்றும் பாதுகாப்பு அம்சங்கள் பற்றி விளக்க முடியும். உள்ளூர் தகவலை இணையமின்றியும் பயன்படுத்துவேன்; நேரடி தரவு சேவை இணைக்கப்படாவிட்டால் வானிலை, கடல் நிலை, GPS அல்லது படகு இருப்பிடத்தைச் சரிபார்க்க முடியாது.",
    ml: "മത്സ്യബന്ധന സുരക്ഷ, സമുദ്ര അതിർത്തികൾ, അടിയന്തര തയ്യാറെടുപ്പ്, മത്സ്യബന്ധന സാഹചര്യങ്ങൾ, ആപ്പിലെ ഭൂപടങ്ങളും സുരക്ഷാ സൗകര്യങ്ങളും എന്നിവ വിശദീകരിക്കാം. പ്രാദേശിക അറിവ് ഓഫ്‌ലൈനായി നൽകാം; ലൈവ് ഡാറ്റാ സേവനം ബന്ധിപ്പിച്ചിട്ടില്ലെങ്കിൽ കാലാവസ്ഥ, കടൽസ്ഥിതി, GPS, ബോട്ടിന്റെ സ്ഥാനം എന്നിവ സ്ഥിരീകരിക്കാനാവില്ല.",
  };
  return messages[language];
}

function greetingResponse(language: ChatLanguage): string {
  const messages: Record<ChatLanguage, string> = {
    en: "Hello! What would you like to know about fishing, sea safety, or the NEYTHAL app?",
    ta: "வணக்கம்! மீன்பிடி, கடல் பாதுகாப்பு அல்லது NEYTHAL செயலி பற்றி என்ன தெரிந்துகொள்ள விரும்புகிறீர்கள்?",
    ml: "നമസ്കാരം! മത്സ്യബന്ധനം, സമുദ്ര സുരക്ഷ, അല്ലെങ്കിൽ NEYTHAL ആപ്പിനെക്കുറിച്ച് എന്താണ് അറിയേണ്ടത്?",
  };
  return messages[language];
}

function isLiveDataRequest(question: string): boolean {
  if (
    ENGLISH_IMPLICIT_LIVE_REQUEST.test(question) ||
    TAMIL_LIVE_REQUEST.test(question) ||
    MALAYALAM_LIVE_REQUEST.test(question) ||
    /(?:என்|எங்களின்).{0,20}(?:ஜிபிஎஸ்|இருப்பிட|அமைவிட)/u.test(question) ||
    /(?:എന്റെ|ഞങ്ങളുടെ).{0,20}(?:ജിപിഎസ്|സ്ഥാനം|ലൊക്കേഷൻ)/u.test(question)
  ) {
    return true;
  }

  const normalized = normalize(question);
  const nativeOrRomanizedDomain =
    /(?:வானிலை|கடல்|அலை|காற்று|ஓட்டம்|ஜிபிஎஸ்|இருப்பிடம்|மீன்பிடி|மீன் பிடி)/u.test(
      question,
    ) ||
    /(?:കാലാവസ്ഥ|കടൽ|തിരമാല|കാറ്റ്|ഒഴുക്ക്|ജിപിഎസ്|സ്ഥാനം|മത്സ്യബന്ധനം|മീൻ പിടി)/u.test(
      question,
    ) ||
    /\b(?:kadal|meen|kaattu|alai|nilavaram|idam|meenpidikk|inniku|innaiku|innu|nale|naalai)\b/i.test(
      normalized,
    );
  const temporal =
    LIVE_QUALIFIERS.test(question) ||
    /(?:இன்று|இன்றைக்கு|நாளை|தற்போது|இப்போது)/u.test(question) ||
    /(?:ഇന്ന്|നാളെ|ഇപ്പോൾ|നിലവിൽ)/u.test(question) ||
    /\b(?:inniku|innaiku|innu|nale|naalai)\b/i.test(normalized);
  const generalLiveDomain =
    /\b(?:weather|forecast|sea|ocean|wave|wind|current|gps|location|position|coordinates|vessel|boat|fish(?:ing)? conditions?)\b/i.test(
      question,
    ) || nativeOrRomanizedDomain;
  const fishingSafetyQuestion =
    /\b(?:is it safe|should i|can i)\b.{0,35}\b(?:fish|go out|sea)\b/i.test(
      question,
    ) ||
    /(?:மீன்பிடிக்க.{0,30}(?:பாதுகாப்பா|செல்லலாமா)|கடலுக்குச் செல்ல.{0,20}பாதுகாப்பா)/u.test(
      question,
    ) ||
    /(?:മത്സ്യബന്ധനത്തിന്.{0,30}സുരക്ഷിതമാണോ|കടലിൽ പോക.{0,20}സുരക്ഷിതമാണോ)/u.test(
      question,
    );

  return (
    fishingSafetyQuestion ||
    (temporal &&
      (generalLiveDomain ||
        /\b(?:safe|safety|conditions?)\b/i.test(question) ||
        /(?:பாதுகாப்பா|பாதுகாப்பானதா|நிலைமை|செல்லலாமா)/u.test(question) ||
        /(?:സുരക്ഷിതമാണോ|സ്ഥിതി|പോകാമോ)/u.test(question)))
  );
}

function containsUnsupportedLiveClaim(text: string): boolean {
  return (
    ENGLISH_LIVE_CLAIM.test(text) ||
    TAMIL_LIVE_CLAIM.test(text) ||
    MALAYALAM_LIVE_CLAIM.test(text)
  );
}

function liveDataUnavailable(
  language: ChatLanguage,
  question = "",
): string {
  const fishingQuestion =
    /\b(?:fish(?:ing)?|go(?:ing)? out|cast|fishing conditions?)\b/i.test(
      question,
    ) ||
    /(?:மீன்பிடி|மீன் பிடி|கடலுக்குச் செல்ல|மீனவர்)/u.test(question) ||
    /(?:മത്സ്യബന്ധനം|മീൻ പിടി|കടലിൽ പോക|മത്സ്യത്തൊഴിലാളി)/u.test(question) ||
    /\b(?:meen|kadal|pogalama)\b/i.test(question);
  if (fishingQuestion) {
    const advice: Record<ChatLanguage, string> = {
      en: "I can't verify today's sea or weather conditions, so I can't confirm that fishing is safe. Check the latest official IMD/INCOIS warning before departure; do not go out if a warning is active or conditions are uncertain, and follow local authority advice.",
      ta: "இன்றைய கடல் அல்லது வானிலை நிலையை என்னால் சரிபார்க்க முடியாது; எனவே மீன்பிடிக்கச் செல்வது பாதுகாப்பானது என்று உறுதி செய்ய முடியாது. புறப்படுவதற்கு முன் IMD/INCOIS அதிகாரப்பூர்வ எச்சரிக்கையைப் பார்க்கவும். எச்சரிக்கை இருந்தாலோ நிலைமை தெளிவில்லையென்றாலோ கடலுக்குச் செல்ல வேண்டாம்; உள்ளூர் அதிகாரிகளின் அறிவுறுத்தலைப் பின்பற்றவும்.",
      ml: "ഇന്നത്തെ കടൽസ്ഥിതിയോ കാലാവസ്ഥയോ പരിശോധിക്കാനാവില്ല; അതിനാൽ മത്സ്യബന്ധനത്തിന് പോകുന്നത് സുരക്ഷിതമാണെന്ന് ഉറപ്പുനൽകാനാവില്ല. പുറപ്പെടുന്നതിന് മുമ്പ് IMD/INCOIS ഔദ്യോഗിക മുന്നറിയിപ്പ് പരിശോധിക്കുക. മുന്നറിയിപ്പുണ്ടെങ്കിൽ അല്ലെങ്കിൽ സ്ഥിതി വ്യക്തമല്ലെങ്കിൽ കടലിൽ പോകരുത്; പ്രാദേശിക അധികൃതരുടെ നിർദ്ദേശം പാലിക്കുക.",
    };
    return advice[language];
  }

  const messages: Record<ChatLanguage, string> = {
    en: "I can't access live weather, GPS, ocean conditions, vessel positions, or emergency dispatch in this app. Please check an official live source; for an emergency, contact the appropriate maritime emergency service directly.",
    ta: "இந்த பயன்பாட்டில் நேரடி வானிலை, GPS, கடல் நிலை, படகு இருப்பிடம் அல்லது அவசர சேவை அனுப்பப்பட்டதா என்பதைப் பார்க்க முடியாது. அதிகாரப்பூர்வ நேரடி தகவலைச் சரிபார்க்கவும்; அவசரத்தில் உரிய கடல்சார் அவசர சேவையை நேரடியாகத் தொடர்புகொள்ளவும்.",
    ml: "ഈ ആപ്പിൽ തത്സമയ കാലാവസ്ഥ, GPS, കടൽസ്ഥിതി, വള്ളത്തിന്റെ സ്ഥാനം, അല്ലെങ്കിൽ അടിയന്തര സേവനം അയച്ചിട്ടുണ്ടോ എന്ന് പരിശോധിക്കാനാവില്ല. ഔദ്യോഗിക തത്സമയ ഉറവിടം പരിശോധിക്കുക; അടിയന്തരാവസ്ഥയിൽ ബന്ധപ്പെട്ട സമുദ്ര അടിയന്തര സേവനവുമായി നേരിട്ട് ബന്ധപ്പെടുക.",
  };
  return messages[language];
}

function isCapabilitiesQuestion(question: string): boolean {
  const normalized = normalize(question);
  return (
    /\b(?:what can you do|what do you do|your capabilities|help me)\b/i.test(
      question,
    ) ||
    /(?:என்ன செய்ய முடியும்|என்ன செய்யலாம்|உதவ முடியுமா)/u.test(question) ||
    /(?:எന്തൊക്കെ ചെയ്യാം|എന്തൊക്കെ ചെയ്യാൻ കഴിയും|എന്ത് ചെയ്യാൻ കഴിയും|സഹായിക്കാമോ)/u.test(
      question,
    ) ||
    /\b(?:entha cheyyum|entha cheyyan|help cheyyumo)\b/i.test(normalized)
  );
}

function isGreetingQuestion(question: string): boolean {
  return /(?:\b(?:hi|hello|hey|good morning|good evening)\b|வணக்கம்|நலமா|നമസ്കാരം|സുഖമാണോ)/iu.test(
    question,
  );
}

function isEmergencyQuestion(question: string): boolean {
  return (
    /\b(?:mayday|drowning|person overboard|man overboard|boat sinking|we are sinking|capsized)\b/i.test(
      question,
    ) ||
    /\b(?:send|press|activate|trigger)\s+(?:the\s+)?sos\b|\b(?:sos|mayday)\s*(?:help|emergency|now)\b|^\s*sos\s*[!.]?\s*$/i.test(
      question,
    ) ||
    /(?:மூழ்குகிற|படகு கவிழ்ந்த|அவசர உதவி|உடனடி உதவி|காப்பாற்றுங்கள்)/u.test(
      question,
    ) ||
    /(?:മുങ്ങുന്നു|ബോട്ട് മറിഞ്ഞു|അടിയന്തര സഹായം|രക്ഷിക്കൂ)/u.test(question)
  );
}

function isContextualFollowUp(question: string): boolean {
  return /(?:\b(?:explain|simpl(?:e|er)|simply|what does (?:that|this|it|the value) mean)\b|தமிழில் சொல்லு|எளிமையாக|அதன் அர்த்தம்|இந்த மதிப்பு|മലയാളത്തിൽ വിശദീകരിക്കൂ|വിശദീകരിക്കൂ|ലളിതമായി|അതിന്റെ അർത്ഥം|ഈ മൂല്യം)/iu.test(
    question,
  );
}

function offlineResponse(
  question: string,
  language: ChatLanguage,
  history: ChatTurn[],
): string | undefined {
  if (isCapabilitiesQuestion(question)) return capabilitiesResponse(language);
  if (isGreetingQuestion(question)) return greetingResponse(language);
  if (isEmergencyQuestion(question)) return emergencyResponse(language);

  if (isLiveDataRequest(question)) {
    return liveDataUnavailable(language, question);
  }

  if (isContextualFollowUp(question) && history.length > 0) {
    const previousAnswer = [...history]
      .reverse()
      .find((turn) => turn.role === "assistant")?.content;
    if (previousAnswer && responseUsesLanguage(previousAnswer, language)) {
      const firstSentence =
        previousAnswer.split(/(?<=[.!?。！？])\s+/u)[0]?.slice(0, 420) ??
        previousAnswer.slice(0, 420);
      const prefixes: Record<ChatLanguage, string> = {
        en: "In simple terms: ",
        ta: "எளிமையாகச் சொன்னால்: ",
        ml: "ലളിതമായി പറഞ്ഞാൽ: ",
      };
      return `${prefixes[language]}${firstSentence}`;
    }
    if (previousAnswer) {
      const translationFallback: Record<ChatLanguage, string> = {
        en: "I can't translate the earlier answer reliably while the local AI is unavailable. Please repeat the part you want explained in English.",
        ta: "உள்ளூர் AI கிடைக்காததால் முந்தைய பதிலை நம்பகமாக மொழிபெயர்க்க முடியவில்லை. தமிழில் விளக்க வேண்டிய பகுதியை மீண்டும் அனுப்புங்கள்.",
        ml: "പ്രാദേശിക AI ലഭ്യമല്ലാത്തതിനാൽ മുമ്പത്തെ മറുപടി വിശ്വസനീയമായി വിവർത്തനം ചെയ്യാനാവില്ല. വിശദീകരിക്കേണ്ട ഭാഗം മലയാളത്തിൽ വീണ്ടും അയയ്ക്കൂ.",
      };
      return translationFallback[language];
    }
  }

  if (
    /(?:what does (?:this|that|the) value mean|இந்த மதிப்பு|இந்த எண்ணின் பொருள்|ഈ മൂല്യം|ഈ സംഖ്യയുടെ അർത്ഥം)/iu.test(
      question,
    ) &&
    history.length > 0
  ) {
    const clarification: Record<ChatLanguage, string> = {
      en: "Which value are you asking about? Please paste the number or label, and I’ll explain what it means.",
      ta: "எந்த மதிப்பைப் பற்றி கேட்கிறீர்கள்? அந்த எண்ணையோ பெயரையோ அனுப்புங்கள்; அதன் பொருளை விளக்குகிறேன்.",
      ml: "ഏത് മൂല്യത്തെക്കുറിച്ചാണ് ചോദിക്കുന്നത്? ആ സംഖ്യയോ പേരോ അയയ്ക്കൂ; അതിന്റെ അർത്ഥം വിശദീകരിക്കാം.",
    };
    return clarification[language];
  }

  if (
    /(?:wave height|significant wave|அலை உயரம்|തിരമാല ഉയരം)/iu.test(question)
  ) {
    const explanations: Record<ChatLanguage, string> = {
      en: "Wave height is the vertical distance from a wave's trough to its crest. A forecast or live measurement is needed to know the current value; never assume calm conditions from a general explanation.",
      ta: "அலை உயரம் என்பது அலையின் அடிப்பகுதியிலிருந்து உச்சிவரை உள்ள செங்குத்துத் தூரம். தற்போதைய அளவை அறிய நேரடி அளவீடு அல்லது முன்னறிவிப்பு தேவை; பொதுவான விளக்கத்தை வைத்து கடல் அமைதியாக உள்ளது என்று கருத வேண்டாம்.",
      ml: "തിരമാലയുടെ താഴ്വരയിൽ നിന്ന് മുകളിലെത്തോളം ഉള്ള ലംബദൂരമാണ് തിരമാല ഉയരം. ഇപ്പോഴത്തെ അളവ് അറിയാൻ ലൈവ് അളവോ പ്രവചനമോ വേണം; പൊതുവായ വിശദീകരണം മാത്രം കണ്ട് കടൽ ശാന്തമാണെന്ന് കരുതരുത്.",
    };
    return explanations[language];
  }

  if (/\b(?:gps|coordinates|navigation|position)\b|ஜிபிஎஸ்|இருப்பிடம்|வழிசெலுத்தல்|ജിപിഎസ്|സ്ഥാനം|നാവിഗേഷൻ/iu.test(question)) {
    const explanations: Record<ChatLanguage, string> = {
      en: "GPS uses satellite signals to estimate your position. This chat cannot read your device's GPS or verify a vessel's location. Use the app's map only with location permission enabled, and cross-check navigation with approved equipment.",
      ta: "செயற்கைக்கோள் சிக்னல்களைப் பயன்படுத்தி GPS உங்கள் இருப்பிடத்தை கணிக்கிறது. இந்த உரையாடலால் உங்கள் சாதனத்தின் GPS-ஐப் படிக்கவோ படகின் இருப்பிடத்தை உறுதிப்படுத்தவோ முடியாது. இருப்பிட அனுமதியுடன் செயலியின் வரைபடத்தைப் பயன்படுத்தி, வழிசெலுத்தலை அங்கீகரிக்கப்பட்ட சாதனங்களுடன் சரிபார்க்கவும்.",
      ml: "ഉപഗ്രഹ സിഗ്നലുകൾ ഉപയോഗിച്ചാണ് GPS നിങ്ങളുടെ സ്ഥാനം കണക്കാക്കുന്നത്. ഈ ചാറ്റിന് നിങ്ങളുടെ ഫോണിലെ GPS വായിക്കാനോ ബോട്ടിന്റെ സ്ഥാനം സ്ഥിരീകരിക്കാനോ കഴിയില്ല. ലൊക്കേഷൻ അനുമതി നൽകിയാൽ ആപ്പിലെ ഭൂപടം ഉപയോഗിക്കാം; നാവിഗേഷൻ അംഗീകൃത ഉപകരണങ്ങളുമായി കൂടി പരിശോധിക്കുക.",
    };
    return explanations[language];
  }

  if (
    /(?:wind speed|wind direction|ocean current|sea current|காற்றின் வேகம்|காற்றின் திசை|கடல் நீரோட்டம்|കാറ്റിന്റെ വേഗം|കാറ്റിന്റെ ദിശ|സമുദ്ര പ്രവാഹം)/iu.test(
      question,
    )
  ) {
    const explanations: Record<ChatLanguage, string> = {
      en: "Wind speed describes how fast air is moving; ocean currents describe the movement of seawater. Both can change quickly and affect a small vessel. I can explain the terms, but current values require a verified live marine source.",
      ta: "காற்றின் வேகம் என்பது காற்று எவ்வளவு வேகமாக நகர்கிறது என்பதைக் குறிக்கும்; கடல் நீரோட்டம் என்பது கடல் நீர் நகரும் திசை மற்றும் வேகத்தைக் குறிக்கும். இவை விரைவாக மாறி சிறிய படகுகளையும் பாதிக்கலாம். தற்போதைய அளவுகளுக்கு சரிபார்க்கப்பட்ட நேரடி கடல்சார் ஆதாரம் தேவை.",
      ml: "കാറ്റിന്റെ വേഗം എന്നത് വായു എത്ര വേഗത്തിൽ നീങ്ങുന്നു എന്നതാണ്; സമുദ്രപ്രവാഹം കടൽജലം നീങ്ങുന്ന ദിശയും വേഗവുമാണ്. ഇവ പെട്ടെന്ന് മാറുകയും ചെറിയ ബോട്ടുകളെ ബാധിക്കുകയും ചെയ്യും. ഇപ്പോഴത്തെ മൂല്യങ്ങൾക്ക് വിശ്വസനീയമായ ലൈവ് സമുദ്ര സ്രോതസ്സ് ആവശ്യമാണ്.",
    };
    return explanations[language];
  }

  const unknown: Record<ChatLanguage, string> = {
    en: "I’m not sure I understood that question. I can help with fishing safety, weather and sea terms, navigation, maritime boundaries, emergencies, and NEYTHAL features. Please rephrase or add a little context.",
    ta: "உங்கள் கேள்வியை முழுமையாகப் புரிந்துகொள்ள முடியவில்லை. மீன்பிடிப் பாதுகாப்பு, வானிலை மற்றும் கடல் நிலைச் சொற்கள், வழிசெலுத்தல், கடல் எல்லைகள், அவசரநிலை, NEYTHAL அம்சங்கள் பற்றி உதவ முடியும். வேறு விதமாகக் கேளுங்கள் அல்லது சிறிது கூடுதல் விவரம் சேர்க்கவும்.",
    ml: "ചോദ്യം വ്യക്തമായി മനസ്സിലായില്ല. മത്സ്യബന്ധന സുരക്ഷ, കാലാവസ്ഥയും കടൽസ്ഥിതിയും, നാവിഗേഷൻ, സമുദ്ര അതിർത്തികൾ, അടിയന്തരാവസ്ഥ, NEYTHAL സൗകര്യങ്ങൾ എന്നിവയിൽ സഹായിക്കാം. ചോദ്യം മറ്റൊരു രീതിയിൽ പറയുകയോ കുറച്ച് കൂടി വിവരം ചേർക്കുകയോ ചെയ്യൂ.",
  };
  return unknown[language];
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

    const answer = cleanModelResponse(choice.message.content);
    return answer && responseUsesLanguage(answer, language) ? answer : undefined;
  } catch {
    return undefined;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function askNeythal(
  rawQuestion: string,
  preferredLanguage: ChatLanguage,
  history: ChatTurn[],
  safetyZone: string,
): Promise<ChatbotReply> {
  const question = rawQuestion.trim();
  const language = detectChatLanguage(question, preferredLanguage);
  if (!question) {
    throw new NeythalChatbotError(
      language === "ta"
        ? "கேள்வியை உள்ளிடவும்."
        : language === "ml"
          ? "ദയവായി ചോദ്യം നൽകുക."
          : "Please enter a question.",
    );
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

  if (isEmergencyQuestion(question)) {
    return { text: emergencyResponse(language), source: "safety" };
  }
  if (isLiveDataRequest(question)) {
    return {
      text: liveDataUnavailable(language, question),
      source: "safety",
    };
  }
  if (isCapabilitiesQuestion(question) || isGreetingQuestion(question)) {
    const text = offlineResponse(question, language, history);
    if (text) return { text, source: "knowledge" };
  }

  const previousMarineQuestion = [...history]
    .reverse()
    .find(
      (turn) =>
        turn.role === "user" &&
        /(?:weather|forecast|sea|ocean|wave|wind|fish|boat|கடல்|மீன்பிடி|வானிலை|തിരമാല|കടൽ|മത്സ്യബന്ധനം|കാലാവസ്ഥ)/iu.test(
          turn.content,
        ),
    )?.content;
  const liveFollowUp =
    /(?:\b(?:what about )?(?:tomorrow|today|now|then)\b|நாளை|இன்று|இப்போது|നാളെ|ഇന്ന്|ഇപ്പോൾ|\b(?:nale|naalai|innu|inniku)\b)/iu.test(
      question,
    ) &&
    Boolean(previousMarineQuestion);
  if (liveFollowUp) {
    return {
      text: liveDataUnavailable(
        language,
        `${previousMarineQuestion} ${question}`,
      ),
      source: "safety",
    };
  }

  let entries: KnowledgeEntry[] = [];
  let knowledgeUnavailable = false;
  try {
    entries = await loadKnowledge();
  } catch {
    knowledgeUnavailable = true;
  }

  const relevantEntries = retrieveRelevantEntries(question, entries, language);
  const isCompoundQuestion =
    question.split(/[.!?;।！？]+/u).filter((part) => normalize(part)).length > 1;
  if (
    relevantEntries.length > 0 &&
    !isCompoundQuestion &&
    !isContextualFollowUp(question)
  ) {
    const localizedAnswer = exactLanguageText(
      relevantEntries[0].answer,
      language,
    );
    if (
      localizedAnswer &&
      responseUsesLanguage(localizedAnswer, language)
    ) {
      if (containsUnsupportedLiveClaim(localizedAnswer)) {
        return {
          text: liveDataUnavailable(language, question),
          source: "safety",
        };
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
      return {
        text: liveDataUnavailable(language, question),
        source: "safety",
      };
    }
    return { text: modelAnswer, source: "ai" };
  }

  if (isCompoundQuestion || isContextualFollowUp(question)) {
    const contextualAnswer = offlineResponse(question, language, history);
    if (contextualAnswer) {
      return { text: contextualAnswer, source: "knowledge" };
    }
  }

  const localAnswer = fallbackText(relevantEntries, language);
  if (localAnswer) {
    if (containsUnsupportedLiveClaim(localAnswer)) {
      return {
        text: liveDataUnavailable(language, question),
        source: "safety",
      };
    }
    return { text: localAnswer, source: "knowledge" };
  }

  const fallback = offlineResponse(question, language, history);
  if (!fallback) {
    throw new NeythalChatbotError(safeError(language, "no-match"));
  }
  if (knowledgeUnavailable) {
    return {
      text: `${fallback}\n\n${safeError(language, "dataset")}`,
      source: "knowledge",
    };
  }
  return { text: fallback, source: "knowledge" };
}
