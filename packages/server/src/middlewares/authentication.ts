/**
 * JWT authentication middleware.
 *
 * When SSO is active (JWT_SECRET is set), validates Bearer tokens from the
 * Authorization header and attaches req.user. Falls back gracefully to the
 * existing basic-auth / API-key flow when SSO is not configured, so existing
 * deployments are not broken.
 */
import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { verifyAccessToken, JwtPayload } from '../enterprise/auth/JwtService'
import { getUserById } from '../enterprise/auth/authService'
import { UserRole } from '../database/entities/User'

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string
                email: string
                role: UserRole
            }
        }
    }
}

export const isSSOEnabled = (): boolean => !!process.env.JWT_SECRET

/**
 * Middleware that validates a JWT Bearer token.
 * Must be used on routes that require authentication when SSO is active.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    if (!isSSOEnabled()) return next()

    const authHeader = (req.headers['authorization'] ?? req.headers['Authorization']) as string | undefined
    const token = authHeader?.split('Bearer ').pop()

    if (!token) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Authentication required' })
    }

    try {
        const payload: JwtPayload = verifyAccessToken(token)
        const user = await getUserById(payload.sub)
        if (!user || !user.isActive) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ error: 'User not found or inactive' })
        }
        req.user = { id: user.id, email: user.email, role: user.role }
        next()
    } catch {
        return res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Invalid or expired token' })
    }
}

/** Role-based access control guard. Use after requireAuth. */
export const requireRole = (...roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => {
    if (!isSSOEnabled()) return next()
    if (!req.user) return res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Unauthenticated' })
    if (!roles.includes(req.user.role)) {
        return res.status(StatusCodes.FORBIDDEN).json({ error: `Role '${req.user.role}' is not allowed. Required: ${roles.join(' | ')}` })
    }
    next()
}
