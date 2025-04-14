import Fastify from "fastify";
import fastifyenv from "@fastify/env";
import { string } from "zod";

 const   Schema= {
    type :"object",
    required: ['PORT', 'DATABASE_URL', 'JWT', 'SUBSUM_TOKEN', 'SUBSUM_SECRET_KEY','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_KMS_KEY_ID'],
    properties:{
        PORT:{type: 'string', default: 3000},
        DATABASE_URL:{type: 'string'},
        JWT:{type: 'string'},
        SUBSUM_TOKEN: {type : 'string'},
        SUBSUM_SECRET_KEY: {type: 'string'},
        AWS_ACCESS_KEY_ID: {type: 'string'},
        AWS_SECRET_ACCESS_KEY: {type: 'string'},
        AWS_KMS_KEY_ID: {type: "string"}



    },

}

export const Options={
    confKey: 'config',
    Schema,
    dotenv: true

}

const fastify= Fastify();
fastify.register(fastifyenv, Options).ready();



