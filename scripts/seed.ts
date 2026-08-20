/**
 * Curriculum + base-data seed (plan §6, §31 Phase 1).
 *
 * Seeds: GradeLevels Basic 1–4, the two MVP subjects, and a real NaCCA-shaped
 * slice — Subject → Strand → SubStrand → ContentStandard → Skill → Lesson →
 * PracticeItem (2 skills per subject, 3–5 items each).
 *
 * Idempotent: everything upserts by unique code; practice items are
 * re-keyed per skill (delete + insert) so repeats never duplicate.
 *
 * Run:  npm run seed   (requires .env with MONGO_URL)
 */
import mongoose from "mongoose";
import { substitutePassword } from "../src/server/env";
import {
  GradeLevelModel,
  SubjectModel,
  StrandModel,
  SubStrandModel,
  ContentStandardModel,
  SkillModel,
  LessonModel,
  PracticeItemModel,
} from "../src/models";

interface SeedItem {
  type: "mcq" | "free";
  prompt: string;
  options?: string[];
  answer: string;
  explanation: string;
  difficulty: number;
}

type SeedGradeCode = "Basic1" | "Basic2" | "Basic3" | "Basic4";

interface SeedSkill {
  code: string;
  name: string;
  description: string;
  defaultDifficulty: number;
  grade: SeedGradeCode;
  standardCode: string;
  objective: string;
  lessonTitle: string;
  lessonBody: string;
  examples: string[];
  items: SeedItem[];
}

const GRADE_SEED: Array<{
  code: SeedGradeCode;
  name: string;
  minAge: number;
  maxAge: number;
  vocabularyLevel: number;
  explanationDepth: number;
  readingLevel: string;
  interactionStyle: "playful" | "guided" | "independent";
}> = [
  { code: "Basic1", name: "Basic 1", minAge: 6, maxAge: 7, vocabularyLevel: 1, explanationDepth: 1, readingLevel: "emergent", interactionStyle: "playful" },
  { code: "Basic2", name: "Basic 2", minAge: 7, maxAge: 8, vocabularyLevel: 2, explanationDepth: 2, readingLevel: "early", interactionStyle: "playful" },
  { code: "Basic3", name: "Basic 3", minAge: 8, maxAge: 9, vocabularyLevel: 3, explanationDepth: 3, readingLevel: "developing", interactionStyle: "guided" },
  { code: "Basic4", name: "Basic 4", minAge: 9, maxAge: 10, vocabularyLevel: 4, explanationDepth: 4, readingLevel: "fluent", interactionStyle: "guided" },
];

const MATHEMATICS: { name: string; strand: string; subStrand: string; skills: SeedSkill[] } = {
  name: "Mathematics",
  strand: "Number",
  subStrand: "Number Operations",
  skills: [
    {
      code: "add-subtract-within-20",
      name: "Adding and subtracting within 20",
      description: "Add and subtract single numbers with totals up to 20.",
      defaultDifficulty: 2,
      grade: "Basic1",
      standardCode: "B1.1.1.1",
      objective: "Add and subtract numbers within 20 using objects and counting strategies.",
      lessonTitle: "Adding and subtracting up to 20",
      lessonBody: `Adding means putting groups together. If you have 5 mangoes and I give you 3 more, you count all of them: 5, 6, 7, 8 — you have 8 mangoes. So 5 + 3 = 8.
Subtracting means taking some away. If you have 8 mangoes and you eat 2, you have 6 left. So 8 - 2 = 6.
A number line helps too: to add, hop forward; to subtract, hop backwards.
Tip: to add 9 + 4, make 10 first — 9 + 1 = 10, then 10 + 3 = 13.`,
      examples: ["7 + 2 = 9 (seven and two more makes nine)", "12 - 4 = 8 (start at 12, hop back 4)", "9 + 6: make ten — 9 + 1 = 10, plus 5 more = 15"],
      items: [
        { type: "mcq", prompt: "5 + 3 = ?", options: ["7", "8", "9", "10"], answer: "8", explanation: "5, then 3 more: 6, 7, 8.", difficulty: 1 },
        { type: "mcq", prompt: "9 + 4 = ?", options: ["12", "13", "14", "11"], answer: "13", explanation: "Make ten: 9 + 1 = 10, then 10 + 3 = 13.", difficulty: 2 },
        { type: "free", prompt: "12 - 5 = ?", answer: "7", explanation: "Start at 12 and hop back 5: 11, 10, 9, 8, 7.", difficulty: 2 },
        { type: "mcq", prompt: "Amina has 8 books and her friend gives her 6 more. How many books does she have now?", options: ["12", "13", "14", "15"], answer: "14", explanation: "8 + 6 = 14. Put 8 and 6 together.", difficulty: 3 },
        { type: "free", prompt: "15 - 9 = ?", answer: "6", explanation: "Hop back 9 from 15: 14, 13, 12, 11, 10, 9, 8, 7, 6.", difficulty: 3 },
      ],
    },
    {
      code: "fractions-equivalent",
      name: "Equivalent fractions",
      description: "Recognise and name fractions that show the same amount.",
      defaultDifficulty: 3,
      grade: "Basic4",
      standardCode: "B4.1.1.1",
      objective: "Identify and represent equivalent fractions using diagrams.",
      lessonTitle: "Fractions that look different but are the same",
      lessonBody: `A fraction shows parts of a whole. 1/2 means one part out of two equal parts.
Some fractions LOOK different but show the SAME amount. 1/2 and 2/4 are equivalent — half of a cake is the same as two quarters of the cake.
To find an equivalent fraction, multiply the top number (numerator) and the bottom number (denominator) by the same number. 1/2 × 2/2 = 2/4. 1/2 × 3/3 = 3/6.
When the numerator and denominator have no common factor bigger than 1, the fraction is in simplest form (1/2 is simpler than 2/4).`,
      examples: ["1/2 = 2/4 = 3/6 (multiply top and bottom by the same number)", "2/3 = 4/6 (multiply by 2)", "3/4 = 6/8 (multiply by 2)"],
      items: [
        { type: "mcq", prompt: "Which fraction is equivalent to 1/2?", options: ["2/3", "2/4", "3/5", "1/3"], answer: "2/4", explanation: "1/2 × 2/2 = 2/4 — same amount, different name.", difficulty: 2 },
        { type: "free", prompt: "Write a fraction equivalent to 2/3.", answer: "4/6", explanation: "2/3 × 2/2 = 4/6. Any equivalent is correct (6/9, 8/12…).", difficulty: 3 },
        { type: "mcq", prompt: "3/4 is the same as…", options: ["6/8", "4/5", "2/3", "6/10"], answer: "6/8", explanation: "3/4 × 2/2 = 6/8.", difficulty: 3 },
        { type: "mcq", prompt: "Kofi ate 2/4 of a chocolate bar. Which fraction shows the same amount?", options: ["1/3", "1/2", "2/3", "3/4"], answer: "1/2", explanation: "2/4 ÷ 2/2 = 1/2 — same amount.", difficulty: 3 },
        { type: "free", prompt: "Write 4/8 in its simplest form.", answer: "1/2", explanation: "Divide top and bottom by 4: 4/8 = 1/2.", difficulty: 4 },
      ],
    },
  ],
};

