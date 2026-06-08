import { Issuer, Client, generators, TokenSet } from 'openid-client'
import { StatusCodes } from 'http-status-codes'
import { IdentityProvider } from '../../database/entities/IdentityProvider'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { OIDCProviderConfig, parseConfig } from '../idp/idpService'
import { upsertSSOUser } from '../auth/authService'
import { signTokens, TokenPair } from '../auth/JwtService'
import { User, UserRole } from '../../database/entities/User'
import get from 'lodash/get'

/** Cache discovered OIDC clients so we don't re-discover on every request. */
const clientCache = new Map<string, Client>()

async function getOIDCClient(idp: IdentityProvider): Promise<Client> {
    if (clientCache.has(idp.id)) return clientCache.get(idp.id)!
    const cfg = parseConfig<OIDCProviderConfig>(idp)
    const issuer = await Issuer.discover(cfg.discoveryUrl)
    const client = new issuer.Client({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uris: [cfg.redirectUri],
        response_types: ['code']
    })
    clientCache.set(idp.id, client)
    return client
}

/** Invalidate cached client when config changes. */
export const invalidateClientCache = (idpId: string) => clientCache.delete(idpId)

export interface AuthorizationParams {
    state: string
    nonce: string
    url: string
}

/**
 * Build the authorization URL to redirect the user to the IdP.
 * The caller must persist state + nonce (e.g., in a short-lived signed cookie)
 * to validate on callback.
 */
export const buildAuthorizationUrl = async (idp: IdentityProvider): Promise<AuthorizationParams> => {
    const client = await getOIDCClient(idp)
    const cfg = parseConfig<OIDCProviderConfig>(idp)
    const state = generators.state()
    const nonce = generators.nonce()
    const scopes = cfg.scopes ?? ['openid', 'email', 'profile']

    const url = client.authorizationUrl({
        scope: scopes.join(' '),
        state,
        nonce
    })

    return { state, nonce, url }
}

/**
 * Handle the OIDC callback: exchange code for tokens, validate claims, upsert user.
 */
export const handleCallback = async (
    idp: IdentityProvider,
    callbackParams: Record<string, string>,
    expectedState: string,
    expectedNonce: string
): Promise<TokenPair> => {
    try {
        const client = await getOIDCClient(idp)
        const cfg = parseConfig<OIDCProviderConfig>(idp)

        const tokenSet: TokenSet = await client.callback(cfg.redirectUri, callbackParams, {
            state: expectedState,
            nonce: expectedNonce
        })

        const claims = tokenSet.claims()
        const email = claims.email
        if (!email) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'OIDC token missing email claim')

        // Optional role mapping from a claim path (e.g. "roles[0]" or "resource_access.flowise.roles[0]")
        let role: UserRole | undefined
        if (idp.roleClaimPath) {
            const rawRole = get(claims, idp.roleClaimPath)
            if (rawRole && ['admin', 'editor', 'viewer'].includes(rawRole)) {
                role = rawRole as UserRole
            }
        }

        const user: User = await upsertSSOUser({
            email: email as string,
            name: (claims.name ?? claims.preferred_username) as string | undefined,
            externalId: claims.sub,
            identityProviderId: idp.id,
            role
        })

        return signTokens(user)
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, `OIDC callback failed: ${(error as Error).message}`)
    }
}
