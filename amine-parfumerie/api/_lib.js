import crypto from "node:crypto";
const secret=()=>process.env.SESSION_SECRET||"";
const mac=p=>crypto.createHmac("sha256",secret()).update(p).digest("base64url");
export const sign=()=>{const p=Buffer.from(JSON.stringify({exp:Date.now()+12*36e5})).toString("base64url");return p+"."+mac(p)};
export const isAdmin=req=>{
  if(!secret())return false;
  const [p,m]=(req.headers.authorization||"").replace(/^Bearer /,"").split(".");
  if(!p||!m)return false;
  const a=Buffer.from(mac(p)),b=Buffer.from(m);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;
  try{return JSON.parse(Buffer.from(p,"base64url")).exp>Date.now()}catch{return false}
};
export const same=(x,y)=>{const h=v=>crypto.createHash("sha256").update(String(v)).digest();return crypto.timingSafeEqual(h(x),h(y))};
