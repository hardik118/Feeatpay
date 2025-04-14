"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Options = void 0;
const fastify_1 = __importDefault(require("fastify"));
const env_1 = __importDefault(require("@fastify/env"));
const Schema = {
    type: "object",
    required: ['PORT', 'DATABASE_URL', 'JWT', 'SUBSUM_TOKEN', 'SUBSUM_SECRET_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_KMS_KEY_ID'],
    properties: {
        PORT: { type: 'string', default: 3000 },
        DATABASE_URL: { type: 'string' },
        JWT: { type: 'string' },
        SUBSUM_TOKEN: { type: 'string' },
        SUBSUM_SECRET_KEY: { type: 'string' },
        AWS_ACCESS_KEY_ID: { type: 'string' },
        AWS_SECRET_ACCESS_KEY: { type: 'string' },
        AWS_KMS_KEY_ID: { type: "string" }
    },
};
exports.Options = {
    confKey: 'config',
    Schema,
    dotenv: true
};
const fastify = (0, fastify_1.default)();
fastify.register(env_1.default, exports.Options).ready();
