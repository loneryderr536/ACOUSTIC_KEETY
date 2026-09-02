import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET environment variable is required');
  }
  return secret;
}
const ACCESS_TOKEN_EXPIRY = '1h';

interface TokenPayload {
  userId: string;
  role: string;
  plan: string;
}

export function issueAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}
