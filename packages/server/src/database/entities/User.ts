import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, Index } from 'typeorm'

export type UserRole = 'admin' | 'editor' | 'viewer'
export type AuthProvider = 'local' | 'oidc' | 'saml'

@Entity('flowise_user')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 255 })
    email: string

    @Column({ type: 'varchar', length: 255, nullable: true })
    name: string

    @Column({ type: 'text', nullable: true })
    passwordHash: string

    @Column({ type: 'varchar', length: 50, default: 'viewer' })
    role: UserRole

    @Column({ type: 'varchar', length: 50, default: 'local' })
    authProvider: AuthProvider

    /** External identity provider's subject identifier */
    @Column({ type: 'varchar', length: 255, nullable: true })
    externalId: string

    /** Which IdentityProvider config this user authenticated through */
    @Column({ type: 'uuid', nullable: true })
    identityProviderId: string

    @Column({ default: true })
    isActive: boolean

    @Column({ type: 'timestamp', nullable: true })
    lastLoginAt: Date

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date
}
