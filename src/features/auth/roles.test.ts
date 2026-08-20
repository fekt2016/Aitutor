import { describe, it, expect } from "vitest";
import { isRole, isAdminRole, ROLES, PARENT_ROLE, STUDENT_ROLE } from "./roles";

describe("roles", () => {
  it("exposes the five scoped roles", () => {
    expect(ROLES).toEqual(["superadmin", "admin", "teacher", "parent", "student"]);
  });

  it("validates roles", () => {
    expect(isRole("parent")).toBe(true);
    expect(isRole("student")).toBe(true);
    expect(isRole("guest")).toBe(false);
    expect(isRole("")).toBe(false);
  });

  it("recognizes admin roles", () => {
    expect(isAdminRole("superadmin")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole(PARENT_ROLE)).toBe(false);
    expect(isAdminRole(STUDENT_ROLE)).toBe(false);
  });
});
