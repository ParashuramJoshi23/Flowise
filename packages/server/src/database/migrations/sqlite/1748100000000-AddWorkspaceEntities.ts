import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkspaceEntities1748100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const uuid = `(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS workspace (
                id varchar PRIMARY KEY NOT NULL DEFAULT ${uuid},
                name varchar(255) NOT NULL,
                slug varchar(255),
                description text,
                "isActive" boolean NOT NULL DEFAULT 1,
                settings text,
                "createdDate" datetime NOT NULL DEFAULT (datetime('now')),
                "updatedDate" datetime NOT NULL DEFAULT (datetime('now'))
            )
        `)

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS workspace_member (
                id varchar PRIMARY KEY NOT NULL DEFAULT ${uuid},
                "workspaceId" varchar NOT NULL,
                "userEmail" varchar(255) NOT NULL,
                role varchar(50) NOT NULL DEFAULT 'viewer',
                "joinedDate" datetime NOT NULL DEFAULT (datetime('now')),
                "updatedDate" datetime NOT NULL DEFAULT (datetime('now')),
                UNIQUE ("workspaceId", "userEmail")
            )
        `)

        // SQLite requires separate ALTER TABLE per column
        for (const table of ['chat_flow', 'credential', 'tool', 'assistant', 'variable']) {
            try {
                await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "workspaceId" varchar`)
            } catch {
                // Column may already exist — safe to ignore
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS workspace_member`)
        await queryRunner.query(`DROP TABLE IF EXISTS workspace`)
        // SQLite does not support DROP COLUMN — columns remain (acceptable for rollback)
    }
}
