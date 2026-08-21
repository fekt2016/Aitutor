import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/models", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models")>();
  return { ...actual };
});
vi.mock("../curriculum/service", () => ({
  resolveSkillForSession: vi.fn(),
}));
vi.mock("../curriculum/retrieval", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../curriculum/retrieval")>();
  return {
    ...actual,
    searchCurriculum: vi.fn(),
  };
});

import { resolveSkillForSession } from "../curriculum/service";
import { searchCurriculum } from "../curriculum/retrieval";
import { AppError } from "@/lib/errors";
import { runTool, type ToolAudit } from "./types";
import {
  getCurrentLessonTool,
  searchCurriculumTool,
  type LessonToolInput,
} from "./curriculum";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runTool (§15 contract)", () => {
  const okTool = {
    name: "test_tool",
    description: "test",
    readOnly: true,
    execute: async (input: number) => input * 2,
  };

  it("returns data + timing and audits success", async () => {
    const audit = vi.fn<ToolAudit>();
    const outcome = await runTool(okTool, 21, audit);

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toBe(42);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "test_tool", ok: true })
    );
  });

  it("validation failure → ok:false with reason, execute never runs", async () => {
    const audit = vi.fn<ToolAudit>();
    const guarded = {
      ...okTool,
      validate: (n: number) => {
        // Validators throw AppError like assertQuery does (safe machine reason).
        if (n < 0) throw AppError.validation("negative input");
      },
      execute: vi.fn(),
    };

    const outcome = await runTool(guarded, -1, audit);

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe("negative input");
    expect(guarded.execute).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "test_tool", ok: false, error: "negative input" })
    );
  });

  it("unexpected execute throw hides the raw message, keeps the error class", async () => {
    const failing = {
      name: "boom_tool",
      description: "test",
      readOnly: true,
      execute: async () => {
        throw new Error("secret connection string");
      },
    };

    const outcome = await runTool(failing, undefined, vi.fn());

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe("Error"); // raw message never surfaces
  });

  it("execute throw → ok:false; the tool never breaks the caller (§37)", async () => {
    const failing = {
      name: "boom_tool",
      description: "test",
      readOnly: true,
      execute: async () => {
        throw new Error("db down");
      },
    };

    const outcome = await runTool(failing, undefined, vi.fn());

    expect(outcome.ok).toBe(false);
    expect(outcome.data).toBeUndefined();
  });
});

describe("getCurrentLessonTool", () => {
  it("delegates to resolveSkillForSession with session + grade", async () => {
    const session = { _id: "s1", skillId: "skill-1", studentId: "st1" } as never;
    vi.mocked(resolveSkillForSession).mockResolvedValue({
      subjectName: "Mathematics",
      skillId: "skill-1",
      skillCode: "M1.1",
      skillName: "Add within 20",
      objective: "",
      lessonTitle: "",
      lessonBody: "",
      examples: [],
      items: [],
      masteryLines: [],
    } as never);

    const outcome = await runTool(getCurrentLessonTool, {
      session,
      gradeLevelId: null,
    } as LessonToolInput);

    expect(outcome.ok).toBe(true);
    expect(resolveSkillForSession).toHaveBeenCalledWith(session, null);
    expect(outcome.data?.skillName).toBe("Add within 20");
  });
});

describe("searchCurriculumTool", () => {
  it("validates: rejects empty/short queries", async () => {
    await expect(runTool(searchCurriculumTool, { query: "" }, vi.fn())).resolves.toMatchObject({
      ok: false,
    });
    await expect(runTool(searchCurriculumTool, { query: "  x " }, vi.fn())).resolves.toMatchObject({
      ok: false,
    });
    expect(searchCurriculum).not.toHaveBeenCalled();
  });

  it("clamps oversized queries instead of rejecting them", async () => {
    vi.mocked(searchCurriculum).mockResolvedValue([]);
    const longQuery = "fractions ".repeat(60); // > 300 chars

    const outcome = await runTool(searchCurriculumTool, { query: longQuery }, vi.fn());

    expect(outcome.ok).toBe(true);
    const passed = vi.mocked(searchCurriculum).mock.calls[0][0];
    expect(passed.query.length).toBeLessThanOrEqual(300);
  });

  it("passes scope filters through to retrieval", async () => {
    vi.mocked(searchCurriculum).mockResolvedValue([]);

    await runTool(
      searchCurriculumTool,
      { query: "numerator", subjectId: "sub1", skillId: "sk1", limit: 2 },
      vi.fn()
    );

    expect(searchCurriculum).toHaveBeenCalledWith({
      query: "numerator",
      subjectId: "sub1",
      skillId: "sk1",
      limit: 2,
    });
  });

  it("is declared read-only (§15 capability rule)", () => {
    expect(getCurrentLessonTool.readOnly).toBe(true);
    expect(searchCurriculumTool.readOnly).toBe(true);
  });
});
