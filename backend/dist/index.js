"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const dotenv_1 = __importDefault(require("dotenv"));
require("./fastify");
const userRoutes_1 = __importDefault(require("./Routes/userRoutes"));
const kycRoutes_1 = __importDefault(require("./Routes/kycRoutes"));
const fastify_jwt_1 = __importDefault(require("fastify-jwt"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
dotenv_1.default.config();
const fastify = (0, fastify_1.default)();
fastify.register(fastify_jwt_1.default, { secret: fastify.config.JWT || 'HY2005HY2005@' });
fastify.register(cookie_1.default);
fastify.register(userRoutes_1.default);
fastify.register(kycRoutes_1.default);
const PORT = Number(fastify.config.PORT) || 3100;
fastify.listen({ port: PORT }, async (err, address) => {
    if (err) {
        console.log('some error has occured');
    }
    console.log(`the Server is running on PORT ${PORT}`);
});
