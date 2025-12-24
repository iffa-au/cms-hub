import jwt from "jsonwebtoken";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export type JwtPayload = { sub: string; role: string };

export function signAccessToken(payload: JwtPayload) {
  const secret = getEnv("JWT_ACCESS_SECRET");
  const ttl = getEnv("ACCESS_TOKEN_TTL");
  return jwt.sign(payload, secret, { expiresIn: ttl });
}

export function signRefreshToken(payload: JwtPayload) {
  const secret = getEnv("JWT_REFRESH_SECRET");
  const ttl = getEnv("REFRESH_TOKEN_TTL");
  return jwt.sign(payload, secret, { expiresIn: ttl });
}

export function verifyAccessToken(token: string) {
  const secret = getEnv("JWT_ACCESS_SECRET");
  return jwt.verify(token, secret) as JwtPayload & jwt.JwtPayload;
}

export function verifyRefreshToken(token: string) {
  const secret = getEnv("JWT_REFRESH_SECRET");
  return jwt.verify(token, secret) as JwtPayload & jwt.JwtPayload;
}

export function generateToken(user: { _id: string; role: string }) {
  const payload: JwtPayload = { sub: user._id.toString(), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return { accessToken, refreshToken };
}
