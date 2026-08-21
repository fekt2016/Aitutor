/**
 * Admin curriculum API tests (§27 taxonomy CRUD) — hermetic: mocked models,
 * session and chunker. Covers the §3 role gate, the per-type field whitelist,
 * required-field enforcement, delete policy (soft vs guarded hard) and the
 * chunk-reindex trigger that keeps retrieval in sync with edits.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/features/auth/nextauth", () => ({ auth: vi.fn() }));
vi.mock("@/server/db", () => ({ ensureDb: vi.fn() }));
vi.mock("@/features/tutor/curriculum/chunker", () => ({
  reindexSkillChunks: vi.fn().mockResolvedValue(3),
}));
vi.mock("./service", () => ({ getGroundedView: vi.fn() }));

vi.mock("@/models", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models")>();
  const mock = () => vi.fn();
  return {
    ...actual,
    StrandModel: { create: mock(), findById: mock(), countDocuments: mock() },
    SubStrandModel: { create: mock(), findById: mock(), countDocuments: mock() },
    ContentStandardModel: { create: mock(), findById: mock(), countDocuments: mock() },
    SkillModel: { create: mock(), findById: mock() },
    LessonModel: { create: mock(), findById: mock() },
    PracticeItemModel: { create: mock(), findById: mock() },
  };
});

import { auth } from "@/features/auth/nextauth";
import {
  StrandModel,
  SkillModel,
  SubStrandModel,
  LessonModel,
} from "@/models";
import { reindexSkillChunks } from "@/features/tutor/curriculum/chunker";
import { getGroundedView } from "./service";
import { POST as createResource } from "@/app/api/v1/admin/curriculum/[type]/route";
import { PATCH as updateResource, DELETE as deleteResource } from "@/app/api/v1/admin/curriculum/[type]/[id]/route";
import { GET as groundedView } from "@/app/api/v1/admin/curriculum/[type]/[id]/grounded/route";
import type { SessionUser } from "@/lib/authorize";

const admin: SessionUser = {
  id: "a1",
  role: "admin",
  name: "A",
  email: "a@x.com",
  superAdmin: false,
};

function ctx(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

function jsonReq(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function editableDoc(id: string, extra: Record<string, unknown> = {}) {
  const doc: Record<string, unknown> = {
    set: vi.fn(),
    toObject: vi.fn().mockReturnValue({ _id: id, ...extra }),
    _id: id,
    ...extra,
  };
  doc.save = vi.fn().mockResolvedValue(doc);
  return doc;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: admin } as never);
});

/* ------------------------------- authz ------------------------------- */

describe("authz — admin-only surface", () => {
  it("401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await createResource(jsonReq("http://x/skill", {}), ctx({ type: "skill" }));
    expect(res.status).toBe(401);
  });

  it("403 for a non-admin role", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { ...admin, role: "parent" },
    } as never);
    const res = await createResource(jsonReq("http://x/skill", {}), ctx({ type: "skill" }));
    expect(res.status).toBe(403);
  });
});

/* -------------------------------- create ------------------------------ */

