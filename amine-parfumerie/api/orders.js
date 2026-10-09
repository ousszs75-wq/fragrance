import {rest} from "./_db.js";
import {isAdmin} from "./_lib.js";
const s=(v,n)=>String(v??"").slice(0,n);
const STATUS=["new","confirmed","shipped","delivered","cancelled"];
const HOLD=["confirmed","shipped","delivered"]; // statuts pour lesquels le stock est déduit
const safeId=v=>String(v||"").replace(/[^\w-]/g,"").slice(0,60);
const newId=()=>"AP"+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,5).toUpperCase();
const json=async r=>{if(!r.ok)throw new Error("db");return r.json()};

async function deliveryFee(code,mode){
  const a=await json(await rest("settings?key=eq.delivery&select=value"));
  let d={};try{d=JSON.parse(a[0]?.value||"{}")||{}}catch{}
  const v=d?.[code]?.[mode==="home"?"h":"o"];
  return Number.isFinite(v)&&v>=0?v:null;
}
// dir = -1 : déduit le stock ; +1 : le remet
async function adjustStock(items,dir){
  const ids=[...new Set(items.map(i=>safeId(i.id)))].filter(Boolean);
  if(!ids.length)return;
  const prods=await json(await rest(`products?id=in.(${ids.join(",")})&select=id,sizes`));
  for(const p of prods){
    const sizes=(p.sizes||[]).map(z=>{
      const used=items.filter(i=>i.id===p.id&&i.l===z.l).reduce((a,i)=>a+(i.qty|0),0);
      return used?{...z,q:Math.max(0,(z.q|0)+dir*used)}:z;
    });
    const r=await rest(`products?id=eq.${p.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({sizes})});
    if(!r.ok)throw new Error("stock");
  }
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  try{
    /* ---------- Client : créer une commande ---------- */
    if(req.method==="POST"){
      const b=req.body||{};
      if(b.website)return res.status(200).json({ok:true,id:"AP"}); // pot de miel anti-robots
      const name=s(b.name,80).trim(),addr=s(b.address,200).trim(),commune=s(b.commune,80).trim(),wilaya=s(b.wilaya,60).trim(),note=s(b.note,300).trim();
      const mode=b.mode==="office"?"office":"home";
      const code=Math.floor(Number(b.wilayaCode));
      let tel=String(b.phone||"").replace(/[\s.-]/g,"");
      if(name.length<3)return res.status(400).json({error:"name"});
      if(!/^(0|\+?213)[5-7]\d{8}$/.test(tel))return res.status(400).json({error:"phone"});
      tel="0"+tel.slice(-9);
      if(!(code>=1&&code<=69))return res.status(400).json({error:"wilaya"});
      if(commune.length<2)return res.status(400).json({error:"commune"});
      if(mode==="home"&&addr.length<6)return res.status(400).json({error:"address"});
      const want=new Map();
      for(const i of Array.isArray(b.items)?b.items.slice(0,40):[]){
        const id=safeId(i.id),l=s(i.l,30),q=Math.floor(Number(i.qty));
        if(!id||!l||!(q>=1&&q<=20))continue;
        const k=id+"|"+l;want.set(k,{id,l,qty:(want.get(k)?.qty||0)+q});
      }
      if(!want.size)return res.status(400).json({error:"items"});
      const ids=[...new Set([...want.values()].map(i=>i.id))];
      const prods=await json(await rest(`products?id=in.(${ids.join(",")})&select=id,name,brand,sizes`));
      const lines=[];
      for(const w of want.values()){
        const p=prods.find(x=>x.id===w.id),z=p&&(p.sizes||[]).find(z=>z.l===w.l);
        if(!z||(z.q|0)<w.qty)return res.status(409).json({error:"stock",item:p?`${p.brand} ${p.name}`:w.id});
        lines.push({id:p.id,n:p.name,b:p.brand,l:z.l,p:z.p,qty:w.qty}); // prix relus côté serveur
      }
      const subtotal=lines.reduce((a,i)=>a+i.p*i.qty,0);
      const delivery=await deliveryFee(code,mode);
      const total=subtotal+(delivery||0);
      const id=newId();
      const r=await rest("orders",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({id,name,phone:tel,wilaya_code:code,wilaya,commune,address:mode==="home"?addr:"",mode,items:lines,subtotal,delivery,total,note})});
      if(!r.ok)throw new Error("insert");
      return res.status(200).json({ok:true,id,subtotal,delivery,total});
    }
    /* ---------- Admin ---------- */
    if(!isAdmin(req))return res.status(401).json({error:"auth"});
    if(req.method==="GET"){
      const rows=await json(await rest("orders?select=*&order=created_at.desc&limit=1000"));
      return res.status(200).json({orders:rows});
    }
    if(req.method==="PATCH"){
      const id=safeId(req.body?.id),status=req.body?.status;
      if(!id||!STATUS.includes(status))return res.status(400).json({error:"data"});
      const o=(await json(await rest(`orders?id=eq.${id}&select=*`)))[0];
      if(!o)return res.status(404).json({error:"none"});
      let applied=!!o.stock_applied;
      if(HOLD.includes(status)&&!applied){await adjustStock(o.items||[],-1);applied=true}
      else if(!HOLD.includes(status)&&applied){await adjustStock(o.items||[],+1);applied=false}
      const patch={status,stock_applied:applied};
      if(typeof req.body.note==="string")patch.note=s(req.body.note,300);
      const r=await rest(`orders?id=eq.${id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify(patch)});
      if(!r.ok)throw new Error("patch");
      return res.status(200).json({ok:true,status,stock_applied:applied});
    }
    if(req.method==="DELETE"){
      const id=safeId(req.query?.id);if(!id)return res.status(400).json({error:"data"});
      const o=(await json(await rest(`orders?id=eq.${id}&select=*`)))[0];
      if(o&&o.stock_applied)await adjustStock(o.items||[],+1);
      const r=await rest(`orders?id=eq.${id}`,{method:"DELETE"});if(!r.ok)throw new Error("delete");
      return res.status(200).json({ok:true});
    }
    res.status(405).end();
  }catch(e){res.status(500).json({error:"server"})}
}
