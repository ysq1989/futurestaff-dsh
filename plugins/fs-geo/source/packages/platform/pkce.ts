import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import { GeoError } from "../core/errors.js";
function key(secret: string) {
  const k = Buffer.from(secret, "base64");
  if (k.length !== 32)
    throw new GeoError("LOGIN_NOT_CONFIGURED", 503, "GEO 登录配置尚未就绪");
  return k;
}
export function beginPkce(secret: string, now = Date.now()) {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify({ state, verifier, expires: now + 300000 })),
    cipher.final(),
  ]);
  return {
    state,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
    cookie: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      "base64url",
    ),
  };
}
export function finishPkce(
  secret: string,
  cookie: string,
  state: string,
  now = Date.now(),
) {
  try {
    const bytes = Buffer.from(cookie, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(secret),
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(12, 28));
    const value = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString(),
    ) as { state: string; verifier: string; expires: number };
    if (
      value.expires <= now ||
      Buffer.byteLength(state) !== Buffer.byteLength(value.state) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(value.state))
    )
      throw new Error();
    return value.verifier;
  } catch {
    throw new GeoError(
      "LOGIN_STATE_INVALID",
      400,
      "登录请求已失效，请重新开始",
    );
  }
}
