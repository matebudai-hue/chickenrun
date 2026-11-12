export function normalizePresentation(value={}) {
 const targets=['group','people','transitions','guide','person','case'];
 return {target:targets.includes(value.target)?value.target:'group',names:!!value.names,
 scope:['all','human','test'].includes(value.scope)?value.scope:'human',
 person:Math.max(0,Number(value.person)||0),number:Math.max(0,Number(value.number)||0),
 page:Math.max(0,Math.floor(Number(value.page)||0)),step:Math.max(0,Math.floor(Number(value.step)||0)),
 quotes:Array.isArray(value.quotes)?value.quotes.filter(Number.isInteger):[],revision:Number(value.revision)||0};
}
export function changePresentation(current,patch) {
 return normalizePresentation({...current,...patch,revision:Math.max(Date.now(),current.revision+1)});
}
