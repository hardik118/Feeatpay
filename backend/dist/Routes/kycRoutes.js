"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const zod_1 = __importDefault(require("zod"));
const axios_1 = __importDefault(require("axios"));
const client_s3_1 = require("@aws-sdk/client-s3");
const path_1 = require("path");
const mime_1 = __importDefault(require("mime"));
const prisma = new client_1.PrismaClient();
async function kycRoutes(fastify) {
    const kycVerificationObject = zod_1.default.object({
        id: zod_1.default.string()
    });
    fastify.post('/kycVerification', async (request, reply) => {
        const userId = request.body;
        if (!kycVerificationObject.safeParse(userId))
            return reply.send({ msg: "the id is invalid" });
        const user = await prisma.user.findFirst({
            where: {
                id: userId.id
            }
        });
        if (!user)
            return reply.status(401).send({ msg: "Hey you are not singed up !! " });
        const KycStatusOfUser = await prisma.userKycVerification.findFirst({
            where: {
                userId: userId.id
            }
        });
        if (KycStatusOfUser?.status == 'Verified')
            return reply.status(401).send({ msg: 'the KYC is already Done ' });
        try {
            const url = `https://api.sumsub.com/resources/accessTokens/sdk`;
            const response = await axios_1.default.post(url, {
                applicantIdentifiers: {
                    email: user.email,
                    phone: user.phoneNo
                },
                ttlInSecs: 600,
                userId: user.id,
                levelName: "basic-kyc-level"
            }, {
                headers: {
                    "X-App-Token": fastify.config.SUBSUM_TOKEN,
                    "X-App-Access-Sig": fastify.config.SUBSUM_SECRET_KEY,
                    "X-App-Access-Ts": Date.now(),
                    'Content-Type': "application/json"
                }
            });
            const applicantsToken = response.data.token;
            return reply.status(200).send({ token: applicantsToken });
        }
        catch (error) {
            return reply.status(400).send({ msg: "Hey some errro occurde" });
        }
    });
    fastify.post("kycVerification/webhook", async (request, reply) => {
        const userIds = request.body;
        if (!userIds)
            return reply.send({ msg: "NO Response recieved!" });
        const user = await prisma.user.findFirst({
            where: {
                id: userIds.externalUserId,
            }
        });
        if (!user)
            return reply.send({ msg: 'You are not signed up ' });
        try {
            if (userIds.reviewStatus === "completed" && userIds.reviewResult.reviewRejectType == 'FINAL' &&
                userIds.reviewResult.reviewAnswer == 'GREEN' && userIds.reviewResult.rejectLabels.length == 0) {
                const userKycInfoApiEndPoint = `GET https://api.sumsub.com/resources/applicants/${userIds.applicantId}/one`;
                const userkycSelifeFacialDataEndPoint = `https://api.sumsub.com/resources/applicants/${userIds.applicantId}/metadata/resources`;
                const [userKysInfoResponse, userkycSelifeFacialDataResponse] = await Promise.all([
                    axios_1.default.get(userKycInfoApiEndPoint, {
                        headers: {
                            accept: 'application/json',
                            'X-App-Token': fastify.config.SUBSUM_TOKEN
                        }
                    }),
                    axios_1.default.get(userkycSelifeFacialDataEndPoint, {
                        headers: { 'X-App-Token': fastify.config.SUBSUM_TOKEN }
                    })
                ]);
                const userKysInfo = userKysInfoResponse.data;
                const userkycSelifeFacialData = userkycSelifeFacialDataResponse.data;
                const getUserKyscImageDataEndPoint = `https://api.sumsub.com/resources/inspections/${userIds.inspectionId}/images/${userkycSelifeFacialData.id}`;
                const getUserKyscImageData = await axios_1.default.get(getUserKyscImageDataEndPoint, {
                    headers: {
                        'X-App-Token': fastify.config.SUBSUM_TOKEN,
                        "Accept": "*/*"
                    },
                    responseType: "blob",
                });
                const s3Client = new client_s3_1.S3Client({
                    region: 'us-east-1',
                    credentials: {
                        accessKeyId: fastify.config.AWS_ACCESS_KEY_ID,
                        secretAccessKey: fastify.config.AWS_SECRET_ACCESS_KEY
                    }
                });
                const extension = (0, path_1.extname)(getUserKyscImageData.contentType);
                const fileType = mime_1.default.getType(extension) || undefined;
                const fileName = `uploads/fiat-user/kyc-${userIds.applicantId}-${userkycSelifeFacialData.id}${extension}` || undefined;
                const params = {
                    Bucket: "hyadav-testcase",
                    Key: fileName,
                    Body: getUserKyscImageData.data,
                    ContentType: fileType,
                };
                try {
                    const command = new client_s3_1.PutObjectCommand(params);
                    await s3Client.send(command);
                    const selfieUrl = `https://hyadav-testcase.s3.us-east-1.amazonaws.com/${fileName}`;
                    const userKyc = await prisma.userKycVerification.create({
                        data: {
                            userId: userIds.externalUserId,
                            documentId: userKysInfo.info.idDocs[0].number,
                            documentType: userKysInfo.info.idDocs[0].idDocType,
                            selfieUrl: selfieUrl,
                            createdAt: userIds.createdAt
                        }
                    });
                }
                catch (error) {
                    return reply.status(500).send("could not register the kyc Try again ");
                }
            }
        }
        catch (error) {
            return reply.send({ msg: "the kyc failed try again Verifying Yourself !!" });
        }
        if (userIds.reviewStatus === "completed" && userIds.reviewResult.reviewRejectType == 'FINAL' &&
            userIds.reviewResult.reviewAnswer == 'RED' && userIds.reviewResult.rejectLabels.length != 0) {
            return reply.send({ msg: 'We could not verify Your Profile', response: userIds.reviewResult.rejectLabels });
        }
        if (userIds.reviewStatus === "onHold") {
            return reply.send({ msg: 'Your  verification is on hold wait for while for Status to change' });
        }
        if (userIds.reviewStatus === 'pending') {
            return reply.send({ msg: "Your verification is pending Wait while its getting Updated!!" });
        }
    });
}
exports.default = kycRoutes;
