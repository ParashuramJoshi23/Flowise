import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSSOEntities1748000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS flowise_user (
                id varchar PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
                email varchar(255) NOT NULL UNIQUE,
                name varchar(255),
                "passwordHash" text,
                role varchar(50) NOT NULL DEFAULT 'viewer',
                "authProvider" varchar(50) NOT NULL DEFAULT 'local',
                "externalId" varchar(255),
                "identityProviderId" varchar,
                "isActive" boolean NOT NULL DEFAULT 1,
                "lastLoginAt" datetime,
                "createdDate" datetime NOT NULL DEFAULT (datetime('now')),
                "updatedDate" datetime NOT NULL DEFAULT (datetime('now'))
            )
        `)

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS identity_provider (
                id varchar PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
                name varchar(100) NOT NULL,
                type varchar(10) NOT NULL,
                "isEnabled" boolean NOT NULL DEFAULT 1,
                config text NOT NULL,
                "defaultRole" varchar(50) NOT NULL DEFAULT 'viewer',
                "roleClaimPath" varchar(255),
                "createdDate" datetime NOT NULL DEFAULT (datetime('now')),
                "updatedDate" datetime NOT NULL DEFAULT (datetime('now'))
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS flowise_user`)
        await queryRunner.query(`DROP TABLE IF EXISTS identity_provider`)
    }
}
