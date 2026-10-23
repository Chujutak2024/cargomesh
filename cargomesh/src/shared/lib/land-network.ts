/** Geographic exclusion only. Matching networks never prove a usable road or carrier coverage. */
const networks:Record<string,string>={
 PE:'south-america',CO:'south-america',EC:'south-america',CL:'south-america',BR:'south-america',AR:'south-america',BO:'south-america',UY:'south-america',PY:'south-america',VE:'south-america',
 US:'north-america',CA:'north-america',MX:'north-america',PA:'north-america',CR:'north-america',NI:'north-america',HN:'north-america',SV:'north-america',GT:'north-america',BZ:'north-america',
 ES:'afro-eurasia',FR:'afro-eurasia',DE:'afro-eurasia',IN:'afro-eurasia',TH:'afro-eurasia',MY:'afro-eurasia',SG:'afro-eurasia',ZA:'afro-eurasia',KE:'afro-eurasia',
 AU:'australia',JP:'japan',GB:'great-britain',
};
type Location={countryCode:string;lat?:number|null;lng?:number|null};
function networkFor(location:Location){
 const network=networks[location.countryCode];
 if(location.lat==null||location.lng==null)return network;
 // Overseas territories/islands must not inherit a mainland exclusion from the country code.
 const regions:Record<string,readonly[number,number,number,number]>={
  'south-america':[-56,13,-82,-34],'north-america':[7,84,-170,-50],
  'afro-eurasia':[-35,82,-18,180],australia:[-44,-10,112,154],japan:[30,46,128,146],'great-britain':[49.5,61,-8.7,2],
 };
 const bounds=regions[network];
 if(bounds&&(location.lat<bounds[0]||location.lat>bounds[1]||location.lng<bounds[2]||location.lng>bounds[3]))return undefined;
 return network;
}
export function facilityLandPolicy(origin:Location,destination:Location){
 const a=networkFor(origin),b=networkFor(destination);
 if(!a||!b)return 'unknown' as const;
 return a===b?'provider_required' as const:'disconnected' as const;
}
