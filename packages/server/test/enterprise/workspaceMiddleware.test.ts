/**
 * Workspace middleware unit tests.
 */

jest.mock('../../src/utils/getRunningExpressApp', () => ({
    getRunningExpressApp: jest.fn()
}))

import { Request, Response, NextFunction } from 'express'
import { getRunningExpressApp } from '../../src/utils/getRunningExpressApp'
import { resolveWorkspace, requireWorkspace, isWorkspacesEnabled } from '../../src/middlewares/workspace'

const makeReq = (overrides: any = {}) => ({
    headers: {},
    query: {},
    user: undefined,
    workspaceId: undefined,
    workspace: undefined,
    ...overrides
})

const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
})

const next = jest.fn() as NextFunction

const mockWorkspace = { id: 'ws-1', name: 'Test WS', isActive: true }
const mockMember = { workspaceId: 'ws-1', userEmail: 'alice@acme.com', role: 'editor' }

afterEach(() => jest.clearAllMocks())

describe('isWorkspacesEnabled', () => {
    it('returns false when ENABLE_WORKSPACES is not set', () => {
        delete process.env.ENABLE_WORKSPACES
        expect(isWorkspacesEnabled()).toBe(false)
    })

    it('returns true when ENABLE_WORKSPACES=true', () => {
        process.env.ENABLE_WORKSPACES = 'true'
        expect(isWorkspacesEnabled()).toBe(true)
        delete process.env.ENABLE_WORKSPACES
    })
})

describe('resolveWorkspace', () => {
    beforeEach(() => {
        process.env.ENABLE_WORKSPACES = 'true'
    })

    afterEach(() => {
        delete process.env.ENABLE_WORKSPACES
    })

    it('calls next() immediately when workspaces disabled', async () => {
        delete process.env.ENABLE_WORKSPACES
        const req = makeReq()
        const res = makeRes()
        await resolveWorkspace(req as any, res as any, next)
        expect(next).toHaveBeenCalledTimes(1)
        expect(res.status).not.toHaveBeenCalled()
    })

    it('calls next() when no workspaceId header is provided', async () => {
        const req = makeReq({ headers: {} })
        const res = makeRes()
        await resolveWorkspace(req as any, res as any, next)
        expect(next).toHaveBeenCalledTimes(1)
    })

    it('returns 404 when workspace does not exist', async () => {
        const wsRepo = { findOne: jest.fn().mockResolvedValue(null) }
        ;(getRunningExpressApp as jest.Mock).mockReturnValue({
            AppDataSource: { getRepository: () => wsRepo }
        })

        const req = makeReq({ headers: { 'x-workspace-id': 'ghost-ws' } })
        const res = makeRes()
        await resolveWorkspace(req as any, res as any, next)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(next).not.toHaveBeenCalled()
    })

    it('returns 403 when user is not a member', async () => {
        const workspaceRepo = { findOne: jest.fn().mockResolvedValue(mockWorkspace) }
        const memberRepo = { findOne: jest.fn().mockResolvedValue(null) }
        ;(getRunningExpressApp as jest.Mock).mockReturnValue({
            AppDataSource: {
                getRepository: (entity: any) => {
                    const name = typeof entity === 'function' ? entity.name : ''
                    if (name === 'WorkspaceMember') return memberRepo
                    return workspaceRepo
                }
            }
        })

        const req = makeReq({
            headers: { 'x-workspace-id': 'ws-1' },
            user: { id: 'u-1', email: 'stranger@example.com', role: 'viewer' }
        })
        const res = makeRes()
        await resolveWorkspace(req as any, res as any, next)

        expect(res.status).toHaveBeenCalledWith(403)
        expect(next).not.toHaveBeenCalled()
    })

    it('sets req.workspaceId and calls next() for a valid member', async () => {
        const workspaceRepo = { findOne: jest.fn().mockResolvedValue(mockWorkspace) }
        const memberRepo = { findOne: jest.fn().mockResolvedValue(mockMember) }
        ;(getRunningExpressApp as jest.Mock).mockReturnValue({
            AppDataSource: {
                getRepository: (entity: any) => {
                    const name = typeof entity === 'function' ? entity.name : ''
                    if (name === 'WorkspaceMember') return memberRepo
                    return workspaceRepo
                }
            }
        })

        const req = makeReq({
            headers: { 'x-workspace-id': 'ws-1' },
            user: { id: 'u-1', email: 'alice@acme.com', role: 'editor' }
        })
        const res = makeRes()
        await resolveWorkspace(req as any, res as any, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(req.workspaceId).toBe('ws-1')
        expect(req.workspace).toEqual(mockWorkspace)
    })
})

describe('requireWorkspace', () => {
    it('calls next() when workspaces disabled', () => {
        delete process.env.ENABLE_WORKSPACES
        const req = makeReq()
        const res = makeRes()
        requireWorkspace(req as any, res as any, next)
        expect(next).toHaveBeenCalledTimes(1)
    })

    it('returns 400 when workspaceId is not resolved', () => {
        process.env.ENABLE_WORKSPACES = 'true'
        const req = makeReq()
        const res = makeRes()
        requireWorkspace(req as any, res as any, next)
        expect(res.status).toHaveBeenCalledWith(400)
        delete process.env.ENABLE_WORKSPACES
    })

    it('calls next() when workspaceId is set', () => {
        process.env.ENABLE_WORKSPACES = 'true'
        const req = makeReq({ workspaceId: 'ws-1' })
        const res = makeRes()
        requireWorkspace(req as any, res as any, next)
        expect(next).toHaveBeenCalledTimes(1)
        delete process.env.ENABLE_WORKSPACES
    })
})