const ENGLISH: { name: string; strand: string; subStrand: string; skills: SeedSkill[] } = {
  name: "English Language",
  strand: "Reading",
  subStrand: "Reading Comprehension",
  skills: [
    {
      code: "phonics-consonant-blends",
      name: "Consonant blends at the start of words",
      description: "Read words that begin with two consonants together (bl, cr, st, fr).",
      defaultDifficulty: 2,
      grade: "Basic1",
      standardCode: "B1.2.1.1",
      objective: "Blend two consonant sounds to read simple words.",
      lessonTitle: "Two sounds that hold hands: consonant blends",
      lessonBody: `Some words start with TWO consonant sounds together. We say them quickly, one after the other.
bl — as in "blue" and "block". Say: b...l → bl.
st — as in "star" and "stop". Say: s...t → st.
fr — as in "frog" and "from". Say: f...r → fr.
cr — as in "crab" and "cry". Say: c...r → cr.
To read a word like "stop": first say the blend st, then add the rest — st...op → stop!`,
      examples: ["bl: blue, block, black", "st: star, stop, stone", "fr: frog, from, fruit", "cr: crab, cry, crow"],
      items: [
        { type: "mcq", prompt: "Which word starts with the blend 'bl'?", options: ["stop", "blue", "crab", "frog"], answer: "blue", explanation: "Blue starts with b...l — the blend 'bl'.", difficulty: 1 },
        { type: "free", prompt: "Type a word that starts with 'st'.", answer: "star", explanation: "Any word starting with st works: star, stop, stone, stick…", difficulty: 2 },
        { type: "mcq", prompt: "Which word starts with the blend 'fr'?", options: ["from", "black", "cry", "stop"], answer: "from", explanation: "From starts with f...r — the blend 'fr'.", difficulty: 2 },
        { type: "mcq", prompt: "Which blend does 'crab' start with?", options: ["bl", "st", "cr", "fr"], answer: "cr", explanation: "Crab starts with c...r — the blend 'cr'.", difficulty: 2 },
        { type: "free", prompt: "Type a word that starts with 'bl'.", answer: "block", explanation: "Any word starting with bl works: blue, black, block…", difficulty: 2 },
      ],
    },
    {
      code: "reading-comprehension-literal",
      name: "Answering literal questions about a text",
      description: "Find answers that are written directly in a short text.",
      defaultDifficulty: 3,
      grade: "Basic2",
      standardCode: "B2.2.1.1",
      objective: "Answer literal questions by locating information directly in a text.",
      lessonTitle: "Finding answers that are written right in the story",
      lessonBody: `Literal questions have answers written straight in the text. You do not need to guess — you just LOOK for the words.
Read this short text:
"Ama has a red bicycle. Every morning she rides it to the market with her mother."
Ask: "What colour is Ama's bicycle?" The text says red. Answer: red.
Ask: "Where does Ama ride every morning?" The text says to the market. Answer: to the market.
Tip: read the question, then scan the text for the same words — the answer is right next to them.`,
      examples: ["Text: 'Kwame feeds the goat at 7 o'clock.' → When does Kwame feed the goat? At 7 o'clock.", "Text: 'The cat slept under the tree.' → Where did the cat sleep? Under the tree."],
      items: [
        { type: "free", prompt: "Text: 'Ama has a red bicycle.' What colour is Ama's bicycle?", answer: "red", explanation: "The text says the bicycle is red.", difficulty: 1 },
        { type: "mcq", prompt: "Text: 'Kwame feeds the goat at 7 o'clock.' When does Kwame feed the goat?", options: ["at 8 o'clock", "at 7 o'clock", "at noon", "in the night"], answer: "at 7 o'clock", explanation: "The text says 7 o'clock.", difficulty: 1 },
        { type: "free", prompt: "Text: 'The cat slept under the tree.' Where did the cat sleep?", answer: "under the tree", explanation: "The text says under the tree.", difficulty: 2 },
        { type: "mcq", prompt: "Text: 'Every morning Ama rides to the market with her mother.' Who does Ama ride with?", options: ["her sister", "her father", "her mother", "her friend"], answer: "her mother", explanation: "The text says she rides with her mother.", difficulty: 2 },
        { type: "mcq", prompt: "Text: 'Adwoa found three shiny stones by the river.' How many stones did Adwoa find?", options: ["two", "three", "four", "five"], answer: "three", explanation: "The text says three shiny stones.", difficulty: 2 },
      ],
    },
  ],
};

