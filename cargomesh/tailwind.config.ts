import type { Config } from "tailwindcss";
export default { content:["./src/**/*.{ts,tsx}"], prefix:"cm-", corePlugins:{preflight:false}, theme:{extend:{colors:{ink:"#153c4d",teal:"#078b91",canvas:"#e6eef5",line:"#cbdde8",violet:"#8461c7"},boxShadow:{panel:"0 8px 24px #21435b0a"}}}, plugins:[] } satisfies Config;
