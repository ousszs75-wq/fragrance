import {rest} from "./_db.js";
import {need,session,hashPw,checkPw,cleanLogin,loginOk,pwOk,newId} from "./_lib.js";
const s=(v,n)=>String(v??"").trim().slice(0,n);
const safeId=v=>String(v||"").replace(/[^\w-]/g,"").slice(0,60);
const FIELDS="id,name,login,role,title,active,created_at,last_login";
const ASSIGN=["admin","staff"]; // le rôle « owner » est unique et réservé au premier compte
const json=async r=>{if(!r.ok)throw new Error("db");return r.json()};

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  try{
    /* ----- Mon compte (tout membre connecté) ----- */
    if(req.method==="GET"&&req.query?.me==="1"){
      const u=await session(req);if(!u)return res.status(401).json({error:"auth"});
      return res.status(200).json({user:u});
    }
    if(req.method==="POST"&&req.body?.action==="password"){
      const u=await session(req);if(!u)return res.status(401).json({error:"auth"});
      if(!pwOk(req.body.password))return res.status(400).json({error:"password"});
      const row=(await json(await rest(`team?id=eq.${u.id}&select=password_hash`)))[0];
      if(!(await checkPw(String(req.body.current??""),row?.password_hash)))return res.status(403).json({error:"current"});
      const r=await rest(`team?id=eq.${u.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({password_hash:await hashPw(req.body.password)})});
      if(!r.ok)throw new Error("patch");
      return res.status(200).json({ok:true});
    }

    /* ----- Gestion de l'équipe (propriétaire uniquement) ----- */
    const me=await need(req,res,"owner");if(!me)return;
    if(req.method==="GET"){
      const rows=await json(await rest(`team?select=${FIELDS}&order=created_at.asc`));
      return res.status(200).json({team:rows.map(({password_hash,...m})=>m)}); // le hachage ne quitte jamais le serveur
    }
    if(req.method==="POST"){
      const b=req.body||{},name=s(b.name,60),login=cleanLogin(b.login),title=s(b.title,60);
      if(name.length<2)return res.status(400).json({error:"name"});
      if(!loginOk(login))return res.status(400).json({error:"login"});
      if(!pwOk(b.password))return res.status(400).json({error:"password"});
      if(!ASSIGN.includes(b.role))return res.status(400).json({error:"role"});
      const id=newId();
      const r=await rest("team",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id,name,login,title,role:b.role,password_hash:await hashPw(b.password)})});
      if(r.status===409)return res.status(409).json({error:"exists"}); // identifiant déjà pris
      if(!r.ok)throw new Error("insert");
      const [row]=await r.json();const {password_hash,...out}=row;
      return res.status(200).json({member:out});
    }
    if(req.method==="PATCH"){
      const b=req.body||{},id=safeId(b.id);if(!id)return res.status(400).json({error:"data"});
      const t=(await json(await rest(`team?id=eq.${id}&select=id,role`)))[0];
      if(!t)return res.status(404).json({error:"none"});
      const patch={};
      if(b.name!==undefined){const v=s(b.name,60);if(v.length<2)return res.status(400).json({error:"name"});patch.name=v}
      if(b.title!==undefined)patch.title=s(b.title,60);
      if(b.login!==undefined){const v=cleanLogin(b.login);if(!loginOk(v))return res.status(400).json({error:"login"});patch.login=v}
      if(b.password!==undefined){if(!pwOk(b.password))return res.status(400).json({error:"password"});patch.password_hash=await hashPw(b.password)}
      if(t.role!=="owner"){ // on ne change ni le rôle ni l'état du propriétaire
        if(b.role!==undefined){if(!ASSIGN.includes(b.role))return res.status(400).json({error:"role"});patch.role=b.role}
        if(b.active!==undefined)patch.active=!!b.active;
      }
      if(!Object.keys(patch).length)return res.status(400).json({error:"data"});
      const r=await rest(`team?id=eq.${id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify(patch)});
      if(r.status===409)return res.status(409).json({error:"exists"});
      if(!r.ok)throw new Error("patch");
      return res.status(200).json({ok:true});
    }
    if(req.method==="DELETE"){
      const id=safeId(req.query?.id);if(!id)return res.status(400).json({error:"data"});
      const t=(await json(await rest(`team?id=eq.${id}&select=id,role`)))[0];
      if(!t)return res.status(404).json({error:"none"});
      if(t.role==="owner")return res.status(400).json({error:"owner"});
      const r=await rest(`team?id=eq.${id}`,{method:"DELETE"});if(!r.ok)throw new Error("delete");
      return res.status(200).json({ok:true});
    }
    res.status(405).end();
  }catch(e){res.status(500).json({error:"server"})}
}
