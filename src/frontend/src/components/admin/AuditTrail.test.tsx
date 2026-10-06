import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import type { AuditEntry } from "@/lib/admin-api";

const { listMock, sessionMock } = vi.hoisted(() => ({ listMock: vi.fn(), sessionMock: vi.fn() }));
vi.mock("@/lib/admin-api", () => ({ adminListAudit: listMock, getAdminSession: sessionMock }));

import AuditTrail from "./AuditTrail";

// #513 — the record's history section, ADMIN only like its API.

const entry: AuditEntry = {
  id: "12",
  createdAt: "2026-10-04T16:02:00.000Z",
  action: "UPDATE",
  entity: "Speaker",
  entityId: "7",
  entityLabel: "Ada Lovelace",
  channel: "EDIT_LINK",
  actorUserId: null,
  actorLabel: "Ada Lovelace (speaker #7)",
  apiKeyId: null,
  ip: null,
  changes: { company: { before: "Analytical Engines", after: "Babbage & Co" } },
};

beforeEach(() => {
  listMock.mockReset();
  sessionMock.mockReset().mockResolvedValue({ role: "ADMIN" });
});

describe("AuditTrail", () => {
  it("should render nothing for an editor, without asking the API it would refuse", async () => {
    sessionMock.mockResolvedValue({ role: "EDITOR" });

    const { container } = render(<AuditTrail entity="Speaker" entityId={7} />);

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(listMock).not.toHaveBeenCalled();
  });

  it("should show who changed what, through which channel, with the values before and after", async () => {
    listMock.mockResolvedValue({ data: { items: [entry], nextCursor: null }, status: 200 });

    render(<AuditTrail entity="Speaker" entityId={7} />);

    expect(await screen.findByText("Modifié")).toBeInTheDocument();
    expect(screen.getByText("(lien de modification)")).toBeInTheDocument();
    expect(screen.getByText("Analytical Engines")).toBeInTheDocument();
    expect(screen.getByText("Babbage & Co")).toBeInTheDocument();
  });

  it("should say so when the history cannot be loaded", async () => {
    listMock.mockResolvedValue({ data: null, status: 0 });

    render(<AuditTrail entity="Speaker" entityId={7} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Impossible de charger l'historique");
  });
});
