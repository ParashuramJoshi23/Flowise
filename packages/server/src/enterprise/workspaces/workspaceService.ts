import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { Workspace } from '../../database/entities/Workspace'
import { WorkspaceMember, WorkspaceRole } from '../../database/entities/WorkspaceMember'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'

const workspaceRepo = () => getRunningExpressApp().AppDataSource.getRepository(Workspace)
const memberRepo = () => getRunningExpressApp().AppDataSource.getRepository(WorkspaceMember)

const toSlug = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

export const listWorkspaces = async (filterByEmail?: string): Promise<Workspace[]> => {
    if (!filterByEmail) return workspaceRepo().find({ order: { createdDate: 'DESC' } })

    const memberships = await memberRepo().find({ where: { userEmail: filterByEmail } })
    const ids = memberships.map((m) => m.workspaceId)
    if (ids.length === 0) return []
    return workspaceRepo()
        .createQueryBuilder('w')
        .where('w.id IN (:...ids)', { ids })
        .orderBy('w.createdDate', 'DESC')
        .getMany()
}

export const getWorkspace = async (id: string): Promise<Workspace | null> => {
    return workspaceRepo().findOne({ where: { id } })
}

export const createWorkspace = async (params: {
    name: string
    description?: string
    ownerEmail: string
    settings?: object
}): Promise<Workspace> => {
    try {
        const slug = toSlug(params.name)
        const workspace = workspaceRepo().create({
            name: params.name,
            slug,
            description: params.description,
            settings: params.settings ? JSON.stringify(params.settings) : undefined,
            isActive: true
        })
        const saved = await workspaceRepo().save(workspace)

        // Auto-add creator as owner
        const member = memberRepo().create({
            workspaceId: saved.id,
            userEmail: params.ownerEmail,
            role: 'owner'
        })
        await memberRepo().save(member)

        return saved
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: workspaceService.createWorkspace - ${getErrorMessage(error)}`
        )
    }
}

export const updateWorkspace = async (
    id: string,
    updates: Partial<{ name: string; description: string; isActive: boolean; settings: object }>
): Promise<Workspace> => {
    const workspace = await getWorkspace(id)
    if (!workspace) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Workspace ${id} not found`)
    if (updates.name) {
        workspace.name = updates.name
        workspace.slug = toSlug(updates.name)
    }
    if (updates.description !== undefined) workspace.description = updates.description
    if (updates.isActive !== undefined) workspace.isActive = updates.isActive
    if (updates.settings !== undefined) workspace.settings = JSON.stringify(updates.settings)
    return workspaceRepo().save(workspace)
}

export const deleteWorkspace = async (id: string): Promise<void> => {
    await memberRepo().delete({ workspaceId: id })
    await workspaceRepo().delete({ id })
}

// ---- Membership ----

export const listMembers = async (workspaceId: string): Promise<WorkspaceMember[]> => {
    return memberRepo().find({ where: { workspaceId }, order: { joinedDate: 'ASC' } })
}

export const addMember = async (workspaceId: string, userEmail: string, role: WorkspaceRole = 'viewer'): Promise<WorkspaceMember> => {
    try {
        const existing = await memberRepo().findOne({ where: { workspaceId, userEmail } })
        if (existing) {
            existing.role = role
            return memberRepo().save(existing)
        }
        const member = memberRepo().create({ workspaceId, userEmail, role })
        return memberRepo().save(member)
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: workspaceService.addMember - ${getErrorMessage(error)}`
        )
    }
}

export const updateMemberRole = async (workspaceId: string, userEmail: string, role: WorkspaceRole): Promise<WorkspaceMember> => {
    const member = await memberRepo().findOne({ where: { workspaceId, userEmail } })
    if (!member) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Member ${userEmail} not found in workspace`)
    member.role = role
    return memberRepo().save(member)
}

export const removeMember = async (workspaceId: string, userEmail: string): Promise<void> => {
    const member = await memberRepo().findOne({ where: { workspaceId, userEmail } })
    if (!member) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Member not found`)

    const owners = await memberRepo().find({ where: { workspaceId, role: 'owner' } })
    if (owners.length === 1 && owners[0].userEmail === userEmail) {
        throw new InternalFlowiseError(StatusCodes.CONFLICT, 'Cannot remove the last owner of a workspace')
    }
    await memberRepo().delete({ id: member.id })
}

/**
 * Build a TypeORM where clause that filters by workspaceId when workspaces are enabled.
 * Pass the result directly into a repo.find({ where }) call.
 */
export const workspaceScopeWhere = (workspaceId: string | undefined): { workspaceId: string } | {} => {
    if (!workspaceId) return {}
    return { workspaceId }
}
