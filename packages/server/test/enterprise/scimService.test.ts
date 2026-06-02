/**
 * SCIM service unit tests.
 */

import { scimServiceProviderConfig } from '../../src/enterprise/scim/scimService'

// ---- Pure helpers — no DB needed ----

describe('scimServiceProviderConfig', () => {
    const BASE = 'https://flowise.example.com/api/v1/scim/v2'

    it('returns correct schema identifier', () => {
        const cfg = scimServiceProviderConfig(BASE) as any
        expect(cfg.schemas).toContain('urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig')
    })

    it('advertises patch support', () => {
        const cfg = scimServiceProviderConfig(BASE) as any
        expect(cfg.patch.supported).toBe(true)
    })

    it('sets location relative to provided baseUrl', () => {
        const cfg = scimServiceProviderConfig(BASE) as any
        expect(cfg.meta.location).toBe(`${BASE}/ServiceProviderConfig`)
    })

    it('advertises filter support with maxResults 100', () => {
        const cfg = scimServiceProviderConfig(BASE) as any
        expect(cfg.filter.supported).toBe(true)
        expect(cfg.filter.maxResults).toBe(100)
    })

    it('advertises oauth bearer token auth scheme', () => {
        const cfg = scimServiceProviderConfig(BASE) as any
        expect(cfg.authenticationSchemes[0].type).toBe('oauthbearertoken')
    })

    it('bulk is not supported', () => {
        const cfg = scimServiceProviderConfig(BASE) as any
        expect(cfg.bulk.supported).toBe(false)
    })
})

// ---- DB-dependent helpers via module-level mocks ----

// The mock factory must not reference out-of-scope variables.
// We expose the mock repo via a module-level variable and update it per test.
const mockFindAndCount = jest.fn()

jest.mock('../../src/utils/getRunningExpressApp', () => ({
    getRunningExpressApp: () => ({
        AppDataSource: {
            getRepository: () => ({
                findAndCount: mockFindAndCount,
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockImplementation((x: any) => x),
                save: jest.fn().mockImplementation((x: any) => Promise.resolve({ id: 'u-1', ...x })),
                delete: jest.fn().mockResolvedValue({ affected: 1 })
            })
        }
    })
}))

describe('scimListUsers', () => {
    beforeEach(() => {
        mockFindAndCount.mockReset()
    })

    it('returns empty list response when no users', async () => {
        mockFindAndCount.mockResolvedValue([[], 0])
        const { scimListUsers } = await import('../../src/enterprise/scim/scimService')
        const result = await scimListUsers('https://example.com/scim/v2/Users', {}) as any
        expect(result.totalResults).toBe(0)
        expect(result.Resources).toHaveLength(0)
        expect(result.schemas).toContain('urn:ietf:params:scim:api:messages:2.0:ListResponse')
    })

    it('passes userName eq filter as email where clause', async () => {
        mockFindAndCount.mockResolvedValue([[], 0])
        const { scimListUsers } = await import('../../src/enterprise/scim/scimService')
        await scimListUsers('https://example.com/scim/v2/Users', { filter: 'userName eq "bob@example.com"' })
        expect(mockFindAndCount).toHaveBeenCalledWith(
            expect.objectContaining({ where: { email: 'bob@example.com' } })
        )
    })

    it('returns matching users in Resources array', async () => {
        const users = [
            { id: 'u-1', email: 'alice@acme.com', name: 'Alice', isActive: true, createdDate: new Date(), updatedDate: new Date(), externalId: null }
        ]
        mockFindAndCount.mockResolvedValue([users, 1])
        const { scimListUsers } = await import('../../src/enterprise/scim/scimService')
        const result = await scimListUsers('https://example.com/scim/v2/Users', {}) as any
        expect(result.totalResults).toBe(1)
        expect(result.Resources[0].userName).toBe('alice@acme.com')
        expect(result.Resources[0].id).toBe('u-1')
    })

    it('maps startIndex and count to pagination', async () => {
        mockFindAndCount.mockResolvedValue([[], 0])
        const { scimListUsers } = await import('../../src/enterprise/scim/scimService')
        await scimListUsers('https://example.com/scim/v2/Users', { startIndex: 5, count: 10 })
        expect(mockFindAndCount).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 4, take: 10 })
        )
    })
})
