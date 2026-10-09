import {rest} from "./_db.js";
import {sign,same,hashPw,checkPw,cleanLogin,loginOk,pwOk,newId} from "./_lib.js";
const s=(v,n)=>String(v??"").trim().slice(0,n);
const pause=()=>new Promise(r=>setTimeout(r,800));
const pub=u=>({id:u.id,name:u.name,login:u.login,role:u.role,title:u.title||""});

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  try{
    /* GET : la boutique est-elle déjà configurée ? (aucune donnée sensible) */
    if(req.method==="GET"){
      const r=await rest("team?role=eq.owner&select=id&limit=1");
      if(!r.ok)return res.status(500).json({error:"db"});
      return res.status(200).json({setup:(await r.json()).length===0});
    }
    if(req.method!=="POST")return res.status(405).end();
    const b=req.body||{};
    if(!process.env.SESSION_SECRET)return res.status(500).json({error:"config"});

    /* ---------- Première installation : créer le propriétaire ---------- */
    if(b.action==="setup"){
      const chk=await rest("team?role=eq.owner&select=id&limit=1");
      if(!chk.ok)return res.status(500).json({error:"db"});
      if((await chk.json()).length)return res.status(409).json({error:"done"});
      // Le code ADMIN_CODE (variable Vercel) sert de clé d'installation : personne d'autre ne peut créer le premier compte.
      if(!process.env.ADMIN_CODE||!same(b.code??"",process.env.ADMIN_CODE)){await pause();return res.status(401).json({error:"code"})}
      const name=s(b.name,60),login=cleanLogin(b.login);
      if(name.length<2)return res.status(400).json({error:"name"});
      if(!loginOk(login))return res.status(400).json({error:"login"});
      if(!pwOk(b.password))return res.status(400).json({error:"password"});
      const id=newId();
      const r=await rest("team",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({id,name,login,role:"owner",password_hash:await hashPw(b.password),last_login:new Date().toISOString()})});
      // l'index unique « un seul propriétaire » refuse une 2e création simultanée
      if(!r.ok)return res.status(r.status===409?409:500).json({error:r.status===409?"done":"insert"});
      return res.status(200).json({token:sign(id),user:{id,name,login,role:"owner",title:""}});
    }

    /* ---------- Connexion ---------- */
    const login=cleanLogin(b.login),pw=String(b.password??"");
    const r=await rest(`team?login=eq.${encodeURIComponent(login)}&select=*&limit=1`);
    if(!r.ok)return res.status(500).json({error:"db"});
    const u=(await r.json())[0];
    const ok=await checkPw(pw,u?.password_hash);
    if(!u||!ok||!u.active){await pause();return res.status(401).json({error:u&&ok&&!u.active?"inactive":"bad"})}
    await rest(`team?id=eq.${u.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({last_login:new Date().toISOString()})});
    return res.status(200).json({token:sign(u.id),user:pub(u)});
  }catch(e){res.status(500).json({error:"server"})}
}
