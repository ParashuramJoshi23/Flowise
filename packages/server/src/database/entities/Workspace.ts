import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm'

@Entity('workspace')
export class Workspace {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 255 })
    name: string

    @Column({ type: 'varchar', length: 255, nullable: true })
    slug: string

    @Column({ type: 'text', nullable: true })
    description: string

    @Column({ default: true })
    isActive: boolean

    /** JSON blob for workspace-level settings (e.g., feature flags, quotas). */
    @Column({ type: 'text', nullable: true })
    settings: string

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date
}
