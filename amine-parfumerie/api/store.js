import {rest} from "./_db.js";
import {session,can} from "./_lib.js";
const s=(v,n)=>String(v??"").slice(0,n);
const money=v=>{const n=Number(v);return v!==null&&v!==""&&Number.isFinite(n)&&n>=0&&n<=1e6?Math.round(n):null};
const cleanProducts=d=>{
  if(!d||!Array.isArray(d.products)||d.products.length>300)return null;
  return d.products.map(p=>({
    id:s(p.id,40).replace(/[^\w-]/g,""),n:s(p.n,80),b:s(p.b,60),
    g:["Homme","Femme","Unisexe"].includes(p.g)?p.g:"Unisexe",
    c:/^#[0-9a-f]{6}$/i.test(p.c)?p.c:"#2a1d12",
    o:Number(p.o)>0?Math.round(Number(p.o)):null,
    img:/^https:\/\//.test(p.img||"")?s(p.img,500):"",
    sizes:(Array.isArray(p.sizes)?p.sizes:[]).slice(0,9).map(z=>({l:s(z.l,30),p:Math.round(Number(z.p)),q:Math.max(0,Math.floor(Number(z.q)||0))})).filter(z=>z.l&&z.p>0)
  })).filter(p=>p.id&&p.n&&p.sizes.length);
};
// delivery = { "16": {h: 600, o: 400}, ... } (h = domicile, o = bureau). null = non défini.
const cleanDelivery=d=>{
  if(!d||typeof d.delivery!=="object"||!d.delivery)return null;
  const out={};
  for(let c=1;c<=69;c++){const v=d.delivery[c]||d.delivery[String(c)];if(!v)continue;const h=money(v.h),o=money(v.o);if(h!==null||o!==null)out[c]={h,o}}
  return out;
};
const upsert=rows=>rest("settings",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(rows)});
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  try{
    if(req.method==="GET"){
      const [pr,st]=await Promise.all([rest("products?select=*&order=sort.asc,created_at.asc"),rest("settings?select=key,value")]);
      if(!pr.ok||!st.ok)throw new Error("db");
      const rows=await pr.json(),set=Object.fromEntries((await st.json()).map(r=>[r.key,r.value]));
      const admin=req.query?.admin==="1"&&!!(await session(req));
      let delivery={};try{delivery=JSON.parse(set.delivery||"{}")||{}}catch{}
      // Le client ne reçoit JAMAIS la quantité : seulement a = disponible (true/false).
      const products=set.init?rows.map(r=>({id:r.id,n:r.name,b:r.brand,g:r.gender,c:r.color,o:r.old_price||undefined,img:r.img||"",
        sizes:(r.sizes||[]).map(z=>admin?{l:z.l,p:z.p,q:z.q|0}:{l:z.l,p:z.p,a:(z.q|0)>0})})):null;
      return res.status(200).json({products,delivery});
    }
    if(req.method==="PUT"){
      const u=await session(req);if(!u)return res.status(401).json({error:"auth"});
      // ?part=stock : quantités uniquement (accessible aux employés) — {stock:{"id|contenance":qté}}
      if(req.query?.part==="stock"){
        const m=req.body?.stock;if(!m||typeof m!=="object")return res.status(400).json({error:"data"});
        const ids=[...new Set(Object.keys(m).map(k=>k.split("|")[0].replace(/[^\w-]/g,"")))].filter(Boolean);
        if(ids.length){
          const prods=await (await rest(`products?id=in.(${ids.join(",")})&select=id,sizes`)).json();
          for(const p of prods){
            let ch=false;
            const sizes=(p.sizes||[]).map(z=>{const k=p.id+"|"+z.l;if(!(k in m))return z;ch=true;return{...z,q:Math.max(0,Math.floor(Number(m[k])||0))}});
            if(!ch)continue;
            const r=await rest(`products?id=eq.${p.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({sizes})});
            if(!r.ok)throw new Error("stock");
          }
        }
        return res.status(200).json({ok:true});
      }
      // Catalogue et livraison : propriétaire / administrateur uniquement
      if(!can(u,"admin"))return res.status(403).json({error:"role"});
      // ?part=delivery : enregistre uniquement les tarifs de livraison (n'écrase pas le stock)
      if(req.query?.part==="delivery"){
        const dl=cleanDelivery(req.body);if(!dl)return res.status(400).json({error:"data"});
        const r=await upsert([{key:"delivery",value:JSON.stringify(dl)}]);if(!r.ok)throw new Error("settings");
        return res.status(200).json({ok:true});
      }
      const products=cleanProducts(req.body);if(!products)return res.status(400).json({error:"data"});
      const rows=products.map((p,i)=>({id:p.id,name:p.n,brand:p.b,gender:p.g,color:p.c,old_price:p.o,img:p.img,sizes:p.sizes,sort:i}));
      if(rows.length){const r=await rest("products",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(rows)});if(!r.ok)throw new Error("upsert")}
      const del=rows.length?`products?id=not.in.(${rows.map(r=>r.id).join(",")})`:"products?id=not.is.null";
      const r2=await rest(del,{method:"DELETE"});if(!r2.ok)throw new Error("delete");
      const r3=await upsert([{key:"init",value:"1"}]);if(!r3.ok)throw new Error("settings");
      return res.status(200).json({ok:true});
    }
    res.status(405).end();
  }catch(e){res.status(500).json({error:"server"})}
}
