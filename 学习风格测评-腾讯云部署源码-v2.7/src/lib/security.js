import { createHash, timingSafeEqual } from "node:crypto";

function digest(value) {
  return createHash("sha256").update(value).digest();
}

export function hasValidBearerToken(header, expectedToken) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  if (typeof expectedToken !== "string" || expectedToken.length === 0) return false;
  const suppliedToken = header.slice("Bearer ".length);
  return timingSafeEqual(digest(suppliedToken), digest(expectedToken));
}
