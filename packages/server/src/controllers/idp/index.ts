import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { serialize, parse as parseCookie } from 'cookie'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import * as idpService from '../../enterprise/idp/idpService'
import * as oidcService from '../../enterprise/oidc/oidcService'
import * as samlService from '../../enterprise/saml/samlService'

const STATE_COOKIE = 'flowise_oidc_state'
const NONCE_COOKIE = 'flowise_oidc_nonce'
const IDP_COOKIE = 'flowise_oidc_idp'
const COOKIE_TTL = 300 // 5 minutes

// ---- Identity Provider CRUD ----

export const listProviders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const providers = await idpService.listProviders()
        return res.json(providers.map(sanitizeProvider))
    } catch (error) {
        next(error)
    }
}

export const getProvider = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idp = await idpService.getProvider(req.params.id)
        if (!idp) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Provider ${req.params.id} not found`)
        return res.json(sanitizeProvider(idp))
    } catch (error) {
        next(error)
    }
}

export const createProvider = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, type, config, defaultRole, roleClaimPath } = req.body
        if (!name || !type || !config) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'name, type, config are required')
        const idp = await idpService.createProvider({ name, type, config, defaultRole, roleClaimPath })
        return res.status(StatusCodes.CREATED).json(sanitizeProvider(idp))
    } catch (error) {
        next(error)
    }
}

export const updateProvider = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idp = await idpService.updateProvider(req.params.id, req.body)
        oidcService.invalidateClientCache(req.params.id)
        samlService.invalidateSAMLCache(req.params.id)
        return res.json(sanitizeProvider(idp))
    } catch (error) {
        next(error)
    }
}

export const deleteProvider = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await idpService.deleteProvider(req.params.id)
        oidcService.invalidateClientCache(req.params.id)
        samlService.invalidateSAMLCache(req.params.id)
        return res.status(StatusCodes.NO_CONTENT).send()
    } catch (error) {
        next(error)
    }
}

// ---- OIDC Flow ----

/** GET /api/v1/sso/oidc/:id/login — initiate OIDC authorization code flow */
export const oidcLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idp = await idpService.getEnabledProvider(req.params.id)
        if (idp.type !== 'oidc') throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Provider is not OIDC type')

        const { state, nonce, url } = await oidcService.buildAuthorizationUrl(idp)

        // Store state & nonce in short-lived signed cookies
        res.setHeader('Set-Cookie', [
            serialize(STATE_COOKIE, state, { httpOnly: true, maxAge: COOKIE_TTL, path: '/', sameSite: 'lax' }),
            serialize(NONCE_COOKIE, nonce, { httpOnly: true, maxAge: COOKIE_TTL, path: '/', sameSite: 'lax' }),
            serialize(IDP_COOKIE, req.params.id, { httpOnly: true, maxAge: COOKIE_TTL, path: '/', sameSite: 'lax' })
        ])

        return res.redirect(url)
    } catch (error) {
        next(error)
    }
}

/** GET /api/v1/sso/oidc/callback — handle OIDC provider callback */
export const oidcCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const cookies = parseCookie(req.headers.cookie ?? '')
        const expectedState = cookies[STATE_COOKIE]
        const expectedNonce = cookies[NONCE_COOKIE]
        const idpId = cookies[IDP_COOKIE]

        if (!expectedState || !idpId) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Missing OIDC state cookie')

        const idp = await idpService.getEnabledProvider(idpId)
        const tokens = await oidcService.handleCallback(idp, req.query as Record<string, string>, expectedState, expectedNonce)

        // Clear state cookies
        res.setHeader('Set-Cookie', [
            serialize(STATE_COOKIE, '', { maxAge: 0, path: '/' }),
            serialize(NONCE_COOKIE, '', { maxAge: 0, path: '/' }),
            serialize(IDP_COOKIE, '', { maxAge: 0, path: '/' })
        ])

        return res.json(tokens)
    } catch (error) {
        next(error)
    }
}

// ---- SAML Flow ----

/** GET /api/v1/sso/saml/:id/login — redirect to IdP SSO endpoint */
export const samlLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idp = await idpService.getEnabledProvider(req.params.id)
        if (idp.type !== 'saml') throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Provider is not SAML type')
        const url = await samlService.buildLoginUrl(idp)
        return res.redirect(url)
    } catch (error) {
        next(error)
    }
}

/** POST /api/v1/sso/saml/:id/callback — SAML ACS endpoint */
export const samlCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idp = await idpService.getEnabledProvider(req.params.id)
        if (idp.type !== 'saml') throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Provider is not SAML type')
        const { SAMLResponse } = req.body
        if (!SAMLResponse) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'SAMLResponse is required')
        const tokens = await samlService.handleCallback(idp, SAMLResponse)
        return res.json(tokens)
    } catch (error) {
        next(error)
    }
}

/** GET /api/v1/sso/saml/:id/metadata — SP metadata for IdP configuration */
export const samlMetadata = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idp = await idpService.getEnabledProvider(req.params.id)
        if (idp.type !== 'saml') throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Provider is not SAML type')
        const xml = samlService.getServiceProviderMetadata(idp)
        res.type('application/xml')
        return res.send(xml)
    } catch (error) {
        next(error)
    }
}

// ---- Helpers ----

/** Strip client secret from OIDC configs before sending to client. */
function sanitizeProvider(idp: any) {
    const raw = { ...idp }
    try {
        const cfg = JSON.parse(raw.config ?? '{}')
        if (cfg.clientSecret) cfg.clientSecret = '***'
        if (cfg.cert) cfg.cert = '***'
        raw.config = cfg
    } catch {}
    return raw
}
