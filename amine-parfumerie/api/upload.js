import {storage,publicUrl} from "./_db.js";
import {isAdmin} from "./_lib.js";
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).end();
  if(!isAdmin(req))return res.status(401).json({error:"auth"});
  const m=/^data:image\/(webp|png|jpeg);base64,(.+)$/.exec(req.body?.data||"");
  if(!m)return res.status(400).json({error:"format"});
  const buf=Buffer.from(m[2],"base64");
  if(buf.length>1.5e6)return res.status(413).json({error:"size"});
  const id=String(req.body.id||"p").replace(/\W/g,"").slice(0,30)||"p";
  const path=`${id}-${Date.now()}.${m[1]==="jpeg"?"jpg":m[1]}`;
  const r=await storage(path,buf,`image/${m[1]}`);
  if(!r.ok)return res.status(500).json({error:"storage"});
  res.status(200).json({url:publicUrl(path)});
}
