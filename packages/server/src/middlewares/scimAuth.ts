/**
 * SCIM bearer token validation.
 *
 * The SCIM_TOKEN env var is a shared secret provisioned to the IdP
 * (e.g., in Okta's SCIM app settings). This is separate from Flowise
 * user JWT sessions.
 */
import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'

export const requireScimAuth = (req: Request, res: Response, next: NextFunction) => {
    const scimToken = process.env.SCIM_TOKEN
    if (!scimToken) {
        return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            status: StatusCodes.SERVICE_UNAVAILABLE,
            detail: 'SCIM provisioning is not configured (SCIM_TOKEN env var missing)'
        })
    }

    const authHeader = (req.headers['authorization'] ?? '') as string
    const token = authHeader.split('Bearer ').pop()

    if (!token || token !== scimToken) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            status: StatusCodes.UNAUTHORIZED,
            detail: 'Invalid or missing SCIM bearer token'
        })
    }

    next()
}
