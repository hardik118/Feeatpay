import "@fastify/env"

declare module 'fastify'{
    interface FastifyInstance{
        config:{
            JWT: string
            PORT: String,
            DATABASE_URL: string
            SUBSUM_TOKEN: string
            SUBSUM_SECRET_KEY: string
            AWS_ACCESS_KEY_ID: string
            AWS_SECRET_ACCESS_KEY: string
            AWS_KMS_KEY_ID: string
        }
    }
}