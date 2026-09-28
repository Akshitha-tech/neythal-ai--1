export type SafetyZone =
  | "SAFE"
  | "CAUTION"
  | "WARNING"
  | "CRITICAL";

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