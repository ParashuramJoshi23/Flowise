// Prevent transitive load of full app server and its heavy deps
jest.mock('../../src/utils/getRunningExpressApp', () => ({
    getRunningExpressApp: jest.fn()
}))


import { hashPassword, comparePassword } from '../../src/enterprise/auth/authService'

// Only test pure functions that don't need DB (loginWithPassword etc. require mocking the full app)
describe('authService — password hashing', () => {
    it('hashPassword produces a bcrypt hash', async () => {
        const hash = await hashPassword('hunter2')
        expect(hash).toMatch(/^\$2[ab]\$/)
    })

    it('comparePassword returns true for correct password', async () => {
        const hash = await hashPassword('correct-horse-battery-staple')
        const result = await comparePassword('correct-horse-battery-staple', hash)
        expect(result).toBe(true)
    })

    it('comparePassword returns false for wrong password', async () => {
        const hash = await hashPassword('right-password')
        const result = await comparePassword('wrong-password', hash)
        expect(result).toBe(false)
    })

    it('two hashes of the same password differ (salting)', async () => {
        const h1 = await hashPassword('same')
        const h2 = await hashPassword('same')
        expect(h1).not.toBe(h2)
        // Both still validate
        await expect(comparePassword('same', h1)).resolves.toBe(true)
        await expect(comparePassword('same', h2)).resolves.toBe(true)
    })
})
