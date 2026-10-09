import {sign,same} from "./_lib.js";
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).end();
  const ok=process.env.ADMIN_CODE&&process.env.SESSION_SECRET&&same(req.body?.code??"",process.env.ADMIN_CODE);
  if(!ok){await new Promise(r=>setTimeout(r,800));return res.status(401).json({error:"code"})}
  res.status(200).json({token:sign()});
}
