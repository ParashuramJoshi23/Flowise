import { signTokens, verifyAccessToken, verifyRefreshToken } from '../../src/enterprise/auth/JwtService'
import { User } from '../../src/database/entities/User'

const mockUser = (): User => {
    const u = new User()
    u.id = 'user-uuid-123'
    u.email = 'alice@acme.com'
    u.role = 'admin'
    u.isActive = true
    return u
}

describe('JwtService', () => {
    beforeEach(() => {
        process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long'
        process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-also-long-enough'
    })

    afterEach(() => {
        delete process.env.JWT_SECRET
        delete process.env.JWT_REFRESH_SECRET
    })

    describe('signTokens', () => {
        it('returns accessToken, refreshToken, and expiresIn', () => {
            const result = signTokens(mockUser())
            expect(result.accessToken).toBeDefined()
            expect(result.refreshToken).toBeDefined()
            expect(result.expiresIn).toBe(3600)
        })

        it('access token encodes email and role', () => {
            const { accessToken } = signTokens(mockUser())
            const payload = verifyAccessToken(accessToken)
            expect(payload.email).toBe('alice@acme.com')
            expect(payload.role).toBe('admin')
            expect(payload.sub).toBe('user-uuid-123')
        })
    })

    describe('verifyAccessToken', () => {
        it('throws on tampered token', () => {
            const { accessToken } = signTokens(mockUser())
            const tampered = accessToken.slice(0, -5) + 'XXXXX'
            expect(() => verifyAccessToken(tampered)).toThrow()
        })

        it('throws when JWT_SECRET is wrong', () => {
            const { accessToken } = signTokens(mockUser())
            process.env.JWT_SECRET = 'totally-different-secret-also-long'
            expect(() => verifyAccessToken(accessToken)).toThrow()
        })
    })

    describe('verifyRefreshToken', () => {
        it('returns sub from a valid refresh token', () => {
            const { refreshToken } = signTokens(mockUser())
            const payload = verifyRefreshToken(refreshToken)
            expect(payload.sub).toBe('user-uuid-123')
        })

        it('throws when JWT_SECRET is missing', () => {
            delete process.env.JWT_SECRET
            expect(() => signTokens(mockUser())).toThrow('JWT_SECRET environment variable is required')
        })
    })
})
