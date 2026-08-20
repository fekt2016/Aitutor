/**
 * Deterministic keyword/pattern classifier (plan §18.2) — offline, instant,
 * runs BEFORE and ALONGSIDE the provider moderation API. Never the only
 * safety layer, but the first line that costs nothing and can't fail.
 *
 * Design rule: categories map to OpenAI moderation categories where they
 * overlap (harassment, sexual, violence, self-harm, hate) so verdicts unify;
 * EazWorld-specific categories (personal-info, bypass) are extras.
 */

export type SafetyCategory =
  | "harassment"
  | "sexual"
  | "violence"
  | "self-harm"
  | "hate"
  | "personal-info"
  | "bypass"
  | "adult-content"
  | "off-topic";

export interface KeywordVerdict {
  flagged: boolean;
  categories: SafetyCategory[];
  matched: string[];
}

const PATTERNS: Array<{ category: SafetyCategory; regex: RegExp }> = [
  // Sexual content — explicit terms + phonetic variants.
  {
    category: "sexual",
    regex:
      /\b(sex|sexy|fuck|fucking|shit|porn|porno|nude|naked|boobs|dick|penis|vagina|blowjob|masturbat|fuk|fk u|s3x|p0rn)\b/i,
  },
  // Violence + dangerous activities.
  {
    category: "violence",
    regex:
      /\b(kill|killing|murder|kill yourself|kill u|hitler|gun|shoot|shooting|bomb|explosive|knife|stab|blood|die|dead|hate you|i hate)\b/i,
  },
  // Self-harm (inclusive patterns).
  {
    category: "self-harm",
    regex:
      /\b(suicide|suicidal|self[- ]?harm|cut myself|kill myself|end my life|overdose|no one cares about me)\b/i,
  },
  // Bullying/harassment.
  {
    category: "harassment",
    regex:
      /\b(stupid|idiot|dumb|ugly|loser|fat|worthless|shut up|shutup|retard|freak|nerd|weirdo|suck)\b/i,
  },
  // Adult content / off-limits topics.
  {
    category: "adult-content",
    regex:
      /\b(beer|alcohol|wine|whiskey|smoke|cigarette|weed|marijuana|cocaine|drugs|gambling|casino)\b/i,
  },
  // Personal info requests (child-protection).
  {
    category: "personal-info",
    regex:
      /\b(what is my (name|address|phone|number)|my (address|phone number|location)|where do i live|school name|credit card|social security|password)\b/i,
  },
  // Safety-bypass attempts.
  {
    category: "bypass",
    regex:
      /\b(pretend you are|jailbreak|ignore (your|all) (rules|instructions)|roleplay as|act as a (adult|grown|man|woman|teacher) with no rules|dan mode|developer mode|reveal your (prompt|instructions|system))\b/i,
  },
  // Off-topic: requests for content outside the curriculum (loose catch).
  {
    category: "off-topic",
    regex:
      /\b(tell me about (sex|drugs|alcohol)|how to (kill|make a bomb|drink|smoke)|dating advice|boyfriend|girlfriend kiss)\b/i,
  },
];

const MATCH_LIMIT = 5;

/** Runs the local classifier on a message. Pure + fast — unit-tested. */
export function classifyInput(text: string): KeywordVerdict {
  const normalized = text.trim();
  const categories: SafetyCategory[] = [];
  const matched: string[] = [];

  if (normalized.length === 0) {
    return { flagged: false, categories, matched };
  }

  for (const { category, regex } of PATTERNS) {
    const match = normalized.match(regex);
    if (match && !categories.includes(category)) {
      categories.push(category);
      if (match[0] && matched.length < MATCH_LIMIT) matched.push(match[0]);
    }
  }

  return { flagged: categories.length > 0, categories, matched };
}