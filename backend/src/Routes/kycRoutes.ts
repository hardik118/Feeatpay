import    { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import z from "zod";
import axios from "axios";
import {S3Client, GetObjectCommand, PutObjectCommand} from "@aws-sdk/client-s3"
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {extname} from "path"
import mime from 'mime';
import { blob } from 'aws-sdk/clients/codecommit';


const prisma= new PrismaClient();

async function kycRoutes(fastify:FastifyInstance) {
    interface kycVerification{
        id: string
    }
    const kycVerificationObject=z.object({
        id: z.string()

    })
    interface webhookResponse {
        applicantId: string,
        inspectionId: string,
        applicantType: string,
        correlationId: string,
        levelName: string,
        sandboxMode: boolean,
        externalUserId: string,
        type: string,
        reviewResult: {
          reviewAnswer: string,
          rejectLabels: [],
          reviewRejectType: string,
          buttonIds: []
        },
        reviewStatus: string,
        createdAt: string,
        createdAtMs: string,
        clientId: string,
        [key: string]: any;
      }

      interface UserKycInfo {
        
            id: string,
            createdAt: string,
            clientId: string,
            inspectionId: string,
            externalUserId: string,
            info: {
                firstName: string,
                lastName: string,
                dob: string,
                country: string,
                idDocs: [
                {
                    idDocType: string,
                    country: string,
                    number: string,
                    validUntil: string
                }
              ]
            },
            email: string,
            applicantPlatform: string,
            requiredIdDocs: {
                docSets: [
                {
                    idDocSetType: string,
                    types: [
                    string,
                    string
                  ]
                }
              ]
            },
            review: {
                createDate: string,
                reviewStatus: string,
                reviewResult: {
                    reviewAnswer: string
              }
            },
            lang: string,
            type: string
          
        [key: string]: any; 
      }
      interface userkycSelifeFacialData {
        id: string;
  [key: string]: any; 
}      
        interface  getUserKyscImageData {
            data: Blob; // The binary file (image)
            contentType: string; // Image type (jpeg, png, etc.)
          }

    fastify.post('/kycVerification', async (request: FastifyRequest<{Body:kycVerification }>, reply: FastifyReply)=>{
        const userId= request.body;
        if(!kycVerificationObject.safeParse(userId)) return reply.send({msg:"the id is invalid"});
        const user= await prisma.user.findFirst({
            where:{
                id: userId.id
            }
        })
        if(!user) return reply.status(401).send({msg:"Hey you are not singed up !! "});
        const KycStatusOfUser= await prisma.userKycVerification.findFirst({
            where:{
                userId: userId.id
            }
        })

        if(KycStatusOfUser?.status=='Verified') return reply.status(401).send({msg:'the KYC is already Done '});
        try {
            const url =`https://api.sumsub.com/resources/accessTokens/sdk`;
            const response= await  axios.post(
              url,
            {
              applicantIdentifiers: {
                email: user.email,
                phone: user.phoneNo
              },
              ttlInSecs: 600,
              userId: user.id,
              levelName: "basic-kyc-level"
            },{
                headers:{
                    "X-App-Token": fastify.config.SUBSUM_TOKEN,
                    "X-App-Access-Sig": fastify.config.SUBSUM_SECRET_KEY,
                    "X-App-Access-Ts" : Date.now(),
                    'Content-Type': "application/json"
                }
            }
            
               
                
            )
            const applicantsToken= response.data.token;
            return reply.status(200).send({token: applicantsToken});

        } catch (error) {
            return reply.status(400).send({msg:"Hey some errro occurde"})
            
        }






    })

    fastify.post("/kycVerification/webhook", async (request: FastifyRequest<{Body: webhookResponse}>, reply:FastifyReply)=>{
        const userIds : webhookResponse = request.body;
        if(!userIds) return  reply.send({msg:"NO Response recieved!"});
        const user= await prisma.user.findFirst({
            where:{
                id: userIds.externalUserId,

            }
        })
        if(!user) return reply.send({msg: 'You are not signed up '});

        try {
            if(userIds.reviewStatus==="completed" && userIds.reviewResult.reviewRejectType=='FINAL' && 
                userIds.reviewResult.reviewAnswer=='GREEN' && userIds.reviewResult.rejectLabels.length==0
            ){
                const userKycInfoApiEndPoint= `GET https://api.sumsub.com/resources/applicants/${userIds.applicantId}/one`;
                const userkycSelifeFacialDataEndPoint= `https://api.sumsub.com/resources/applicants/${userIds.applicantId}/metadata/resources`

              const [userKysInfoResponse , userkycSelifeFacialDataResponse ]= await Promise.all([
                 axios.get(userKycInfoApiEndPoint, {
                    headers: {
                        accept: 'application/json',
                        'X-App-Token': fastify.config.SUBSUM_TOKEN
                      }
                  }),
                   axios.get(userkycSelifeFacialDataEndPoint, {
                    headers: 
                    {'X-App-Token': fastify.config.SUBSUM_TOKEN}
    
                  })

              ])
             const   userKysInfo : UserKycInfo= userKysInfoResponse.data;
               
              const  userkycSelifeFacialData : userkycSelifeFacialData=  userkycSelifeFacialDataResponse.data;

               const getUserKyscImageDataEndPoint=`https://api.sumsub.com/resources/inspections/${userIds.inspectionId}/images/${userkycSelifeFacialData.id}`
              const getUserKyscImageData : getUserKyscImageData= await axios.get(getUserKyscImageDataEndPoint, {
                headers: {
                    'X-App-Token': fastify.config.SUBSUM_TOKEN,
                    "Accept": "*/*"
                  },
                  responseType: "blob",
              })

              const s3Client= new S3Client({
                region: 'us-east-1',
                credentials:{
                    accessKeyId: fastify.config.AWS_ACCESS_KEY_ID,
                    secretAccessKey: fastify.config.AWS_SECRET_ACCESS_KEY
                }
              })
              const extension= extname(getUserKyscImageData.contentType);
              const fileType= mime.getType(extension) || undefined;
              const fileName: string | undefined= `uploads/fiat-user/kyc-${userIds.applicantId}-${userkycSelifeFacialData.id}${extension}` || undefined;

              const params= {
                Bucket: "hyadav-testcase",
                Key : fileName,
                Body: getUserKyscImageData.data,
                ContentType: fileType,
            }

            try {
                const command= new PutObjectCommand(params);
                await s3Client.send(command);
                const selfieUrl= `https://hyadav-testcase.s3.us-east-1.amazonaws.com/${fileName}`;

                const userKyc= await prisma.userKycVerification.create({
                    data:{
                        userId: userIds.externalUserId,
                        documentId: userKysInfo.info.idDocs[0].number,
                        documentType: userKysInfo.info.idDocs[0].idDocType,
                        selfieUrl: selfieUrl,
                        createdAt: userIds.createdAt

                    }
                })

            } catch (error) {
                return reply.status(500).send("could not register the kyc Try again ");
                
            }




            }
        } catch (error) {
            return reply.send({msg:"the kyc failed try again Verifying Yourself !!"});

            
        }
        if(userIds.reviewStatus==="completed" && userIds.reviewResult.reviewRejectType=='FINAL' && 
            userIds.reviewResult.reviewAnswer=='RED' && userIds.reviewResult.rejectLabels.length!=0
        ){
            return reply.send({msg: 'We could not verify Your Profile', response: userIds.reviewResult.rejectLabels})
        }

        if(userIds.reviewStatus==="onHold"){
            return reply.send({msg: 'Your  verification is on hold wait for while for Status to change'});
        }
        if(userIds.reviewStatus==='pending'){
            return reply.send({msg:"Your verification is pending Wait while its getting Updated!!"});

        }
        

    })
    
    
}

export default kycRoutes;
