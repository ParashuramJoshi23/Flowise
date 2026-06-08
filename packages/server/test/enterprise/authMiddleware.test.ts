/**
 * Authentication middleware unit tests.
 */
import { Request, Response, NextFunction } from 'express'
import { requireAuth, requireRole, isSSOEnabled } from '../../src/middlewares/authentication'
import { signTokens } from '../../src/enterprise/auth/JwtService'
import { User } from '../../src/database/entities/User'

jest.mock('../../src/enterprise/auth/authService', () => ({
    getUserById: jest.fn()
}))

import { getUserById } from '../../src/enterprise/auth/authService'

const mockUser = (overrides: Partial<User> = {}): User => {
    const u = new User()
    u.id = 'user-id-1'
    u.email = 'admin@corp.com'
    u.role = 'admin'
    u.isActive = true
    return Object.assign(u, overrides)
}

const makeReqResMock = (authHeader?: string) => {
    const req = { headers: {} } as Partial<Request>
    if (authHeader) req.headers!['authorization'] = authHeader
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    } as Partial<Response>
    const next = jest.fn() as NextFunction
    return { req: req as Request, res: res as Response, next }
}

describe('isSSOEnabled', () => {
    it('returns false when JWT_SECRET not set', () => {
        delete process.env.JWT_SECRET
        expect(isSSOEnabled()).toBe(false)
    })

    it('returns true when JWT_SECRET is set', () => {
        process.env.JWT_SECRET = 'a-very-long-test-secret-of-32-chars!!'
        expect(isSSOEnabled()).toBe(true)
        delete process.env.JWT_SECRET
    })
})

describe('requireAuth', () => {
    beforeEach(() => {
        process.env.JWT_SECRET = 'a-very-long-test-secret-of-32-chars!!'
    })

    afterEach(() => {
        delete process.env.JWT_SECRET
        jest.clearAllMocks()
    })

    it('calls next() when SSO is disabled', async () => {
        delete process.env.JWT_SECRET
        const { req, res, next } = makeReqResMock()
        await requireAuth(req, res, next)
        expect(next).toHaveBeenCalledTimes(1)
        expect(res.status).not.toHaveBeenCalled()
    })

    it('returns 401 when no Authorization header', async () => {
        const { req, res, next } = makeReqResMock()
        await requireAuth(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
        expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 for a malformed token', async () => {
        const { req, res, next } = makeReqResMock('Bearer not.a.valid.jwt')
        await requireAuth(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
    })

    it('returns 401 when user is not found in DB', async () => {
        const user = mockUser()
        const { accessToken } = signTokens(user)
        ;(getUserById as jest.Mock).mockResolvedValue(null)

        const { req, res, next } = makeReqResMock(`Bearer ${accessToken}`)
        await requireAuth(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
    })

    it('returns 401 when user is inactive', async () => {
        const user = mockUser({ isActive: false })
        const { accessToken } = signTokens(user)
        ;(getUserById as jest.Mock).mockResolvedValue(user)

        const { req, res, next } = makeReqResMock(`Bearer ${accessToken}`)
        await requireAuth(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
    })

    it('calls next() and sets req.user for a valid token', async () => {
        const user = mockUser()
        const { accessToken } = signTokens(user)
        ;(getUserById as jest.Mock).mockResolvedValue(user)

        const { req, res, next } = makeReqResMock(`Bearer ${accessToken}`)
        await requireAuth(req, res, next)
        expect(next).toHaveBeenCalledTimes(1)
        expect((req as any).user.email).toBe('admin@corp.com')
        expect((req as any).user.role).toBe('admin')
    })
})

describe('requireRole', () => {
    beforeEach(() => {
        process.env.JWT_SECRET = 'a-very-long-test-secret-of-32-chars!!'
    })

    afterEach(() => {
        delete process.env.JWT_SECRET
    })

    it('calls next() when SSO is disabled', () => {
        delete process.env.JWT_SECRET
        const { req, res, next } = makeReqResMock()
        requireRole('admin')(req, res, next)
        expect(next).toHaveBeenCalledTimes(1)
    })

    it('returns 401 when req.user is not set', () => {
        const { req, res, next } = makeReqResMock()
        requireRole('admin')(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
    })

    it('returns 403 when user role is insufficient', () => {
        const { req, res, next } = makeReqResMock()
        ;(req as any).user = { id: '1', email: 'viewer@corp.com', role: 'viewer' }
        requireRole('admin')(req, res, next)
        expect(res.status).toHaveBeenCalledWith(403)
    })

    it('calls next() when user has required role', () => {
        const { req, res, next } = makeReqResMock()
        ;(req as any).user = { id: '1', email: 'admin@corp.com', role: 'admin' }
        requireRole('admin', 'editor')(req, res, next)
        expect(next).toHaveBeenCalledTimes(1)
    })
})
