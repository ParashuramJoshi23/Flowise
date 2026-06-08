import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkspaceEntities1748100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Workspace table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS workspace (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                name varchar(255) NOT NULL,
                slug varchar(255),
                description text,
                "isActive" boolean NOT NULL DEFAULT true,
                settings text,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_workspace" PRIMARY KEY (id)
            )
        `)

        // Workspace member table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS workspace_member (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "userEmail" varchar(255) NOT NULL,
                role varchar(50) NOT NULL DEFAULT 'viewer',
                "joinedDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_workspace_member" PRIMARY KEY (id),
                CONSTRAINT "UQ_workspace_member_workspace_email" UNIQUE ("workspaceId", "userEmail")
            )
        `)

        // Add workspaceId to resource tables
        const tables = ['chat_flow', 'credential', 'tool', 'assistant', 'variable']
        for (const table of tables) {
            const exists = await queryRunner.hasColumn(table, 'workspaceId')
            if (!exists) {
                await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "workspaceId" uuid`)
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tables = ['chat_flow', 'credential', 'tool', 'assistant', 'variable']
        for (const table of tables) {
            await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "workspaceId"`)
        }
        await queryRunner.query(`DROP TABLE IF EXISTS workspace_member`)
        await queryRunner.query(`DROP TABLE IF EXISTS workspace`)
    }
}
