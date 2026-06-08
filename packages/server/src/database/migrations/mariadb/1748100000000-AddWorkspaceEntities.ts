import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkspaceEntities1748100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS workspace (
                id varchar(36) NOT NULL DEFAULT (UUID()),
                name varchar(255) NOT NULL,
                slug varchar(255),
                description text,
                isActive tinyint(1) NOT NULL DEFAULT 1,
                settings text,
                createdDate timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedDate timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            ) CHARACTER SET utf8mb4
        `)

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS workspace_member (
                id varchar(36) NOT NULL DEFAULT (UUID()),
                workspaceId varchar(36) NOT NULL,
                userEmail varchar(255) NOT NULL,
                role varchar(50) NOT NULL DEFAULT 'viewer',
                joinedDate timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedDate timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY UQ_workspace_member (workspaceId, userEmail)
            ) CHARACTER SET utf8mb4
        `)

        const tables = ['chat_flow', 'credential', 'tool', 'assistant', 'variable']
        for (const table of tables) {
            try {
                await queryRunner.query(`ALTER TABLE \`${table}\` ADD COLUMN workspaceId varchar(36)`)
            } catch {
                // Column may already exist
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tables = ['chat_flow', 'credential', 'tool', 'assistant', 'variable']
        for (const table of tables) {
            try {
                await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN workspaceId`)
            } catch {}
        }
        await queryRunner.query(`DROP TABLE IF EXISTS workspace_member`)
        await queryRunner.query(`DROP TABLE IF EXISTS workspace`)
    }
}
