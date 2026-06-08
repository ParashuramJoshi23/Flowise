import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import * as authService from '../../enterprise/auth/authService'
import { verifyRefreshToken } from '../../enterprise/auth/JwtService'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'

/** POST /api/v1/auth/login — local email/password login */
export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body
        if (!email || !password) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'email and password are required')
        const tokens = await authService.loginWithPassword(email, password)
        return res.json(tokens)
    } catch (error) {
        next(error)
    }
}

/** POST /api/v1/auth/refresh — refresh access token using refresh token */
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body
        if (!refreshToken) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'refreshToken is required')
        const tokens = await authService.refreshTokens(refreshToken)
        return res.json(tokens)
    } catch (error) {
        next(error)
    }
}

/** GET /api/v1/auth/me — return the current user's profile */
export const me = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Not authenticated')
        const user = await authService.getUserById(req.user.id)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'User not found')
        const { passwordHash: _ph, ...safe } = user as any
        return res.json(safe)
    } catch (error) {
        next(error)
    }
}

/** POST /api/v1/auth/users — create a local user (admin only) */
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, name, password, role } = req.body
        if (!email || !password) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'email and password are required')
        const user = await authService.createUser({ email, name, password, role })
        const { passwordHash: _ph, ...safe } = user as any
        return res.status(StatusCodes.CREATED).json(safe)
    } catch (error) {
        next(error)
    }
}

/** GET /api/v1/auth/users — list all users (admin only) */
export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await authService.listUsers()
        return res.json(users.map(({ passwordHash: _ph, ...safe }: any) => safe))
    } catch (error) {
        next(error)
    }
}

/** PUT /api/v1/auth/users/:id — update a user (admin only) */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        const { name, role, isActive } = req.body
        const user = await authService.updateUser(id, { name, role, isActive })
        const { passwordHash: _ph, ...safe } = user as any
        return res.json(safe)
    } catch (error) {
        next(error)
    }
}

/** DELETE /api/v1/auth/users/:id — delete a user (admin only) */
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await authService.deleteUser(req.params.id)
        return res.status(StatusCodes.NO_CONTENT).send()
    } catch (error) {
        next(error)
    }
}
