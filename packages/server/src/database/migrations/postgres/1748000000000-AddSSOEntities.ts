import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSSOEntities1748000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS flowise_user (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                email varchar(255) NOT NULL,
                name varchar(255),
                "passwordHash" text,
                role varchar(50) NOT NULL DEFAULT 'viewer',
                "authProvider" varchar(50) NOT NULL DEFAULT 'local',
                "externalId" varchar(255),
                "identityProviderId" uuid,
                "isActive" boolean NOT NULL DEFAULT true,
                "lastLoginAt" timestamp,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_flowise_user" PRIMARY KEY (id),
                CONSTRAINT "UQ_flowise_user_email" UNIQUE (email)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS identity_provider (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                name varchar(100) NOT NULL,
                type varchar(10) NOT NULL,
                "isEnabled" boolean NOT NULL DEFAULT true,
                config text NOT NULL,
                "defaultRole" varchar(50) NOT NULL DEFAULT 'viewer',
                "roleClaimPath" varchar(255),
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_identity_provider" PRIMARY KEY (id)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS flowise_user`)
        await queryRunner.query(`DROP TABLE IF EXISTS identity_provider`)
    }
}
