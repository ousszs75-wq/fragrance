import {rest} from "./_db.js";
import {isAdmin} from "./_lib.js";
const s=(v,n)=>String(v??"").slice(0,n);
const clean=d=>{
  if(!d||!Array.isArray(d.products)||d.products.length>300)return null;
  const products=d.products.map(p=>({
    id:s(p.id,40).replace(/[^\w-]/g,""),n:s(p.n,80),b:s(p.b,60),
    g:["Homme","Femme","Unisexe"].includes(p.g)?p.g:"Unisexe",
    c:/^#[0-9a-f]{6}$/i.test(p.c)?p.c:"#2a1d12",
    o:Number(p.o)>0?Math.round(Number(p.o)):null,
    img:/^https:\/\//.test(p.img||"")?s(p.img,500):"",
    sizes:(Array.isArray(p.sizes)?p.sizes:[]).slice(0,9).map(z=>({l:s(z.l,30),p:Math.round(Number(z.p)),q:Math.max(0,Math.floor(Number(z.q)||0))})).filter(z=>z.l&&z.p>0)
  })).filter(p=>p.id&&p.n&&p.sizes.length);
  return {wa:s(d.wa,30),products};
};
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  try{
    if(req.method==="GET"){
      const [pr,st]=await Promise.all([rest("products?select=*&order=sort.asc,created_at.asc"),rest("settings?select=key,value")]);
      if(!pr.ok||!st.ok)throw new Error("db");
      const rows=await pr.json(),set=Object.fromEntries((await st.json()).map(r=>[r.key,r.value]));
      const admin=isAdmin(req)&&req.query?.admin==="1";
      // Le client ne reçoit JAMAIS la quantité : seulement a = disponible (true/false).
      const products=set.init?rows.map(r=>({id:r.id,n:r.name,b:r.brand,g:r.gender,c:r.color,o:r.old_price||undefined,img:r.img||"",
        sizes:(r.sizes||[]).map(z=>admin?{l:z.l,p:z.p,q:z.q|0}:{l:z.l,p:z.p,a:(z.q|0)>0})})):null;
      return res.status(200).json({wa:set.wa||"",products});
    }
    if(req.method==="PUT"){
      if(!isAdmin(req))return res.status(401).json({error:"auth"});
      const d=clean(req.body);if(!d)return res.status(400).json({error:"data"});
      const rows=d.products.map((p,i)=>({id:p.id,name:p.n,brand:p.b,gender:p.g,color:p.c,old_price:p.o,img:p.img,sizes:p.sizes,sort:i}));
      if(rows.length){const r=await rest("products",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(rows)});if(!r.ok)throw new Error("upsert")}
      const del=rows.length?`products?id=not.in.(${rows.map(r=>r.id).join(",")})`:"products?id=not.is.null";
      const r2=await rest(del,{method:"DELETE"});if(!r2.ok)throw new Error("delete");
      const r3=await rest("settings",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify([{key:"wa",value:d.wa},{key:"init",value:"1"}])});
      if(!r3.ok)throw new Error("settings");
      return res.status(200).json({ok:true});
    }
    res.status(405).end();
  }catch(e){res.status(500).json({error:"server"})}
}
