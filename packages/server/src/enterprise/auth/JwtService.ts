import jwt from 'jsonwebtoken'
import { User } from '../../database/entities/User'

export interface JwtPayload {
    sub: string
    email: string
    role: string
    iat?: number
    exp?: number
}

export interface TokenPair {
    accessToken: string
    refreshToken: string
    expiresIn: number
}

const ACCESS_TOKEN_TTL = '1h'
const REFRESH_TOKEN_TTL = '7d'
const ACCESS_TOKEN_TTL_SECONDS = 3600

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET environment variable is required for enterprise SSO')
    return secret
}

function getRefreshSecret(): string {
    return process.env.JWT_REFRESH_SECRET || getJwtSecret() + '_refresh'
}

export function signTokens(user: User): TokenPair {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role }
    const accessToken = jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_TTL })
    const refreshToken = jwt.sign({ sub: user.id }, getRefreshSecret(), { expiresIn: REFRESH_TOKEN_TTL })
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS }
}

export function verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, getJwtSecret()) as JwtPayload
}

export function verifyRefreshToken(token: string): { sub: string } {
    return jwt.verify(token, getRefreshSecret()) as { sub: string }
}