async function main(): Promise<void> {
  const mongoUrl = substitutePassword(process.env.MONGO_URL ?? "", process.env.DATABASE_PASSWORD);
  if (!mongoUrl) {
    console.error("MONGO_URL is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10_000 });
  console.log("Connected. Seeding…");

  for (const grade of GRADE_SEED) {
    await GradeLevelModel.updateOne({ code: grade.code }, { $set: grade }, { upsert: true });
  }
  console.log(`GradeLevels: ${GRADE_SEED.length} upserted`);

  for (const subjectSeed of [MATHEMATICS, ENGLISH]) {
    const subject = await SubjectModel.findOneAndUpdate(
      { code: subjectSeed.name.toUpperCase().replace(/\s+/g, "_") },
      { $set: { name: subjectSeed.name, active: true, sortOrder: subjectSeed === MATHEMATICS ? 1 : 2 } },
      { upsert: true, new: true }
    );
    const strand = await StrandModel.findOneAndUpdate(
      { subjectId: subject._id, name: subjectSeed.strand },
      { $set: { subjectId: subject._id, name: subjectSeed.strand, sortOrder: 1 } },
      { upsert: true, new: true }
    );
    const subStrand = await SubStrandModel.findOneAndUpdate(
      { strandId: strand._id, name: subjectSeed.subStrand },
      { $set: { strandId: strand._id, name: subjectSeed.subStrand, sortOrder: 1 } },
      { upsert: true, new: true }
    );

    for (const skillSeed of subjectSeed.skills) {
      const grade = await GradeLevelModel.findOne({ code: skillSeed.grade }).lean();
      const standard = await ContentStandardModel.findOneAndUpdate(
        { code: skillSeed.standardCode },
        {
          $set: {
            code: skillSeed.standardCode,
            substrandId: subStrand._id,
            gradeLevelId: grade?._id,
            objective: skillSeed.objective,
            exemplars: [],
          },
        },
        { upsert: true, new: true }
      );

      const skill = await SkillModel.findOneAndUpdate(
        { code: skillSeed.code },
        {
          $set: {
            code: skillSeed.code,
            name: skillSeed.name,
            contentStandardId: standard._id,
            description: skillSeed.description,
            defaultDifficulty: skillSeed.defaultDifficulty,
            active: true,
          },
        },
        { upsert: true, new: true }
      );

      await LessonModel.findOneAndUpdate(
        { skillId: skill._id, title: skillSeed.lessonTitle },
        {
          $set: {
            skillId: skill._id,
            title: skillSeed.lessonTitle,
            markdownBody: skillSeed.lessonBody,
            examples: skillSeed.examples,
            sortOrder: 1,
            active: true,
          },
        },
        { upsert: true }
      );

      await PracticeItemModel.deleteMany({ skillId: skill._id });
      await PracticeItemModel.insertMany(
        skillSeed.items.map((item) => ({
          skillId: skill._id,
          type: item.type,
          prompt: item.prompt,
          options: item.options ?? [],
          answer: item.answer,
          explanation: item.explanation,
          difficulty: item.difficulty,
          active: true,
        }))
      );
      console.log(`  ${skillSeed.code}: ${skillSeed.items.length} items`);
    }
  }

  console.log("Seed complete ✓");
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});