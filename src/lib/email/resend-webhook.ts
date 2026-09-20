import { createHmac, timingSafeEqual } from "crypto";

// Resend webhooks are signed via Svix.
// Headers: svix-id, svix-timestamp, svix-signature ("v1,<base64sig> v1,<base64sig>")
// Signed payload: `${svix_id}.${svix_timestamp}.${rawBody}`
// Secret: `whsec_<base64>` — decode the base64 portion for the HMAC key.
export function verifySvix(opts: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  rawBody: string;
  nowSec?: number;
  toleranceSec?: number;
}): boolean {
  const {
    secret,
    svixId,
    svixTimestamp,
    svixSignature,
    rawBody,
    nowSec = Math.floor(Date.now() / 1000),
    toleranceSec = 60 * 5,
  } = opts;
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(nowSec - ts) > toleranceSec) return false;

  const secretB64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(secretB64, "base64");
  } catch {
    return false;
  }
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", keyBytes).update(signedPayload).digest("base64");
  const expectedBuf = Buffer.from(expected);

  const parts = svixSignature.split(" ");
  for (const part of parts) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

// Map Resend event type -> row status in email_send_log.
export function statusFromEvent(eventType: string): string | null {
  switch (eventType) {
    case "email.sent":
    case "email.delivery_delayed":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.failed":
      return "failed";
    default:
      return null;
  }
}

// Ordering so a late "sent" webhook doesn't overwrite "delivered".
export const STATUS_RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivery_delayed: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  bounced: 5,
  complained: 5,
  failed: 5,
};

export function shouldAdvanceStatus(current: string, next: string): boolean {
  const c = STATUS_RANK[current] ?? 0;
  const n = STATUS_RANK[next] ?? 0;
  return n >= c;
}

// Compute the signature a caller would send for a given payload — useful for tests
// and for constructing valid outbound signatures.
export function signSvix(opts: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  rawBody: string;
}): string {
  const { secret, svixId, svixTimestamp, rawBody } = opts;
  const secretB64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const keyBytes = Buffer.from(secretB64, "base64");
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const sig = createHmac("sha256", keyBytes).update(signedPayload).digest("base64");
  return `v1,${sig}`;
}