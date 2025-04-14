"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const client_kms_1 = require("@aws-sdk/client-kms");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const prisma = new client_1.PrismaClient();
const userBody = zod_1.z.object({
    id: zod_1.z.string(),
});
const kms = new client_kms_1.KMSClient({ region: 'us-east-1' });
const encryptPrivateKeyForUser = async (props) => {
    const command = new client_kms_1.EncryptCommand({
        KeyId: props.fastify.config.AWS_KMS_KEY_ID,
        Plaintext: Buffer.from(props.walletPrivateId),
        EncryptionContext: {
            userId: props.userId,
            walletId: props.walletPublicId
        }
    });
    const { CiphertextBlob } = await kms.send(command);
    if (CiphertextBlob) {
        return Buffer.from(CiphertextBlob).toString('base64');
    }
    else {
        return "NullEncodedForprivateKay";
    }
};
async function Wallet(fastify) {
    fastify.post('wallet/create', async (request, reply) => {
        const userId = request.body;
        if (!userBody.safeParse(userId))
            return reply.send({ msg: "Could not Do that Try Again!!" });
        const user = await prisma.user.findFirst({
            where: {
                id: userId.id
            }
        });
        if (!user)
            return reply.send({ msg: 'hey the user does not exists Mabye Try loggin or singing up again' });
        const userKyc = await prisma.userKycVerification.findFirst({
            where: {
                userId: userId.id,
            }
        });
        let kycStatusVals;
        (function (kycStatusVals) {
            kycStatusVals["Pending"] = "Pending";
            kycStatusVals["Verified"] = "Verified";
            kycStatusVals["Rejected"] = "Rejected";
        })(kycStatusVals || (kycStatusVals = {}));
        if (!userKyc)
            return reply.send({ msg: 'hye your kyc is pending ' });
        if (userKyc.status !== kycStatusVals.Verified)
            return reply.send({ msg: 'Hye complete your kyc' });
        try {
            console.log("try1");
            const wallet = web3_js_1.Keypair.generate();
            const privateKeyEncryptionObject = {
                userId: user.id,
                walletPublicId: wallet.publicKey.toBase58(),
                walletPrivateId: wallet.secretKey,
                fastify: fastify
            };
            const encryptPrivateKeyForDb = await encryptPrivateKeyForUser(privateKeyEncryptionObject);
            try {
                console.log("try2");
                const userWallet = await prisma.userWallet.create({
                    data: {
                        userId: user.id,
                        walletAddress: wallet.publicKey.toBase58(),
                        walletId: encryptPrivateKeyForDb,
                    }
                });
                const connection = new web3_js_1.Connection('https://api.mainnet-beta.solana.com');
                const USDC_MINT = new web3_js_1.PublicKey("EPjFWdd5AufqSSqeM2qvwMqqhU5YkkP6r5RM3nXhAxk9");
                try {
                    console.log("try3");
                    const userUsdcAddress = await (0, spl_token_1.getAssociatedTokenAddress)(USDC_MINT, wallet.publicKey);
                    const userUsdcAccount = await connection.getAccountInfo(userUsdcAddress);
                    if (userUsdcAccount === null) {
                        const instruction = (0, spl_token_1.createAssociatedTokenAccountInstruction)(wallet.publicKey, userUsdcAddress, wallet.publicKey, USDC_MINT);
                        const { blockhash } = await connection.getLatestBlockhash('finalized');
                        const message = new web3_js_1.TransactionMessage({
                            payerKey: wallet.publicKey,
                            recentBlockhash: blockhash,
                            instructions: [instruction]
                        }).compileToLegacyMessage();
                        const transction = new web3_js_1.VersionedTransaction(message);
                        transction.sign([wallet]);
                        const latestBlockhash = await connection.getLatestBlockhash();
                        const signature = await connection.sendTransaction(transction, {
                            skipPreflight: false,
                            preflightCommitment: 'processed',
                        });
                        await connection.confirmTransaction({
                            signature,
                            blockhash: latestBlockhash.blockhash,
                            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                        });
                        return reply.send({ msg: 'Your Sol wallet is ready!!, Lets add some Funds' });
                    }
                }
                catch (error) {
                    return reply.send({ msg: 'Your wallet could not be created !!' });
                }
            }
            catch (error) {
                return reply.send({ msg: "could not create wallet Try Again !!" });
            }
        }
        catch (error) {
            return reply.send({ msg: 'Hey could not create the wallet!!' });
        }
    });
    fastify.post('/AddFundToWallet', async (request, reply) => {
        return reply.send("no done");
    });
}
exports.default = Wallet;
