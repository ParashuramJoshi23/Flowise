import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm'

export type IdentityProviderType = 'oidc' | 'saml'

@Entity('identity_provider')
export class IdentityProvider {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 100 })
    name: string

    @Column({ type: 'varchar', length: 10 })
    type: IdentityProviderType

    @Column({ default: true })
    isEnabled: boolean

    /**
     * OIDC fields: issuer, clientId, clientSecret, discoveryUrl, scopes, redirectUri
     * SAML fields: entryPoint, issuer, cert, callbackUrl, signatureAlgorithm
     * Stored as JSON to keep the schema generic.
     */
    @Column({ type: 'text' })
    config: string

    /** Role assigned to users provisioned via this IdP if not mapped by SCIM */
    @Column({ type: 'varchar', length: 50, default: 'viewer' })
    defaultRole: string

    /** Optional attribute/claim path to map to user role, e.g. "roles[0]" */
    @Column({ type: 'varchar', length: 255, nullable: true })
    roleClaimPath: string

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date
}
