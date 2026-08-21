/**
 * Child-friendly deflection messages (plan §18.2, §37) — what Eazi says when
 * input is flagged. Warm, firm, non-preachy; always steers back to learning.
 * No shame, no lecture; the child is never exposed to the flagged content.
 */
export const DEFLECTIONS: Record<string, string> = {
  default:
    "Let's keep our chat friendly and about learning! Tell me what you'd like to learn today — maybe we can play a fun maths or reading game.",
  sexual:
    "That's not the kind of thing we talk about here. Let's play a learning game instead — what's your favourite subject?",
  violence:
    "Let's keep things kind and safe. Words that hurt people aren't for our classroom. How about we try a fun question together?",
  "self-harm":
    "You matter, and you are never alone. If you're feeling sad or worried, please tell a trusted adult — a parent, teacher, or guardian — and they will help you. I'm here to learn with you whenever you're ready.",
  harassment:
    "We treat everyone kindly here, including ourselves. Let's use friendly words — I'd love to help you with a question instead!",
  "adult-content":
    "That topic is for grown-ups. In our classroom we learn maths, reading, science and more — what shall we explore?",
  "personal-info":
    "We never share private information like addresses or phone numbers in our chats. Let's get back to learning — what would you like to practice?",
  bypass:
    "I'm Eazi, your learning tutor, and I'll stay right here to help you with your schoolwork. Let's find something fun to learn!",
  "off-topic":
    "That's outside our classroom! I'm here to help with school subjects. Which one would you like to work on — maths or reading?",
};

export function deflectionFor(categories: string[]): string {
  for (const category of categories) {
    const message = DEFLECTIONS[category];
    if (message) return message;
  }
  return DEFLECTIONS.default;
}

/** Warm generic fallback when the tutor model itself is unavailable (§37). */
export const PROVIDER_DOWN_MESSAGE =
  "Oh no, my learning machine needs a little rest! Try again in a moment — I'll be ready to help you then.";

export const UNSAFE_OUTPUT_FALLBACK =
  "Hmm, that answer didn't come out quite right. Let's try a fresh question together!";

export const RATE_LIMIT_MESSAGE =
  "Let's take a short break, then keep going! Your brain learns best with little rests.";

export const MALFORMED_OUTPUT_FALLBACK =
  "Oops, my answer got a little jumbled! Let me try that again — could you repeat your question?";