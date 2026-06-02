import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, Index } from 'typeorm'

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'

@Entity('workspace_member')
@Index(['workspaceId', 'userEmail'], { unique: true })
export class WorkspaceMember {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'uuid' })
    workspaceId: string

    /** Stored as email for loose coupling — works before or without full User entity (PR 1). */
    @Column({ type: 'varchar', length: 255 })
    userEmail: string

    @Column({ type: 'varchar', length: 50, default: 'viewer' })
    role: WorkspaceRole

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    joinedDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date
}
