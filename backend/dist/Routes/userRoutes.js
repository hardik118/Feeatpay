"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
async function userRoute(fastify) {
    const userSignupBody = zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().max(16).min(8),
        userName: zod_1.z.string(),
        phoneNo: zod_1.z.number().max(10).min(10)
    });
    const userLoginBodyEmail = zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().max(16).min(8),
    });
    const userLoginBodyPhoneNo = zod_1.z.object({
        password: zod_1.z.string().max(16).min(8),
        phoneNo: zod_1.z.number().max(10).min(10)
    });
    fastify.post('/singup', async (request, reply) => {
        const userSingupInfo = request.body;
        if (!userSignupBody.parse(userSingupInfo))
            return reply.send({ msg: "Signup Info is missing" });
        const hashedPassword = await bcrypt_1.default.hash(userSingupInfo.password, 10);
        try {
            const findUser = await prisma.user.findFirst({
                where: {
                    email: userSingupInfo.email,
                    phoneNo: userSingupInfo.phoneNo
                }
            });
            if (findUser)
                return reply.send({ msg: "the detail are already signed up" });
            const user = await prisma.user.create({
                data: {
                    email: userSingupInfo.email,
                    password: hashedPassword,
                    Username: userSingupInfo.userName,
                    phoneNo: userSingupInfo.phoneNo
                },
            });
            const token = fastify.jwt.sign({ userId: user.id });
            return reply.setCookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV == 'production',
                sameSite: 'strict',
                path: '/',
                maxAge: 86400
            }).send({ tokenStatus: "Sucessfull" });
        }
        catch (error) {
            return reply.send({ msg: 'Try Againg you ran into some problem' });
        }
    });
    fastify.post('/login', async (request, reply) => {
        const userLoginBody = request.body;
        if (!userLoginBodyEmail.parse(userLoginBody) || !userLoginBodyPhoneNo.parse(userLoginBody)) {
            reply.send("Login Info is missing !!");
        }
        const findUser = await prisma.user.findFirst({
            where: {
                email: userLoginBody.email,
                phoneNo: userLoginBody.phoneNo
            }
        });
        if (!findUser)
            return reply.send({ msg: "the mail or number is alredy registered" });
        const userPassword = bcrypt_1.default.compare(userLoginBody.password, findUser?.password);
        if (!userPassword)
            return reply.send({ msg: 'the password is wrong !!' });
        const token = fastify.jwt.sign({ userId: findUser.id });
        return reply.send({ token: token });
    });
    fastify.put('changePasswword', async (request, reply) => {
        const userBody = request.body;
        if (!userLoginBodyEmail.safeParse(userBody))
            return reply.send({ msg: 'some Info is missing !!' });
        const user = await prisma.user.findFirst({
            where: {
                email: userBody.email
            }
        });
        if (!user)
            return reply.send({ msg: 'the user is singed up !!' });
        try {
            const isValid = await bcrypt_1.default.compare(userBody.password, user.password);
            if (!isValid)
                return reply.send({ msg: 'the password is wrong ' });
        }
        catch (error) {
            return reply.status(500).send({ msg: 'Try again!!' });
        }
        const newpassword = await bcrypt_1.default.hash(userBody.password, 10);
        try {
            if (user) {
                await prisma.user.update({
                    where: {
                        email: userBody.email,
                    },
                    data: {
                        password: newpassword
                    }
                });
                return reply.send({ msg: `your new password is upated !!` });
            }
        }
        catch (error) {
            return reply.send({ msg: 'Error while chagging password Try again' });
        }
    });
}
exports.default = userRoute;
