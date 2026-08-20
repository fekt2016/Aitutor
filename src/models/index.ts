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

export { UserModel, toPublicUser, AGE_BANDS, isAgeBand, type AgeBand, type User } from "./User";
export { ParentChildModel, type ParentChild } from "./ParentChild";
export { StudentProfileModel, type StudentProfile } from "./StudentProfile";
export { GradeLevelModel, type GradeLevel } from "./GradeLevel";
export { SubjectModel, type Subject } from "./Subject";
export { TutorSessionModel, type TutorSession } from "./TutorSession";
export { TutorMessageModel, type TutorMessage } from "./TutorMessage";
