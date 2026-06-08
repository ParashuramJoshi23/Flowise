import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import * as workspaceService from '../../enterprise/workspaces/workspaceService'
import { WorkspaceRole } from '../../database/entities/WorkspaceMember'

// ---- Workspace CRUD ----

export const listWorkspaces = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterEmail = req.user?.role === 'admin' ? undefined : req.user?.email
        const workspaces = await workspaceService.listWorkspaces(filterEmail)
        return res.json(workspaces)
    } catch (error) {
        next(error)
    }
}

export const getWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspace = await workspaceService.getWorkspace(req.params.id)
        if (!workspace) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Workspace ${req.params.id} not found`)
        return res.json(workspace)
    } catch (error) {
        next(error)
    }
}

export const createWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, description, settings } = req.body
        if (!name) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'name is required')
        const ownerEmail = req.user?.email ?? req.body.ownerEmail
        if (!ownerEmail) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'ownerEmail is required')
        const workspace = await workspaceService.createWorkspace({ name, description, ownerEmail, settings })
        return res.status(StatusCodes.CREATED).json(workspace)
    } catch (error) {
        next(error)
    }
}

export const updateWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspace = await workspaceService.updateWorkspace(req.params.id, req.body)
        return res.json(workspace)
    } catch (error) {
        next(error)
    }
}

export const deleteWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await workspaceService.deleteWorkspace(req.params.id)
        return res.status(StatusCodes.NO_CONTENT).send()
    } catch (error) {
        next(error)
    }
}

// ---- Membership ----

export const listMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const members = await workspaceService.listMembers(req.params.id)
        return res.json(members)
    } catch (error) {
        next(error)
    }
}

export const addMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, role } = req.body
        if (!email) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'email is required')
        const member = await workspaceService.addMember(req.params.id, email, role as WorkspaceRole)
        return res.status(StatusCodes.CREATED).json(member)
    } catch (error) {
        next(error)
    }
}

export const updateMemberRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { role } = req.body
        if (!role) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'role is required')
        const member = await workspaceService.updateMemberRole(req.params.id, req.params.email, role as WorkspaceRole)
        return res.json(member)
    } catch (error) {
        next(error)
    }
}

export const removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await workspaceService.removeMember(req.params.id, req.params.email)
        return res.status(StatusCodes.NO_CONTENT).send()
    } catch (error) {
        next(error)
    }
}
