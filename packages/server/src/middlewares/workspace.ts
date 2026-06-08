/**
 * Workspace middleware — resolves the active workspace for a request.
 *
 * Resolution order:
 * 1. X-Workspace-ID header (explicit, used by CLI/API clients)
 * 2. workspaceId query param (convenience for GET requests)
 * 3. JWT claim workspaceId (when SSO is active)
 *
 * When workspaces are disabled (ENABLE_WORKSPACES != 'true'), the
 * middleware is a no-op — all queries run without workspace filtering,
 * preserving backwards compatibility.
 */
import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { Workspace } from '../database/entities/Workspace'
import { WorkspaceMember } from '../database/entities/WorkspaceMember'

declare global {
    namespace Express {
        interface Request {
            workspaceId?: string
            workspace?: Workspace
            /** Set by authentication middleware when SSO is active. */
            user?: { id: string; email: string; role: string }
        }
    }
}

export const isWorkspacesEnabled = (): boolean => process.env.ENABLE_WORKSPACES === 'true'

/**
 * Resolves workspaceId and validates membership.
 * Attaches req.workspaceId and req.workspace on success.
 */
export const resolveWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    if (!isWorkspacesEnabled()) return next()

    const workspaceId =
        (req.headers['x-workspace-id'] as string) ?? (req.query.workspaceId as string) ?? (req.user as any)?.workspaceId

    if (!workspaceId) return next()

    try {
        const ds = getRunningExpressApp().AppDataSource
        const workspace = await ds.getRepository(Workspace).findOne({ where: { id: workspaceId, isActive: true } })

        if (!workspace) {
            return res.status(StatusCodes.NOT_FOUND).json({ error: `Workspace ${workspaceId} not found` })
        }

        if (req.user) {
            const member = await ds.getRepository(WorkspaceMember).findOne({
                where: { workspaceId, userEmail: req.user.email }
            })
            if (!member) {
                return res.status(StatusCodes.FORBIDDEN).json({ error: 'You are not a member of this workspace' })
            }
        }

        req.workspaceId = workspaceId
        req.workspace = workspace
        next()
    } catch (error) {
        next(error)
    }
}

/** Require a workspace to be resolved. Use after resolveWorkspace. */
export const requireWorkspace = (req: Request, res: Response, next: NextFunction) => {
    if (!isWorkspacesEnabled()) return next()
    if (!req.workspaceId) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'X-Workspace-ID header or workspaceId param is required' })
    }
    next()
}
