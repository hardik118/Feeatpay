import Fastify from 'fastify' 
import dotenv from "dotenv";
import userRoute from "./Routes/userRoutes";
import kycRoutes from "./Routes/kycRoutes";
import fastifyJwt from "fastify-jwt";
import fastifyCookie from "@fastify/cookie";

dotenv.config();

const  fastify= Fastify();

fastify.register(fastifyJwt, {secret:process.env.JWT || 'HY2005HY2005@'});
fastify.register(fastifyCookie);
fastify.register(userRoute);
fastify.register(kycRoutes);
const PORT: number = Number(process.env.PORT) || 3100;


fastify.listen({port: PORT}, async (err, address)=>{
    if(err){
        console.log('some error has occured',err);
        process.exit(1);

    }
   else{
    console.log(`the Server is running on PORT ${PORT}`);
   }

})

