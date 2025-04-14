import    fastify, {FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import { KMS, Request, TranscribeService } from "aws-sdk";
import { string, z } from "zod";
import { EncryptCommand, KMSClient } from "@aws-sdk/client-kms";
import { Keypair, Connection,  Transaction, PublicKey, TransactionMessage, VersionedTransaction  } from "@solana/web3.js";
import {getAssociatedTokenAddress, createAssociatedTokenAccount, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { Payer } from "@aws-sdk/client-s3";

const prisma= new PrismaClient();

interface WalletBody{
    id : string
}
const userBody=z.object({
    id:  z.string(),
})

interface userKyc {
    userId:  String 
     status :  string
     [key: string]: any;

    
}

const kms= new KMSClient({region: 'us-east-1'});
interface encryptPrivateKeyForUser{
    userId: string,
    walletPublicId: string,
    walletPrivateId: Uint8Array,
    fastify: FastifyInstance

}

const encryptPrivateKeyForUser= async (props: encryptPrivateKeyForUser)=>{
    const command= new EncryptCommand({
        KeyId: props.fastify.config.AWS_KMS_KEY_ID,
        Plaintext: Buffer.from(props.walletPrivateId),
        EncryptionContext:{
            userId: props.userId,
            walletId: props.walletPublicId
        }

    })
    const { CiphertextBlob} =  await kms.send(command);
    if(CiphertextBlob){
        return Buffer.from(CiphertextBlob).toString('base64');
    }else{
        return "NullEncodedForprivateKay";
    }

}


async function Wallet(fastify: FastifyInstance) {


    
    fastify.post('wallet/create', async (request: FastifyRequest<{Body: WalletBody}>, reply: FastifyReply)=>{
        const userId: WalletBody= request.body;
        if(!userBody.safeParse(userId)) return reply.send({msg:"Could not Do that Try Again!!"});

        const user= await prisma.user.findFirst({
            where:{
                id : userId.id
            }
        })
        if(!user) return reply.send({msg: 'hey the user does not exists Mabye Try loggin or singing up again'});
        const userKyc: userKyc | null   = await prisma.userKycVerification.findFirst({
            where:{
                userId: userId.id,
            }
        })
         enum kycStatusVals{
  Pending="Pending",
  Verified="Verified",
  Rejected="Rejected"
        }

        if(!userKyc) return reply.send({msg: 'hye your kyc is pending '});
        if(userKyc.status!==kycStatusVals.Verified)  return reply.send({msg: 'Hye complete your kyc'});
        try {
            console.log("try1");
            const wallet= Keypair.generate();
            const privateKeyEncryptionObject={
                userId: user.id,
                walletPublicId: wallet.publicKey.toBase58(),
                walletPrivateId: wallet.secretKey,
                fastify: fastify

            }
            const encryptPrivateKeyForDb= await encryptPrivateKeyForUser(privateKeyEncryptionObject);
           try {
            console.log("try2");

            const userWallet= await prisma.userWallet.create({
                data:{
                    userId: user.id,
                    walletAddress: wallet.publicKey.toBase58(),
                    walletId: encryptPrivateKeyForDb,
                }
            })

            const connection = new Connection('https://api.mainnet-beta.solana.com');
            const USDC_MINT=  new PublicKey("EPjFWdd5AufqSSqeM2qvwMqqhU5YkkP6r5RM3nXhAxk9");
            try {
                console.log("try3");

                const userUsdcAddress= await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
                const userUsdcAccount= await connection.getAccountInfo(userUsdcAddress);
                if(userUsdcAccount===null) {
                    const instruction= createAssociatedTokenAccountInstruction(
                        wallet.publicKey,
                        userUsdcAddress,
                        wallet.publicKey,
                        USDC_MINT
                    )
                    const {blockhash}= await connection.getLatestBlockhash('finalized');
                    const message = new TransactionMessage({
                        payerKey: wallet.publicKey,
                        recentBlockhash: blockhash,
                        instructions: [instruction]
                    }).compileToLegacyMessage();
                    const transction=new VersionedTransaction(message);
                    transction.sign([wallet]);
                    const latestBlockhash= await  connection.getLatestBlockhash();
                    const signature=  await connection.sendTransaction(transction,{
                        skipPreflight: false,
                        preflightCommitment:'processed',

                    });
                    await connection.confirmTransaction({
                        signature,
                        blockhash: latestBlockhash.blockhash,
                        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                    });

                    return reply.send({msg: 'Your Sol wallet is ready!!, Lets add some Funds'});



                    

                }
                
            } catch (error) {
                return reply.send({msg:'Your wallet could not be created !!'});
                
            }

            
           } catch (error) {
            return reply.send({msg: "could not create wallet Try Again !!"});
            
           }



            
        } catch (error) {
            return reply.send({msg:'Hey could not create the wallet!!'});
            
        }





    })

    fastify.post('/AddFundToWallet', async (request: FastifyRequest , reply :FastifyReply )=>{
    return  reply.send("no done");
     
    })
}
export default Wallet;
