import bcrypt from 'bcryptjs'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { User, UserRole } from '../../database/entities/User'
import { IdentityProvider } from '../../database/entities/IdentityProvider'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { signTokens, verifyRefreshToken, TokenPair } from './JwtService'

const BCRYPT_ROUNDS = 12

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_ROUNDS)

export const comparePassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash)

const getUserRepo = () => getRunningExpressApp().AppDataSource.getRepository(User)

/** Create or update a user record from an SSO assertion. */
export const upsertSSOUser = async (params: {
    email: string
    name?: string
    externalId: string
    identityProviderId: string
    role?: UserRole
}): Promise<User> => {
    const repo = getUserRepo()
    let user = await repo.findOne({ where: { externalId: params.externalId, identityProviderId: params.identityProviderId } })
    if (!user) {
        user = await repo.findOne({ where: { email: params.email } })
    }
    if (user) {
        user.name = params.name ?? user.name
        user.externalId = params.externalId
        user.identityProviderId = params.identityProviderId
        if (params.role) user.role = params.role
        user.lastLoginAt = new Date()
        return repo.save(user)
    }

    const idpRepo = getRunningExpressApp().AppDataSource.getRepository(IdentityProvider)
    const idp = await idpRepo.findOne({ where: { id: params.identityProviderId } })

    const newUser = repo.create({
        email: params.email,
        name: params.name,
        authProvider: 'oidc',
        externalId: params.externalId,
        identityProviderId: params.identityProviderId,
        role: params.role ?? (idp?.defaultRole as UserRole) ?? 'viewer',
        isActive: true,
        lastLoginAt: new Date()
    })
    return repo.save(newUser)
}

export const loginWithPassword = async (email: string, password: string): Promise<TokenPair> => {
    try {
        const repo = getUserRepo()
        const user = await repo.findOne({ where: { email, authProvider: 'local' } })
        if (!user || !user.passwordHash) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Invalid credentials')
        }
        if (!user.isActive) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Account is disabled')
        }
        const valid = await comparePassword(password, user.passwordHash)
        if (!valid) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Invalid credentials')
        }
        user.lastLoginAt = new Date()
        await repo.save(user)
        return signTokens(user)
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: authService.loginWithPassword - ${getErrorMessage(error)}`)
    }
}

export const refreshTokens = async (refreshToken: string): Promise<TokenPair> => {
    try {
        const payload = verifyRefreshToken(refreshToken)
        const user = await getUserRepo().findOne({ where: { id: payload.sub, isActive: true } })
        if (!user) throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'User not found')
        return signTokens(user)
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token')
    }
}

export const createUser = async (params: { email: string; name?: string; password: string; role?: UserRole }): Promise<User> => {
    try {
        const repo = getUserRepo()
        const existing = await repo.findOne({ where: { email: params.email } })
        if (existing) throw new InternalFlowiseError(StatusCodes.CONFLICT, `User with email ${params.email} already exists`)
        const passwordHash = await hashPassword(params.password)
        const user = repo.create({
            email: params.email,
            name: params.name,
            passwordHash,
            role: params.role ?? 'viewer',
            authProvider: 'local',
            isActive: true
        })
        return repo.save(user)
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: authService.createUser - ${getErrorMessage(error)}`)
    }
}

export const listUsers = async (): Promise<User[]> => {
    return getUserRepo().find({ order: { createdDate: 'DESC' } })
}

export const getUserById = async (id: string): Promise<User | null> => {
    return getUserRepo().findOne({ where: { id } })
}

export const getUserByEmail = async (email: string): Promise<User | null> => {
    return getUserRepo().findOne({ where: { email } })
}

export const updateUser = async (id: string, updates: Partial<Pick<User, 'name' | 'role' | 'isActive'>>): Promise<User> => {
    const user = await getUserById(id)
    if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `User ${id} not found`)
    Object.assign(user, updates)
    return getUserRepo().save(user)
}

export const deleteUser = async (id: string): Promise<void> => {
    await getUserRepo().delete({ id })
}
