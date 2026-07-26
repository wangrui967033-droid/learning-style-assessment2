import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

function digest(value) {
  return createHash("sha256").update(value).digest();
}

export function hasValidBearerToken(header, expectedToken) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  if (typeof expectedToken !== "string" || expectedToken.length === 0) return false;
  const suppliedToken = header.slice("Bearer ".length);
  return timingSafeEqual(digest(suppliedToken), digest(expectedToken));
}

export function generateOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function maskPhone(phone) {
  const match = typeof phone === "string" ? phone.match(/^(\d{3})\d{4}(\d{4})$/) : null;
  return match ? `${match[1]}****${match[2]}` : null;
}
