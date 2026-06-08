/**
 * SCIM 2.0 (RFC 7644) Users resource.
 *
 * Supports provisioning from Okta, Azure AD, etc.
 * Groups resource is a future extension.
 */
import { StatusCodes } from 'http-status-codes'
import { Like } from 'typeorm'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { User, UserRole } from '../../database/entities/User'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { hashPassword } from '../auth/authService'

const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User'

const userRepo = () => getRunningExpressApp().AppDataSource.getRepository(User)

/** Map a DB User to a SCIM User resource object. */
function toScimUser(user: User, baseUrl: string): object {
    return {
        schemas: [SCIM_USER_SCHEMA],
        id: user.id,
        externalId: user.externalId ?? undefined,
        userName: user.email,
        name: {
            formatted: user.name ?? user.email
        },
        emails: [{ value: user.email, primary: true }],
        active: user.isActive,
        meta: {
            resourceType: 'User',
            created: user.createdDate,
            lastModified: user.updatedDate,
            location: `${baseUrl}/${user.id}`
        }
    }
}

/** SCIM list response envelope */
function listResponse(resources: object[], totalResults: number, startIndex: number) {
    return {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults,
        startIndex,
        itemsPerPage: resources.length,
        Resources: resources
    }
}

/** Parse simple SCIM filter strings: userName eq "foo@bar.com" */
function parseFilter(filter: string): { field: string; value: string } | null {
    const match = filter?.match(/^(\w+)\s+eq\s+"([^"]+)"$/i)
    if (!match) return null
    return { field: match[1], value: match[2] }
}

export const scimListUsers = async (baseUrl: string, params: { startIndex?: number; count?: number; filter?: string }) => {
    try {
        const startIndex = Math.max(1, params.startIndex ?? 1)
        const count = Math.min(100, params.count ?? 100)

        let whereClause: any = {}
        if (params.filter) {
            const parsed = parseFilter(params.filter)
            if (parsed?.field === 'userName') {
                whereClause = { email: parsed.value }
            } else if (parsed?.field === 'externalId') {
                whereClause = { externalId: parsed.value }
            }
        }

        const [users, total] = await userRepo().findAndCount({
            where: whereClause,
            skip: startIndex - 1,
            take: count,
            order: { createdDate: 'ASC' }
        })

        return listResponse(users.map((u) => toScimUser(u, baseUrl)), total, startIndex)
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: scimService.listUsers - ${getErrorMessage(error)}`)
    }
}

export const scimGetUser = async (id: string, baseUrl: string) => {
    const user = await userRepo().findOne({ where: { id } })
    if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `User ${id} not found`)
    return toScimUser(user, baseUrl)
}

export const scimCreateUser = async (body: any, baseUrl: string) => {
    try {
        const email: string = body.userName ?? body.emails?.[0]?.value
        if (!email) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'userName is required')

        const existing = await userRepo().findOne({ where: { email } })
        if (existing) throw new InternalFlowiseError(StatusCodes.CONFLICT, `User ${email} already exists`)

        const randomPassword = Math.random().toString(36) + Math.random().toString(36)
        const passwordHash = await hashPassword(randomPassword)

        const role: UserRole = mapScimRoleToRole(body.roles)

        const user = userRepo().create({
            email,
            name: (body.name?.formatted ?? body.displayName ?? `${body.name?.givenName ?? ''} ${body.name?.familyName ?? ''}`.trim()) || undefined,
            authProvider: 'saml',
            externalId: body.externalId,
            passwordHash,
            role,
            isActive: body.active !== false
        })

        const saved = await userRepo().save(user)
        return { scimUser: toScimUser(saved, baseUrl), status: StatusCodes.CREATED }
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: scimService.createUser - ${getErrorMessage(error)}`)
    }
}

export const scimReplaceUser = async (id: string, body: any, baseUrl: string) => {
    const user = await userRepo().findOne({ where: { id } })
    if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `User ${id} not found`)

    if (body.userName) user.email = body.userName
    if (body.name?.formatted) user.name = body.name.formatted
    if (body.active !== undefined) user.isActive = body.active
    if (body.externalId) user.externalId = body.externalId
    if (body.roles) user.role = mapScimRoleToRole(body.roles)

    const saved = await userRepo().save(user)
    return toScimUser(saved, baseUrl)
}

export const scimPatchUser = async (id: string, body: any, baseUrl: string) => {
    const user = await userRepo().findOne({ where: { id } })
    if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `User ${id} not found`)

    const operations: Array<{ op: string; path?: string; value: any }> = body.Operations ?? []
    for (const op of operations) {
        const opLower = op.op?.toLowerCase()
        if (opLower === 'replace' || opLower === 'add') {
            if (op.path === 'active') user.isActive = op.value
            else if (op.path === 'userName') user.email = op.value
            else if (op.path === 'name.formatted') user.name = op.value
            else if (!op.path && op.value) {
                if (op.value.active !== undefined) user.isActive = op.value.active
                if (op.value.userName) user.email = op.value.userName
                if (op.value.displayName) user.name = op.value.displayName
            }
        }
    }

    const saved = await userRepo().save(user)
    return toScimUser(saved, baseUrl)
}

export const scimDeleteUser = async (id: string) => {
    const user = await userRepo().findOne({ where: { id } })
    if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `User ${id} not found`)
    await userRepo().delete({ id })
}

/** Map SCIM roles array to internal role. First matching wins. */
function mapScimRoleToRole(roles?: Array<{ value: string; primary?: boolean }>): UserRole {
    if (!roles?.length) return 'viewer'
    const primary = roles.find((r) => r.primary) ?? roles[0]
    const v = primary.value?.toLowerCase()
    if (v === 'admin') return 'admin'
    if (v === 'editor') return 'editor'
    return 'viewer'
}

/** SCIM ServiceProviderConfig — advertise supported features. */
export const scimServiceProviderConfig = (baseUrl: string) => ({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://docs.flowiseai.com/enterprise/scim',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 100 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
        {
            type: 'oauthbearertoken',
            name: 'OAuth Bearer Token',
            description: 'Authentication scheme using the OAuth Bearer Token Standard',
            specUri: 'http://www.rfc-editor.org/info/rfc6750'
        }
    ],
    meta: {
        resourceType: 'ServiceProviderConfig',
        location: `${baseUrl}/ServiceProviderConfig`
    }
})
