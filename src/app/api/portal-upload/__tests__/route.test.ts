import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createMockRequest, createAdminRequest } from "@/test/helpers";
import { GET, POST } from "../route";

// Blob storage + email are external side effects — stub them so the POST happy
// path exercises only the M7 parse/auto-import wiring.
vi.mock("@vercel/blob", () => ({
  put: vi.fn(async () => ({ url: "https://blob.example/report.csv" })),
}));
vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    ...actual,
    sendEmail: vi.fn(),
  };
});

/** Build an authenticated multipart portal-upload POST with a real File. */
function uploadPost(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append(
    "reportType",
    file.type === "text/csv" ? "csv" : file.type === "application/pdf" ? "pdf" : "excel",
  );
  return new NextRequest(
    new URL("/api/portal-upload?accessCode=AC&email=o@e.com", "http://localhost:3000"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { method: "POST", body: fd } as any,
  );
}

/** Wire up the db mocks every successful upload touches. */
function mockUploadDb() {
  // @ts-expect-error — db is a vi mock
  mockDb.clients = {
    findFirst: vi.fn().mockResolvedValue({ id: "c1", facility_id: "f1" }),
    findUnique: vi.fn().mockResolvedValue({ email: "o@e.com" }),
  };
  // @ts-expect-error — db is a vi mock
  mockDb.facilities = {
    findUnique: vi.fn().mockResolvedValue({ name: "Acme Storage" }),
    update: vi.fn().mockResolvedValue({}),
  };
  // @ts-expect-error — db is a vi mock
  mockDb.pms_reports = {
    create: vi.fn().mockResolvedValue({ id: "r1" }),
    update: vi.fn().mockResolvedValue({}),
  };
  // @ts-expect-error — db is a vi mock
  mockDb.facility_pms_rent_roll = {
    deleteMany: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({}),
  };
  // @ts-expect-error — db is a vi mock
  mockDb.facility_pms_snapshots = { upsert: vi.fn().mockResolvedValue({}) };
  // @ts-expect-error — db is a vi mock
  mockDb.facility_pms_units = { upsert: vi.fn().mockResolvedValue({}) };
}

// Pins the auth behavior after migrating portal-upload off its private
// resolveClient onto the shared authenticatePortalRequest. The POST happy path
// (Vercel Blob + multipart) is not exercised here; auth is the point.
const mockDb = vi.mocked(db, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/portal-upload", () => {
  it("401s without auth", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = { findFirst: vi.fn().mockResolvedValue(null) };
    const res = await GET(createMockRequest("/api/portal-upload"));
    expect(res.status).toBe(401);
  });

  it("returns a client's history scoped to their facility", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = {
      findFirst: vi.fn().mockResolvedValue({ id: "c1", facility_id: "f1" }),
    };
    // @ts-expect-error — db is a vi mock
    mockDb.pms_reports = { findMany: vi.fn().mockResolvedValue([{ id: "r1" }]) };
    const res = await GET(
      createMockRequest("/api/portal-upload?accessCode=AC&email=o@e.com")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toHaveLength(1);
    // @ts-expect-error — inspecting the mock
    expect(mockDb.pms_reports.findMany.mock.calls[0][0].where.facility_id).toBe("f1");
  });

  it("400s an admin that does not pass facilityId", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = { findFirst: vi.fn() };
    const res = await GET(createAdminRequest("/api/portal-upload"));
    expect(res.status).toBe(400);
  });

  it("lets an admin list a named facility", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = { findFirst: vi.fn() };
    // @ts-expect-error — db is a vi mock
    mockDb.pms_reports = { findMany: vi.fn().mockResolvedValue([]) };
    const res = await GET(createAdminRequest("/api/portal-upload?facilityId=f9"));
    expect(res.status).toBe(200);
    // @ts-expect-error — inspecting the mock
    expect(mockDb.pms_reports.findMany.mock.calls[0][0].where.facility_id).toBe("f9");
  });
});

describe("POST /api/portal-upload", () => {
  it("401s without auth (before any file handling)", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = { findFirst: vi.fn().mockResolvedValue(null) };
    const res = await POST(
      createMockRequest("/api/portal-upload", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });

  it("400s an admin — upload requires a client context", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = { findFirst: vi.fn() };
    const res = await POST(
      createAdminRequest("/api/portal-upload", { method: "POST" })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/portal-upload — M7 CSV auto-processing", () => {
  it("auto-imports a clean rent-roll CSV and marks it processed", async () => {
    mockUploadDb();
    const csv =
      "Unit,Tenant Name,Rent Rate,Total Due,Days Past Due\n" +
      "A1,Jane Doe,100,100,0\n" +
      "A2,Bob Roe,120,120,0\n";
    const res = await POST(
      uploadPost(new File([csv], "rent.csv", { type: "text/csv" }))
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("processed");

    // The rent roll was actually written and the report flipped to processed.
    // @ts-expect-error — inspecting the mock
    expect(mockDb.facility_pms_rent_roll.createMany).toHaveBeenCalledOnce();
    // @ts-expect-error — inspecting the mock
    const update = mockDb.pms_reports.update.mock.calls[0][0];
    expect(update.data.status).toBe("processed");
    expect(update.data.processed_by).toBe("auto");
  });

  it("holds an anomalous CSV for review WITHOUT importing, staging the parsed rows", async () => {
    mockUploadDb();
    // Duplicate unit numbers trip the anomaly gate.
    const csv =
      "Unit,Tenant Name,Rent Rate\n" + "A1,Jane,100\n" + "A1,Bob,120\n";
    const res = await POST(
      uploadPost(new File([csv], "dup.csv", { type: "text/csv" }))
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("needs_review");

    // Nothing published to facility data; rows staged for founder approval.
    // @ts-expect-error — inspecting the mock
    expect(mockDb.facility_pms_rent_roll.createMany).not.toHaveBeenCalled();
    // @ts-expect-error — inspecting the mock
    const update = mockDb.pms_reports.update.mock.calls[0][0];
    expect(update.data.status).toBe("needs_review");
    expect(update.data.report_data.type).toBe("rent_roll");
    expect(update.data.report_data.mappedRows).toHaveLength(2);
  });

  it("leaves a non-CSV upload at 'uploaded' for manual handling (no parse)", async () => {
    mockUploadDb();
    const res = await POST(
      uploadPost(new File(["%PDF-1.4 binary"], "scan.pdf", { type: "application/pdf" }))
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("uploaded");
    // The auto-process block only runs for text/csv → no status mutation.
    // @ts-expect-error — inspecting the mock
    expect(mockDb.pms_reports.update).not.toHaveBeenCalled();
    // @ts-expect-error — inspecting the mock
    expect(mockDb.facility_pms_rent_roll.createMany).not.toHaveBeenCalled();
  });
});
