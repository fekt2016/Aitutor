import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assertRole,
  isParentOfLinks,
  isOwnerOf,
  isAdminUser,
  getSessionUser,
  requireParentOf,
  requireOwner,
  type SessionUser,
  type ParentChildLink,
} from "./authorize";
import { AppError } from "./errors";

// DB-dependent wrappers: mock the model + the session source.
vi.mock("@/models", () => ({
  ParentChildModel: { find: vi.fn() },
}));

vi.mock("@/features/auth/nextauth", () => ({
  auth: vi.fn(),
}));

import { ParentChildModel } from "@/models";
import { auth } from "@/features/auth/nextauth";

const findMock = vi.mocked(ParentChildModel.find);
const authMock = vi.mocked(auth);

// authorize.ts calls ParentChildModel.find(...).select(...).lean()
const chain = {
  select: vi.fn().mockReturnThis(),
  lean: vi.fn(),
};

function mockLinks(links: { parentId: string; childId: string }[]) {
  chain.lean.mockResolvedValue(links as never);
}

const parent: SessionUser = {
  id: "p1",
  role: "parent",
  name: "P",
  email: "p@x.com",
  superAdmin: false,
};
const student: SessionUser = {
  id: "s1",
  role: "student",
  name: "S",
  email: "s@x.com",
  superAdmin: false,
};
const admin: SessionUser = {
  id: "a1",
  role: "admin",
  name: "A",
  email: "a@x.com",
  superAdmin: false,
};

const links: ParentChildLink[] = [{ parentId: "p1", childId: "s1" }];

beforeEach(() => {
  findMock.mockReset();
  chain.select.mockClear();
  chain.lean.mockReset();
  authMock.mockReset();
  findMock.mockReturnValue(chain as never);
});

describe("assertRole", () => {
  it("returns the user when the role is allowed", () => {
    expect(assertRole(parent, ["parent", "admin"])).toBe(parent);
  });

  it("throws FORBIDDEN for a disallowed role", () => {
    expect(() => assertRole(student, ["parent"])).toThrow(AppError);
    try {
      assertRole(student, ["parent"]);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("FORBIDDEN");
      expect((error as AppError).statusCode).toBe(403);
    }
  });
});

describe("isParentOfLinks / isOwnerOf (pure logic)", () => {
  it("detects a valid parent↔child link", () => {
    expect(isParentOfLinks("p1", "s1", links)).toBe(true);
    expect(isParentOfLinks("p1", "s2", links)).toBe(false);
    expect(isParentOfLinks("p9", "s1", links)).toBe(false);
  });

  it("lets a student access only their own data", () => {
    expect(isOwnerOf(student, "s1", links)).toBe(true);
    expect(isOwnerOf(student, "s2", links)).toBe(false);
  });

  it("lets an admin audit any student", () => {
    expect(isOwnerOf(admin, "s1", links)).toBe(true);
    expect(isOwnerOf(admin, "s999", links)).toBe(true);
  });

  it("lets a linked parent but not an unlinked parent", () => {
    expect(isOwnerOf(parent, "s1", links)).toBe(true);
    expect(isOwnerOf({ ...parent, id: "p2" }, "s1", links)).toBe(false);
  });

  it("isAdminUser recognizes admin/superadmin", () => {
    expect(isAdminUser(admin)).toBe(true);
    expect(isAdminUser({ ...admin, role: "superadmin" })).toBe(true);
    expect(isAdminUser(parent)).toBe(false);
    expect(isAdminUser(student)).toBe(false);
  });
});

describe("getSessionUser", () => {
  it("throws UNAUTHORIZED when there is no session", async () => {
    authMock.mockResolvedValue(null as never);
    await expect(getSessionUser()).rejects.toMatchObject({ code: "UNAUTHORIZED", statusCode: 401 });
  });

  it("throws UNAUTHORIZED when the session lacks a user id", async () => {
    authMock.mockResolvedValue({ user: {} } as never);
    await expect(getSessionUser()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns the session user when authenticated", async () => {
    authMock.mockResolvedValue({ user: parent } as never);
    await expect(getSessionUser()).resolves.toEqual(parent);
  });
});

describe("requireParentOf (DB-backed)", () => {
  it("allows an admin without a link", async () => {
    await expect(requireParentOf(admin, "s1")).resolves.toBeUndefined();
  });

  it("rejects a student outright", async () => {
    await expect(requireParentOf(student, "s1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a linked parent", async () => {
    mockLinks([{ parentId: "p1", childId: "s1" }]);
    await expect(requireParentOf(parent, "s1")).resolves.toBeUndefined();
  });

  it("blocks a parent who is not linked to the student", async () => {
    mockLinks([{ parentId: "p1", childId: "sX" }]);
    await expect(requireParentOf(parent, "s1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("requireOwner (DB-backed)", () => {
  it("allows the student themself", async () => {
    await expect(requireOwner(student, "s1")).resolves.toBeUndefined();
  });

  it("allows an admin", async () => {
    await expect(requireOwner(admin, "s1")).resolves.toBeUndefined();
  });

  it("allows a linked parent", async () => {
    mockLinks([{ parentId: "p1", childId: "s1" }]);
    await expect(requireOwner(parent, "s1")).resolves.toBeUndefined();
  });

  it("blocks an unlinked parent", async () => {
    mockLinks([]);
    await expect(requireOwner(parent, "s1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks a student trying to reach another student's data", async () => {
    await expect(requireOwner(student, "s2")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
