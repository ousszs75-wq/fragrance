import crypto from "node:crypto";
import {rest} from "./_db.js";
const secret=()=>process.env.SESSION_SECRET||"";
const mac=p=>crypto.createHmac("sha256",secret()).update(p).digest("base64url");

/* ---------- jeton de session (signé, 12 h) : contient uniquement l'id du membre ---------- */
export const sign=sid=>{const p=Buffer.from(JSON.stringify({sid,exp:Date.now()+12*36e5})).toString("base64url");return p+"."+mac(p)};
const readToken=req=>{
  if(!secret())return null;
  const [p,m]=(req.headers.authorization||"").replace(/^Bearer /,"").split(".");
  if(!p||!m)return null;
  const a=Buffer.from(mac(p)),b=Buffer.from(m);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  try{const d=JSON.parse(Buffer.from(p,"base64url"));return d.exp>Date.now()&&d.sid?d:null}catch{return null}
};

/* ---------- rôles ---------- */
export const ROLES=["owner","admin","staff"];
// owner = tout + équipe ; admin = tout sauf équipe ; staff = commandes + stock
export const can=(user,level)=>!!user&&(level==="any"||(level==="admin"&&user.role!=="staff")||(level==="owner"&&user.role==="owner"));

/* ---------- session : relue en base à chaque requête (un membre supprimé/désactivé est coupé immédiatement) ---------- */
export async function session(req){
  const t=readToken(req);if(!t)return null;
  try{
    const r=await rest(`team?id=eq.${encodeURIComponent(String(t.sid).replace(/[^\w-]/g,""))}&select=id,name,login,role,title,active`);
    if(!r.ok)return null;
    const u=(await r.json())[0];
    return u&&u.active?u:null;
  }catch{return null}
}
// Utilisation : const u=await need(req,res,"any"|"admin"|"owner"); if(!u)return;
export async function need(req,res,level="any"){
  const u=await session(req);
  if(!u){res.status(401).json({error:"auth"});return null}
  if(!can(u,level)){res.status(403).json({error:"role"});return null}
  return u;
}

/* ---------- mots de passe : scrypt + sel aléatoire ---------- */
const scrypt=(pw,salt)=>new Promise((ok,ko)=>crypto.scrypt(String(pw),salt,32,(e,k)=>e?ko(e):ok(k)));
export async function hashPw(pw){const salt=crypto.randomBytes(16);const k=await scrypt(pw,salt);return "s1$"+salt.toString("base64url")+"$"+k.toString("base64url")}
export async function checkPw(pw,stored){
  const [v,s,h]=String(stored||"").split("$");
  // hash factice : le temps de réponse ne révèle pas si l'identifiant existe
  if(v!=="s1"||!s||!h){await scrypt(pw,Buffer.alloc(16));return false}
  const k=await scrypt(pw,Buffer.from(s,"base64url")),b=Buffer.from(h,"base64url");
  return k.length===b.length&&crypto.timingSafeEqual(k,b);
}
export const same=(x,y)=>{const h=v=>crypto.createHash("sha256").update(String(v)).digest();return crypto.timingSafeEqual(h(x),h(y))};

/* ---------- validation ---------- */
export const cleanLogin=v=>String(v??"").trim().toLowerCase();
export const loginOk=v=>/^[a-z0-9][a-z0-9._@-]{2,39}$/.test(v);
export const pwOk=v=>typeof v==="string"&&v.length>=8&&v.length<=100;
export const newId=()=>"m"+Date.now().toString(36)+crypto.randomBytes(3).toString("hex");
