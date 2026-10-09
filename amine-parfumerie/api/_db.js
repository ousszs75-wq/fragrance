const U=()=>(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const K=()=>process.env.SUPABASE_SERVICE_KEY||"";
export const rest=(p,o={})=>fetch(U()+"/rest/v1/"+p,{...o,headers:{apikey:K(),Authorization:"Bearer "+K(),"Content-Type":"application/json",...(o.headers||{})}});
export const storage=(path,buf,type)=>fetch(U()+"/storage/v1/object/product-images/"+path,{method:"POST",headers:{apikey:K(),Authorization:"Bearer "+K(),"Content-Type":type},body:buf});
export const publicUrl=path=>U()+"/storage/v1/object/public/product-images/"+path;
