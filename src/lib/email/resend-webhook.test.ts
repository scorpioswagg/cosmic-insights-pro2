import { describe, it, expect } from "vitest";
import {
  verifySvix,
  signSvix,
  statusFromEvent,
  shouldAdvanceStatus,
  STATUS_RANK,
} from "./resend-webhook";

const SECRET = "whsec_" + Buffer.from("super-secret-key").toString("base64");
const ID = "msg_2abc";
const BODY = JSON.stringify({ type: "email.delivered", data: { email_id: "e_1" } });

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

describe("verifySvix — signature validation", () => {
  it("accepts a valid signature", () => {
    const ts = String(nowSec());
    const sig = signSvix({ secret: SECRET, svixId: ID, svixTimestamp: ts, rawBody: BODY });
    expect(
      verifySvix({ secret: SECRET, svixId: ID, svixTimestamp: ts, svixSignature: sig, rawBody: BODY }),
    ).toBe(true);
  });

  it("accepts when multiple signatures are provided and one matches", () => {
    const ts = String(nowSec());
    const good = signSvix({ secret: SECRET, svixId: ID, svixTimestamp: ts, rawBody: BODY });
    const combined = `v1,AAAAdeadbeef== ${good}`;
    expect(
      verifySvix({ secret: SECRET, svixId: ID, svixTimestamp: ts, svixSignature: combined, rawBody: BODY }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const ts = String(nowSec());
    const sig = signSvix({ secret: SECRET, svixId: ID, svixTimestamp: ts, rawBody: BODY });
    expect(
      verifySvix({
        secret: SECRET,
        svixId: ID,
        svixTimestamp: ts,
        svixSignature: sig,
        rawBody: BODY + " ",
      }),
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const ts = String(nowSec());
    const sig = signSvix({ secret: SECRET, svixId: ID, svixTimestamp: ts, rawBody: BODY });
    const otherSecret = "whsec_" + Buffer.from("other-key").toString("base64");
    expect(
      verifySvix({
        secret: otherSecret,
        svixId: ID,
        svixTimestamp: ts,
        svixSignature: sig,
        rawBody: BODY,
      }),
    ).toBe(false);
  });

  it("rejects when required headers are missing", () => {
    const ts = String(nowSec());
    const sig = signSvix({ secret: SECRET, svixId: ID, svixTimestamp: ts, rawBody: BODY });
    expect(verifySvix({ secret: SECRET, svixId: "", svixTimestamp: ts, svixSignature: sig, rawBody: BODY })).toBe(false);
    expect(verifySvix({ secret: SECRET, svixId: ID, svixTimestamp: "", svixSignature: sig, rawBody: BODY })).toBe(false);
    expect(verifySvix({ secret: SECRET, svixId: ID, svixTimestamp: ts, svixSignature: "", rawBody: BODY })).toBe(false);
  });

  it("rejects malformed signature header entries", () => {
    const ts = String(nowSec());
    expect(
      verifySvix({
        secret: SECRET,
        svixId: ID,
        svixTimestamp: ts,
        svixSignature: "not-a-valid-format",
        rawBody: BODY,
      }),
    ).toBe(false);
  });

  it("rejects non-numeric timestamps", () => {
    const sig = signSvix({ secret: SECRET, svixId: ID, svixTimestamp: "abc", rawBody: BODY });
    expect(
      verifySvix({ secret: SECRET, svixId: ID, svixTimestamp: "abc", svixSignature: sig, rawBody: BODY }),
    ).toBe(false);
  });
});

describe("verifySvix — replay protection", () => {
  it("rejects timestamps older than the tolerance window (default 5 min)", () => {
    const now = nowSec();
    const oldTs = String(now - 60 * 10); // 10 minutes ago
    const sig = signSvix({ secret: SECRET, svixId: ID, svixTimestamp: oldTs, rawBody: BODY });
    expect(
      verifySvix({
        secret: SECRET,
        svixId: ID,
        svixTimestamp: oldTs,
        svixSignature: sig,
        rawBody: BODY,
        nowSec: now,
      }),
    ).toBe(false);
  });

  it("rejects timestamps too far in the future", () => {
    const now = nowSec();
    const futureTs = String(now + 60 * 10);
    const sig = signSvix({ secret: SECRET, svixId: ID, svixTimestamp: futureTs, rawBody: BODY });
    expect(
      verifySvix({
        secret: SECRET,
        svixId: ID,
        svixTimestamp: futureTs,
        svixSignature: sig,
        rawBody: BODY,
        nowSec: now,
      }),
    ).toBe(false);
  });

  it("accepts timestamps within the tolerance window", () => {
    const now = nowSec();
    const ts = String(now - 60); // 1 min ago
    const sig = signSvix({ secret: SECRET, svixId: ID, svixTimestamp: ts, rawBody: BODY });
    expect(
      verifySvix({
        secret: SECRET,
        svixId: ID,
        svixTimestamp: ts,
        svixSignature: sig,
        rawBody: BODY,
        nowSec: now,
      }),
    ).toBe(true);
  });

  it("honors a custom tolerance window", () => {
    const now = nowSec();
    const ts = String(now - 30);
    const sig = signSvix({ secret: SECRET, svixId: ID, svixTimestamp: ts, rawBody: BODY });
    expect(
      verifySvix({
        secret: SECRET,
        svixId: ID,
        svixTimestamp: ts,
        svixSignature: sig,
        rawBody: BODY,
        nowSec: now,
        toleranceSec: 10,
      }),
    ).toBe(false);
  });
});

describe("statusFromEvent — event type mapping", () => {
  const cases: Array<[string, string | null]> = [
    ["email.sent", "sent"],
    ["email.delivery_delayed", "sent"],
    ["email.delivered", "delivered"],
    ["email.opened", "opened"],
    ["email.clicked", "clicked"],
    ["email.bounced", "bounced"],
    ["email.complained", "complained"],
    ["email.failed", "failed"],
    ["email.unknown", null],
    ["", null],
  ];
  it.each(cases)("maps %s -> %s", (evt, expected) => {
    expect(statusFromEvent(evt)).toBe(expected);
  });
});

describe("shouldAdvanceStatus — monotonic transitions", () => {
  it("advances forward through the lifecycle", () => {
    expect(shouldAdvanceStatus("pending", "sent")).toBe(true);
    expect(shouldAdvanceStatus("sent", "delivered")).toBe(true);
    expect(shouldAdvanceStatus("delivered", "opened")).toBe(true);
    expect(shouldAdvanceStatus("opened", "clicked")).toBe(true);
  });

  it("does not regress on late 'sent' after 'delivered'", () => {
    expect(shouldAdvanceStatus("delivered", "sent")).toBe(false);
  });

  it("does not regress on late 'delivered' after 'clicked'", () => {
    expect(shouldAdvanceStatus("clicked", "delivered")).toBe(false);
  });

  it("allows same-rank transitions (idempotent replays)", () => {
    expect(shouldAdvanceStatus("delivered", "delivered")).toBe(true);
    expect(shouldAdvanceStatus("bounced", "complained")).toBe(true); // both rank 5
  });

  it("terminal failures can arrive from any earlier state", () => {
    expect(shouldAdvanceStatus("pending", "bounced")).toBe(true);
    expect(shouldAdvanceStatus("sent", "failed")).toBe(true);
    expect(shouldAdvanceStatus("delivered", "complained")).toBe(true);
  });

  it("treats unknown statuses as rank 0", () => {
    expect(shouldAdvanceStatus("mystery", "sent")).toBe(true);
    expect(shouldAdvanceStatus("delivered", "mystery")).toBe(false);
  });

  it("STATUS_RANK reflects the documented ordering", () => {
    expect(STATUS_RANK.pending).toBeLessThan(STATUS_RANK.sent);
    expect(STATUS_RANK.sent).toBeLessThan(STATUS_RANK.delivered);
    expect(STATUS_RANK.delivered).toBeLessThan(STATUS_RANK.opened);
    expect(STATUS_RANK.opened).toBeLessThan(STATUS_RANK.clicked);
    expect(STATUS_RANK.clicked).toBeLessThan(STATUS_RANK.bounced);
  });
});