describe("POST /[type] — create", () => {
  it("404 on an unknown resource type", async () => {
    const res = await createResource(jsonReq("http://x/nope", {}), ctx({ type: "nope" }));
    expect(res.status).toBe(404);
  });

  it("400 on fields outside the type whitelist", async () => {
    const res = await createResource(
      jsonReq("http://x/skill", { code: "s1", name: "S", studentId: "hack" }),
      ctx({ type: "skill" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.details.unknownFields).toEqual(["studentId"]);
    expect(SkillModel.create).not.toHaveBeenCalled();
  });

  it("400 when required fields are missing", async () => {
    const res = await createResource(
      jsonReq("http://x/item", { skillId: "sk1", type: "mcq" }),
      ctx({ type: "item" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.details.missing).toEqual(["prompt", "answer", "difficulty"]);
  });

  it("201 creates and reindexes the owning skill's chunks", async () => {
    const created = { toObject: () => ({ _id: "new-id", skillId: "sk-9" }) };
    vi.mocked(LessonModel.create).mockResolvedValue(created as never);

    const res = await createResource(
      jsonReq("http://x/lesson", { skillId: "sk-9", title: "T", markdownBody: "B" }),
      ctx({ type: "lesson" })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.lesson.id).toBe("new-id");
    expect(reindexSkillChunks).toHaveBeenCalledWith("sk-9");
  });

  it("taxonomy create does not trigger a reindex", async () => {
    vi.mocked(StrandModel.create).mockResolvedValue({
      toObject: () => ({ _id: "st-1" }),
    } as never);
    await createResource(
      jsonReq("http://x/strand", { subjectId: "sub-1", name: "Number" }),
      ctx({ type: "strand" })
    );
    expect(reindexSkillChunks).not.toHaveBeenCalled();
  });
});

/* -------------------------------- update ------------------------------ */

describe("PATCH /[type]/[id] — update", () => {
  it("400 on an empty update", async () => {
    const res = await updateResource(jsonReq("http://x/skill/s1", {}, "PATCH"), ctx({ type: "skill", id: "s1" }));
    expect(res.status).toBe(400);
  });

  it("applies whitelisted fields through save() and reindexes", async () => {
    const doc = editableDoc("s1", { _id: "s1" });
    vi.mocked(SkillModel.findById).mockResolvedValue(doc as never);

    const res = await updateResource(
      jsonReq("http://x/skill/s1", { name: "Renamed", active: false }, "PATCH"),
      ctx({ type: "skill", id: "s1" })
    );

    expect(res.status).toBe(200);
    expect(doc.set).toHaveBeenCalledWith({ name: "Renamed", active: false });
    expect(doc.save).toHaveBeenCalled();
    expect(reindexSkillChunks).toHaveBeenCalledWith("s1");
  });

  it("404 when the record does not exist", async () => {
    vi.mocked(SkillModel.findById).mockResolvedValue(null as never);
    const res = await updateResource(
      jsonReq("http://x/skill/ghost", { name: "X" }, "PATCH"),
      ctx({ type: "skill", id: "ghost" })
    );
    expect(res.status).toBe(404);
  });
});

/* -------------------------------- delete ------------------------------ */

describe("DELETE /[type]/[id] — delete policy", () => {
  it("soft-deletes content rows (active:false) and reindexes", async () => {
    const doc = editableDoc("sk-1");
    vi.mocked(SkillModel.findById).mockResolvedValue(doc as never);

    const res = await deleteResource(
      new NextRequest("http://x/skill/sk-1", { method: "DELETE" }),
      ctx({ type: "skill", id: "sk-1" })
    );

    expect(res.status).toBe(200);
    expect(doc.set).toHaveBeenCalledWith({ active: false });
    expect(doc.deleteOne).toBeUndefined();
    expect(reindexSkillChunks).toHaveBeenCalledWith("sk-1");
  });

  it("blocks hard delete while children exist (409)", async () => {
    const doc = editableDoc("str-1");
    vi.mocked(StrandModel.findById).mockResolvedValue(doc as never);
    vi.mocked(SubStrandModel.countDocuments).mockResolvedValue(2 as never);

    const res = await deleteResource(
      new NextRequest("http://x/strand/str-1", { method: "DELETE" }),
      ctx({ type: "strand", id: "str-1" })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.message).toContain("sub-strands");
    expect(doc.deleteOne).toBeUndefined();
  });

  it("hard-deletes a childless taxonomy node", async () => {
    const doc = { ...editableDoc("str-1"), deleteOne: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(StrandModel.findById).mockResolvedValue(doc as never);
    vi.mocked(SubStrandModel.countDocuments).mockResolvedValue(0 as never);

    const res = await deleteResource(
      new NextRequest("http://x/strand/str-1", { method: "DELETE" }),
      ctx({ type: "strand", id: "str-1" })
    );

    expect(res.status).toBe(200);
    expect(doc.deleteOne).toHaveBeenCalled();
  });
});

/* ----------------------------- grounded view -------------------------- */

describe("GET /[type]/[id]/grounded", () => {
  it("404 for non-skill types", async () => {
    const res = await groundedView(new NextRequest("http://x/item/i1/grounded"), ctx({ type: "item", id: "i1" }));
    expect(res.status).toBe(404);
  });

  it("returns the grounded view for a skill", async () => {
    vi.mocked(getGroundedView).mockResolvedValue({
      bundle: { skillName: "Fractions" },
      chunks: [],
    } as never);
    const res = await groundedView(new NextRequest("http://x/skill/s1/grounded"), ctx({ type: "skill", id: "s1" }));
    expect(res.status).toBe(200);
    expect(getGroundedView).toHaveBeenCalledWith("s1");
  });
});