export type SafetyZone =
  | "SAFE"
  | "CAUTION"
  | "WARNING"
  | "CRITICAL";

export type SafetyAlertLanguage = "en" | "ta" | "ml";

export const SAFETY_ALERT_CONTENT: Record<
  SafetyAlertLanguage,
  Record<SafetyZone, { label: string; message: string }>
> = {
  en: {
    SAFE: {
      label: "SAFE",
      message: "You are currently entering the Safe Zone.",
    },
    CAUTION: {
      label: "CAUTION",
      message:
        "Warning. You are entering the Caution Zone. Please proceed carefully.",
    },
    WARNING: {
      label: "WARNING",
      message:
        "Warning. You are entering the Warning Zone. Please change your course and move to a safer area.",
    },
    CRITICAL: {
      label: "CRITICAL",
      message:
        "Critical alert. You are entering the Critical Zone. Immediately change your course and move away from this area.",
    },
  },
  ta: {
    SAFE: {
      label: "பாதுகாப்பு",
      message: "நீங்கள் தற்போது பாதுகாப்பு மண்டலத்திற்குள் நுழைகிறீர்கள்.",
    },
    CAUTION: {
      label: "எச்சரிக்கை",
      message:
        "எச்சரிக்கை. நீங்கள் எச்சரிக்கை மண்டலத்திற்குள் நுழைகிறீர்கள். கவனமாக செல்லவும்.",
    },
    WARNING: {
      label: "அபாய எச்சரிக்கை",
      message:
        "எச்சரிக்கை. நீங்கள் அபாய எச்சரிக்கை மண்டலத்திற்குள் நுழைகிறீர்கள். உங்கள் பயண திசையை மாற்றி பாதுகாப்பான பகுதிக்கு செல்லவும்.",
    },
    CRITICAL: {
      label: "மிக ஆபத்து",
      message:
        "முக்கிய எச்சரிக்கை. நீங்கள் மிக ஆபத்தான மண்டலத்திற்குள் நுழைகிறீர்கள். உடனடியாக உங்கள் பயண திசையை மாற்றி இந்த பகுதியிலிருந்து விலகிச் செல்லவும்.",
    },
  },
  ml: {
    SAFE: {
      label: "സുരക്ഷിതം",
      message: "നിങ്ങൾ ഇപ്പോൾ സുരക്ഷിത മേഖലയിലേക്ക് പ്രവേശിക്കുന്നു.",
    },
    CAUTION: {
      label: "ജാഗ്രത",
      message:
        "മുന്നറിയിപ്പ്. നിങ്ങൾ ജാഗ്രതാ മേഖലയിലേക്ക് പ്രവേശിക്കുന്നു. ദയവായി ശ്രദ്ധയോടെ മുന്നോട്ട് പോകുക.",
    },
    WARNING: {
      label: "മുന്നറിയിപ്പ്",
      message:
        "മുന്നറിയിപ്പ്. നിങ്ങൾ അപകട മുന്നറിയിപ്പ് മേഖലയിലേക്ക് പ്രവേശിക്കുന്നു. നിങ്ങളുടെ ദിശ മാറ്റി സുരക്ഷിതമായ മേഖലയിലേക്ക് നീങ്ങുക.",
    },
    CRITICAL: {
      label: "ഗുരുതരം",
      message:
        "ഗുരുതര മുന്നറിയിപ്പ്. നിങ്ങൾ അതീവ അപകടകരമായ മേഖലയിലേക്ക് പ്രവേശിക്കുന്നു. ഉടൻ തന്നെ ദിശ മാറ്റി ഈ പ്രദേശത്ത് നിന്ന് മാറിപ്പോകുക.",
    },
  },
};

export type NeythalMessage = {
  id: number;
  sender: "user" | "ai";
  text: string;
  tamil?: string;
};

export function getSafetyResponse(
  zone: SafetyZone
) {
  switch (zone) {
    case "CAUTION":
      return {
        english:
          "You are approaching the maritime boundary. Please proceed carefully.",
        tanglish:
          "Neenga maritime boundary-ku pakkathula poiteenga. Konjam gavanama irunga.",
        tamil:
          "நீங்கள் கடல் எல்லைக்கு அருகில் செல்கிறீர்கள். கவனமாக செல்லுங்கள்.",
      };

    case "WARNING":
      return {
        english:
          "Warning. You are very close to the maritime boundary. Move back toward the safe area.",
        tanglish:
          "Warning. Neenga maritime boundary-ku romba pakkathula irukeenga. Safe area pakkam thirumbi pongal.",
        tamil:
          "எச்சரிக்கை. நீங்கள் கடல் எல்லைக்கு மிகவும் அருகில் உள்ளீர்கள். பாதுகாப்பான பகுதிக்கு திரும்புங்கள்.",
      };

    case "CRITICAL":
      return {
        english:
          "Critical warning. Please return to the safe area immediately.",
        tanglish:
          "Echarikkai! Paadhukaappana paguthikku udanadiyaaga thirumbunga.",
        tamil:
          "எச்சரிக்கை! பாதுகாப்பான பகுதிக்கு உடனடியாக திரும்புங்கள்.",
      };

    default:
      return {
        english:
          "You are currently inside the safe navigation area.",
        tanglish:
          "Neenga ippo safe area-la irukeenga.",
        tamil:
          "நீங்கள் தற்போது பாதுகாப்பான பகுதியில் இருக்கிறீர்கள்.",
      };
  }
}