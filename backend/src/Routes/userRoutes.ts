import    { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import {z } from 'zod'

const prisma= new PrismaClient();



async function userRoute(fastify:FastifyInstance) {



     const userSignupBody=z.object({
        email: z.string().email(),
        password: z.string().max(16).min(8),
        userName: z.string(),
        phoneNo: z.string().max(10).min(10)

     })

     const userLoginBodyEmail=z.object({
        email: z.string().email(),
        password: z.string().max(16).min(8),
     })

     const userLoginBodyPhoneNo=z.object({
        password: z.string().max(16).min(8),
        phoneNo: z.string().max(10).min(10)
     })
    interface userSingupInfoTypes {
        
            email:string,
            password:string,
            userName: string
            phoneNo: string
        
    }

    interface userLoginInfoTypes{
        email?:string,
        password:string,
        phoneNo?: string,
        loginType: string

    }
    fastify.post('/singup', async (request : FastifyRequest<{Body: userSingupInfoTypes}>, reply: FastifyReply)=>{
        const  userSingupInfo =  request.body  ;
        if(!userSignupBody.parse(userSingupInfo))  return reply.send( {msg: "Signup Info is missing"});

        const hashedPassword= await bcrypt.hash(userSingupInfo.password, 10);

        try {

            const findUser= await prisma.user.findFirst({
                where:{
                    email: userSingupInfo.email,
                    phoneNo: userSingupInfo.phoneNo
                }
            })
            if(findUser) return reply.send({msg: "the detail are already signed up"});

           const user= await prisma.user.create({
                data:{
                    email: userSingupInfo.email,
                    password: hashedPassword,
                    Username: userSingupInfo.userName,
                    phoneNo: userSingupInfo.phoneNo
                },
            })
            const  token= fastify.jwt.sign({userId: user.id});

           return  reply.setCookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV=='production',
            sameSite :'strict',
            path:'/',
            maxAge: 86400
           }).send({tokenStatus:"Sucessfull" });
           
        } catch (error) {
            console.log(error);
          return   reply.send({msg: 'Try Againg you ran into some problem'});

            
        }


    })

    fastify.post('/login', async (request:FastifyRequest<{Body: userLoginInfoTypes}>, reply: FastifyReply)=>{

        const userLoginBody= request.body;
if(userLoginBody.loginType==='email'){
    if(!userLoginBodyEmail.parse(userLoginBody)){
        reply.send('Login Info is missing!');
    }
    
}
if(userLoginBody.loginType==='phone'){
    if(!userLoginBodyPhoneNo.parse(userLoginBody)){
        reply.send("Login Info is missing !!");
    }
}

        const findUser= await prisma.user.findFirst({
            where:{
                OR:[
                    {email: userLoginBody.email},
                    {phoneNo: userLoginBody.phoneNo}
                ]
            }
        })
        if(!findUser) return  reply.send({msg:"the mail or number is alredy registered"});

    const userPassword=  bcrypt.compare(userLoginBody.password, findUser?.password );
    if(!userPassword) return reply.send({msg:'the password is wrong !!'});

    const  token= fastify.jwt.sign({userId: findUser.id});

    return  reply.setCookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV=='production',
        sameSite :'strict',
        path:'/',
        maxAge: 86400
       }).send({tokenStatus:"Sucessfull" });




    })
    fastify.put('/changePasswword', async ( request: FastifyRequest<{Body: userLoginInfoTypes }>, reply : FastifyReply)=>{
        const userBody= request.body;
        if(!userLoginBodyEmail.safeParse(userBody)) return reply.send({msg: 'some Info is missing !!'});
        
        const user= await prisma.user.findFirst({
            where:{
                email: userBody.email
            }
        })
        if(!user) return reply.send({msg:'the user is singed up !!'})
        try {
            const isValid= await bcrypt.compare(userBody.password, user.password );
            if(!isValid) return reply.send({msg: 'the password is wrong '});
        } catch (error) {
            return reply.status(500).send({msg: 'Try again!!'});
            
        }
        const newpassword= await bcrypt.hash(userBody.password, 10);

        try {
            if(user){
                await prisma.user.update({
                    where:{
                        email: userBody.email,
                    }, 
                    data:{
                       password: newpassword
                    }
                })
                return reply.send({msg: `your new password is upated !!`});
            }
        } catch (error) {
            return reply.send({msg: 'Error while chagging password Try again'});
            
        }
    
    })
    
}

export  default userRoute ;

