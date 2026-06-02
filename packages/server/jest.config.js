/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    preset: 'ts-jest',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            isolatedModules: true,
            tsconfig: {
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
                esModuleInterop: true,
                strictPropertyInitialization: false,
                skipLibCheck: true,
                paths: {
                    'flowise-components': ['test/__mocks__/emptyModule.js']
                }
            }
        }]
    },
    testMatch: ['**/test/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    clearMocks: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/enterprise/**/*.ts',
        'src/middlewares/authentication.ts',
        'src/middlewares/workspace.ts'
    ],
    setupFiles: ['reflect-metadata'],
    /**
     * Stub heavy native/cloud packages that fail in unit test env.
     */
    moduleNameMapper: {
        '^@google-cloud/(.*)$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^google-auth-library(.*)$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^s3-streamlogger$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^multer-cloud-storage$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^multer-s3$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^flowise-components(.*)$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^flowise-ui$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^flowise-nim-container-manager$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^global-agent/bootstrap$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^posthog-node$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^sqlite3$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^bull-board$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^bullmq$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^prom-client$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^rate-limit-redis$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^openid-client$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^@node-saml/passport-saml$': '<rootDir>/test/__mocks__/emptyModule.js',
        '^passport$': '<rootDir>/test/__mocks__/emptyModule.js'
    }
}
