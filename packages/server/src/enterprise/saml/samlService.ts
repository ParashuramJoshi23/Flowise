/**
 * SAML 2.0 Service — SP-initiated SSO.
 *
 * Uses @node-saml/passport-saml under the hood.
 * Produces a SAML2 strategy instance per configured IdP and caches it.
 */
import { SAML, SamlOptions } from '@node-saml/passport-saml'
import { StatusCodes } from 'http-status-codes'
import { IdentityProvider } from '../../database/entities/IdentityProvider'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { SAMLProviderConfig, parseConfig } from '../idp/idpService'
import { upsertSSOUser } from '../auth/authService'
import { signTokens, TokenPair } from '../auth/JwtService'
import { UserRole } from '../../database/entities/User'
import get from 'lodash/get'

const samlCache = new Map<string, SAML>()

function getSAMLInstance(idp: IdentityProvider): SAML {
    if (samlCache.has(idp.id)) return samlCache.get(idp.id)!

    const cfg = parseConfig<SAMLProviderConfig>(idp)
    const options: SamlOptions = {
        entryPoint: cfg.entryPoint,
        issuer: cfg.issuer,
        cert: cfg.cert,
        callbackUrl: cfg.callbackUrl,
        signatureAlgorithm: cfg.signatureAlgorithm ?? 'sha256',
        wantAssertionsSigned: cfg.wantAssertionsSigned ?? true,
        wantAuthnResponseSigned: cfg.wantAuthnResponseSigned ?? false,
        // Allow self-signed IdP certs in dev; restrict in prod
        disableRequestedAuthnContext: true
    }

    const saml = new SAML(options)
    samlCache.set(idp.id, saml)
    return saml
}

export const invalidateSAMLCache = (idpId: string) => samlCache.delete(idpId)

/** Generate the SP-metadata XML for this IdP config. */
export const getServiceProviderMetadata = (idp: IdentityProvider): string => {
    const saml = getSAMLInstance(idp)
    return saml.generateServiceProviderMetadata(null, null) ?? ''
}

/** Build the redirect URL that sends the user to the IdP. */
export const buildLoginUrl = async (idp: IdentityProvider): Promise<string> => {
    const saml = getSAMLInstance(idp)
    // getAuthorizeUrl returns a Promise<string> in newer versions
    const url = await (saml as any).getAuthorizeUrlAsync({ })
    return url
}

/** Parse and validate the SAML response from the IdP ACS POST. */
export const handleCallback = async (idp: IdentityProvider, samlResponse: string): Promise<TokenPair> => {
    try {
        const saml = getSAMLInstance(idp)
        const { profile } = await (saml as any).validatePostResponseAsync({ SAMLResponse: samlResponse })

        if (!profile || !profile.nameID) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'SAML assertion missing nameID')
        }

        const email: string = (profile.email ?? profile.nameID) as string

        let role: UserRole | undefined
        if (idp.roleClaimPath) {
            const rawRole = get(profile, idp.roleClaimPath)
            if (rawRole && ['admin', 'editor', 'viewer'].includes(rawRole)) {
                role = rawRole as UserRole
            }
        }

        const user = await upsertSSOUser({
            email,
            name: profile.displayName as string | undefined,
            externalId: profile.nameID as string,
            identityProviderId: idp.id,
            role
        })

        return signTokens(user)
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, `SAML assertion validation failed: ${(error as Error).message}`)
    }
}
