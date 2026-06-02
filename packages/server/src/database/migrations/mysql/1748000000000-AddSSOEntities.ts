import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSSOEntities1748000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS flowise_user (
                id varchar(36) NOT NULL DEFAULT (UUID()),
                email varchar(255) NOT NULL,
                name varchar(255),
                passwordHash text,
                role varchar(50) NOT NULL DEFAULT 'viewer',
                authProvider varchar(50) NOT NULL DEFAULT 'local',
                externalId varchar(255),
                identityProviderId varchar(36),
                isActive tinyint(1) NOT NULL DEFAULT 1,
                lastLoginAt timestamp NULL,
                createdDate timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedDate timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY UQ_flowise_user_email (email)
            ) CHARACTER SET utf8mb4
        `)

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS identity_provider (
                id varchar(36) NOT NULL DEFAULT (UUID()),
                name varchar(100) NOT NULL,
                type varchar(10) NOT NULL,
                isEnabled tinyint(1) NOT NULL DEFAULT 1,
                config text NOT NULL,
                defaultRole varchar(50) NOT NULL DEFAULT 'viewer',
                roleClaimPath varchar(255),
                createdDate timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedDate timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            ) CHARACTER SET utf8mb4
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS flowise_user`)
        await queryRunner.query(`DROP TABLE IF EXISTS identity_provider`)
    }
}
