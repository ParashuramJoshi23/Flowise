/**
 * Workspace service unit tests.
 *
 * All DB access is mocked; no live database required.
 */

// Explicit factory prevents Jest from loading the real module (which chains to @google-cloud/*)
jest.mock('../../src/utils/getRunningExpressApp', () => ({
    getRunningExpressApp: jest.fn()
}))

import { getRunningExpressApp } from '../../src/utils/getRunningExpressApp'
import {
    createWorkspace,
    listWorkspaces,
    addMember,
    removeMember,
    updateWorkspace,
    workspaceScopeWhere
} from '../../src/enterprise/workspaces/workspaceService'

const mockWorkspace = (overrides = {}) => ({
    id: 'ws-1',
    name: 'Acme Engineering',
    slug: 'acme-engineering',
    description: null,
    isActive: true,
    settings: null,
    createdDate: new Date('2025-01-01'),
    updatedDate: new Date('2025-01-01'),
    ...overrides
})

const mockMember = (overrides = {}) => ({
    id: 'mem-1',
    workspaceId: 'ws-1',
    userEmail: 'alice@acme.com',
    role: 'owner',
    joinedDate: new Date(),
    updatedDate: new Date(),
    ...overrides
})

const makeRepo = (overrides: any = {}) => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    create: jest.fn().mockImplementation((x) => x),
    save: jest.fn().mockImplementation((x) => Promise.resolve({ id: 'new-id', ...x })),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([])
    }),
    ...overrides
})

let workspaceRepo: ReturnType<typeof makeRepo>
let memberRepo: ReturnType<typeof makeRepo>

beforeEach(() => {
    workspaceRepo = makeRepo()
    memberRepo = makeRepo()

    ;(getRunningExpressApp as jest.Mock).mockReturnValue({
        AppDataSource: {
            getRepository: (entity: any) => {
                // entity is the class — check by name or constructor name
                const name = (typeof entity === 'function' ? entity.name : '') ?? ''
                if (name === 'Workspace') return workspaceRepo
                if (name === 'WorkspaceMember') return memberRepo
                return makeRepo()
            }
        }
    })
})

afterEach(() => jest.clearAllMocks())

describe('workspaceScopeWhere', () => {
    it('returns empty object when workspaceId is undefined', () => {
        expect(workspaceScopeWhere(undefined)).toEqual({})
    })

    it('returns workspaceId where clause when provided', () => {
        expect(workspaceScopeWhere('ws-abc')).toEqual({ workspaceId: 'ws-abc' })
    })
})

describe('createWorkspace', () => {
    it('creates a workspace and adds the owner as a member', async () => {
        const saved = mockWorkspace()
        workspaceRepo.save.mockResolvedValue(saved)

        await createWorkspace({ name: 'Acme Engineering', ownerEmail: 'alice@acme.com' })

        expect(workspaceRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Acme Engineering', slug: 'acme-engineering' }))
        expect(workspaceRepo.save).toHaveBeenCalledTimes(1)
        expect(memberRepo.create).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-1', userEmail: 'alice@acme.com', role: 'owner' }))
        expect(memberRepo.save).toHaveBeenCalledTimes(1)
    })

    it('generates slug from name', async () => {
        workspaceRepo.save.mockResolvedValue(mockWorkspace({ slug: 'my-cool-workspace' }))
        await createWorkspace({ name: 'My Cool Workspace', ownerEmail: 'bob@example.com' })
        expect(workspaceRepo.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'my-cool-workspace' }))
    })
})

describe('listWorkspaces', () => {
    it('returns all workspaces for admin (no email filter)', async () => {
        const workspaces = [mockWorkspace()]
        workspaceRepo.find.mockResolvedValue(workspaces)

        const result = await listWorkspaces()
        expect(result).toEqual(workspaces)
        expect(workspaceRepo.find).toHaveBeenCalledWith({ order: { createdDate: 'DESC' } })
    })

    it('returns empty array when user has no memberships', async () => {
        memberRepo.find.mockResolvedValue([])
        const result = await listWorkspaces('noone@example.com')
        expect(result).toEqual([])
        expect(workspaceRepo.createQueryBuilder).not.toHaveBeenCalled()
    })

    it('queries by workspace IDs when user has memberships', async () => {
        memberRepo.find.mockResolvedValue([mockMember()])
        workspaceRepo.createQueryBuilder.mockReturnValue({
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([mockWorkspace()])
        })

        const result = await listWorkspaces('alice@acme.com')
        expect(result).toHaveLength(1)
    })
})

describe('addMember', () => {
    it('creates a new membership when none exists', async () => {
        memberRepo.findOne.mockResolvedValue(null)
        const saved = mockMember({ userEmail: 'bob@acme.com', role: 'editor' })
        memberRepo.save.mockResolvedValue(saved)

        const result = await addMember('ws-1', 'bob@acme.com', 'editor')

        expect(memberRepo.create).toHaveBeenCalledWith({ workspaceId: 'ws-1', userEmail: 'bob@acme.com', role: 'editor' })
        expect(result.role).toBe('editor')
    })

    it('updates role when membership already exists', async () => {
        const existing = mockMember({ role: 'viewer' })
        memberRepo.findOne.mockResolvedValue(existing)
        memberRepo.save.mockResolvedValue({ ...existing, role: 'admin' })

        const result = await addMember('ws-1', 'alice@acme.com', 'admin')

        expect(memberRepo.create).not.toHaveBeenCalled()
        expect(result.role).toBe('admin')
    })
})

describe('removeMember', () => {
    it('throws when removing the last owner', async () => {
        const owner = mockMember({ role: 'owner', userEmail: 'alice@acme.com' })
        memberRepo.findOne.mockResolvedValue(owner)
        memberRepo.find.mockResolvedValue([owner])

        await expect(removeMember('ws-1', 'alice@acme.com')).rejects.toThrow('Cannot remove the last owner')
    })

    it('removes a member when there are multiple owners', async () => {
        const alice = mockMember({ role: 'owner', userEmail: 'alice@acme.com' })
        const bob = mockMember({ id: 'mem-2', role: 'owner', userEmail: 'bob@acme.com' })
        memberRepo.findOne.mockResolvedValue(alice)
        memberRepo.find.mockResolvedValue([alice, bob])

        await removeMember('ws-1', 'alice@acme.com')
        expect(memberRepo.delete).toHaveBeenCalledWith({ id: 'mem-1' })
    })
})

describe('updateWorkspace', () => {
    it('renames workspace and regenerates slug', async () => {
        const ws = mockWorkspace()
        workspaceRepo.findOne.mockResolvedValue(ws)
        workspaceRepo.save.mockResolvedValue({ ...ws, name: 'New Name', slug: 'new-name' })

        const result = await updateWorkspace('ws-1', { name: 'New Name' })
        expect(workspaceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name', slug: 'new-name' }))
    })

    it('throws NOT_FOUND when workspace does not exist', async () => {
        workspaceRepo.findOne.mockResolvedValue(null)
        await expect(updateWorkspace('ghost', { name: 'x' })).rejects.toThrow('not found')
    })
})
