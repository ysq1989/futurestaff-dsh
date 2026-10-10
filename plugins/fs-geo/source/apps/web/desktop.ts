/** Same-origin desktop transport; no credentials or arbitrary Host commands. */
document.addEventListener('click',event=>{
 const anchor=(event.target as Element)?.closest?.('a');if(!anchor)return;
 const url=new URL(anchor.href,window.location.href);
 if(url.origin===window.location.origin&&url.pathname.startsWith('/_futurestaff/geo/api/geo/v1/')&&url.pathname.endsWith('/export')){
  event.preventDefault();
  void fetch(url.href,{headers:{'x-futurestaff-geo':'1'},cache:'no-store'}).then(async response=>{
   if(!response.ok)throw Error('导出失败，请重新核对登录与 GEO 权限');
   const blob=await response.blob();const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='geo-export.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  }).catch(()=>window.dispatchEvent(new Event('geo-session-invalid')));
 }else if(['https:','http:'].includes(url.protocol)&&url.origin!==window.location.origin){
  event.preventDefault();window.parent.postMessage({type:'futurestaff-geo-open-link',url:url.href},window.location.origin);
 }
});
