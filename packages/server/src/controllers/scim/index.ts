import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import * as scimService from '../../enterprise/scim/scimService'

const scimBaseUrl = (req: Request) => `${req.protocol}://${req.get('host')}/api/v1/scim/v2/Users`

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await scimService.scimListUsers(scimBaseUrl(req), {
            startIndex: req.query.startIndex ? parseInt(req.query.startIndex as string) : undefined,
            count: req.query.count ? parseInt(req.query.count as string) : undefined,
            filter: req.query.filter as string | undefined
        })
        res.setHeader('Content-Type', 'application/scim+json')
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await scimService.scimGetUser(req.params.id, scimBaseUrl(req))
        res.setHeader('Content-Type', 'application/scim+json')
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { scimUser, status } = await scimService.scimCreateUser(req.body, scimBaseUrl(req))
        res.setHeader('Content-Type', 'application/scim+json')
        return res.status(status).json(scimUser)
    } catch (error) {
        next(error)
    }
}

export const replaceUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await scimService.scimReplaceUser(req.params.id, req.body, scimBaseUrl(req))
        res.setHeader('Content-Type', 'application/scim+json')
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

export const patchUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await scimService.scimPatchUser(req.params.id, req.body, scimBaseUrl(req))
        res.setHeader('Content-Type', 'application/scim+json')
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await scimService.scimDeleteUser(req.params.id)
        return res.status(StatusCodes.NO_CONTENT).send()
    } catch (error) {
        next(error)
    }
}

export const serviceProviderConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}/api/v1/scim/v2`
        res.setHeader('Content-Type', 'application/scim+json')
        return res.json(scimService.scimServiceProviderConfig(baseUrl))
    } catch (error) {
        next(error)
    }
}
