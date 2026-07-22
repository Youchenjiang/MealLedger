import { describe, expect, test } from "vitest";
import { rebindLocalWorkspace } from "./workspaceHandoff";

describe("cloud workspace handoff", () => {
  test("rebinds local records and audit events to the verified user", () => {
    const records = [{ id: "record-1", userId: "local-user" }, { id: "record-2", userId: "other-user" }] as never[];
    const auditEvents = [{ id: "audit-1", userId: "local-user" }, { id: "audit-2", userId: "other-user" }] as never[];

    const result = rebindLocalWorkspace(records, auditEvents, "verified-user");

    expect(result.records.map((record) => record.userId)).toEqual(["verified-user", "verified-user"]);
    expect(result.auditEvents.map((event) => event.userId)).toEqual(["verified-user", "verified-user"]);
  });

  test("does not rebind an empty or local-only user id", () => {
    const records = [{ id: "record-1", userId: "local-user" }] as never[];
    const auditEvents = [{ id: "audit-1", userId: "local-user" }] as never[];

    expect(rebindLocalWorkspace(records, auditEvents, " ")).toEqual({ records, auditEvents });
  });
});
