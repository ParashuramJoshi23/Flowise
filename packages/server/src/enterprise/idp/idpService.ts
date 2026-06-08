import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { IdentityProvider, IdentityProviderType } from '../../database/entities/IdentityProvider'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'

export interface OIDCProviderConfig {
    discoveryUrl: string
    clientId: string
    clientSecret: string
    redirectUri: string
    scopes?: string[]
}

export interface SAMLProviderConfig {
    entryPoint: string
    issuer: string
    cert: string
    callbackUrl: string
    signatureAlgorithm?: string
    wantAssertionsSigned?: boolean
    wantAuthnResponseSigned?: boolean
}

const getRepo = () => getRunningExpressApp().AppDataSource.getRepository(IdentityProvider)

export const listProviders = async (): Promise<IdentityProvider[]> => {
    return getRepo().find({ order: { createdDate: 'DESC' } })
}

export const getProvider = async (id: string): Promise<IdentityProvider | null> => {
    return getRepo().findOne({ where: { id } })
}

export const getEnabledProvider = async (id: string): Promise<IdentityProvider> => {
    const idp = await getProvider(id)
    if (!idp) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Identity provider ${id} not found`)
    if (!idp.isEnabled) throw new InternalFlowiseError(StatusCodes.FORBIDDEN, `Identity provider ${id} is disabled`)
    return idp
}

export const createProvider = async (params: {
    name: string
    type: IdentityProviderType
    config: OIDCProviderConfig | SAMLProviderConfig
    defaultRole?: string
    roleClaimPath?: string
}): Promise<IdentityProvider> => {
    try {
        const idp = getRepo().create({
            name: params.name,
            type: params.type,
            config: JSON.stringify(params.config),
            defaultRole: params.defaultRole ?? 'viewer',
            roleClaimPath: params.roleClaimPath,
            isEnabled: true
        })
        return getRepo().save(idp)
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: idpService.createProvider - ${getErrorMessage(error)}`)
    }
}

export const updateProvider = async (
    id: string,
    updates: Partial<{ name: string; config: OIDCProviderConfig | SAMLProviderConfig; defaultRole: string; roleClaimPath: string; isEnabled: boolean }>
): Promise<IdentityProvider> => {
    const idp = await getProvider(id)
    if (!idp) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Identity provider ${id} not found`)
    if (updates.name) idp.name = updates.name
    if (updates.config) idp.config = JSON.stringify(updates.config)
    if (updates.defaultRole !== undefined) idp.defaultRole = updates.defaultRole
    if (updates.roleClaimPath !== undefined) idp.roleClaimPath = updates.roleClaimPath
    if (updates.isEnabled !== undefined) idp.isEnabled = updates.isEnabled
    return getRepo().save(idp)
}

export const deleteProvider = async (id: string): Promise<void> => {
    await getRepo().delete({ id })
}

export const parseConfig = <T>(idp: IdentityProvider): T => JSON.parse(idp.config) as T
