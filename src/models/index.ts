/**
 * Model barrel — importing this registers every Mongoose model exactly
 * once (HMR-safe via `mongoose.models.X ?? mongoose.model(...)` guards).
 * Route handlers / services import models from here.
 */
import "./User";
import "./ParentChild";
import "./StudentProfile";
import "./GradeLevel";
import "./Subject";
import "./TutorSession";
import "./TutorMessage";
import "./LearningSignal";
import "./SkillMastery";
import "./SafetyEvent";
import "./UsageLog";
import "./Strand";
import "./SubStrand";
import "./ContentStandard";
import "./Skill";
import "./Lesson";
import "./PracticeItem";

export { UserModel, toPublicUser, AGE_BANDS, isAgeBand, type AgeBand, type User } from "./User";
export { ParentChildModel, type ParentChild } from "./ParentChild";
export { StudentProfileModel, type StudentProfile } from "./StudentProfile";
export { GradeLevelModel, type GradeLevel } from "./GradeLevel";
export { SubjectModel, type Subject } from "./Subject";
export { TutorSessionModel, type TutorSession, type TutorSessionDoc } from "./TutorSession";
export { TutorMessageModel, type TutorMessage } from "./TutorMessage";
export {
  LearningSignalModel,
  SIGNAL_TYPES,
  isSignalType,
  type LearningSignal,
  type SignalType,
} from "./LearningSignal";
export {
  SkillMasteryModel,
  MASTERY_BANDS,
  MASTERY_BAND_LIMITS,
  masteryBandForScore,
  type SkillMastery,
  type MasteryBand,
} from "./SkillMastery";
export { SafetyEventModel, type SafetyEvent, type SafetyKind } from "./SafetyEvent";
export { UsageLogModel, type UsageLog } from "./UsageLog";
export { StrandModel, type Strand } from "./Strand";
export { SubStrandModel, type SubStrand } from "./SubStrand";
export { ContentStandardModel, type ContentStandard } from "./ContentStandard";
export { SkillModel, type Skill } from "./Skill";
export { LessonModel, type Lesson } from "./Lesson";
export {
  PracticeItemModel,
  PRACTICE_ITEM_TYPES,
  type PracticeItem,
  type PracticeItemType,
} from "./PracticeItem";
