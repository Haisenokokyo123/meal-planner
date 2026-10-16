import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "node:path";
export default defineConfig({base:"./",plugins:[react(),tailwind()],resolve:{alias:{"@":path.resolve(import.meta.dirname,"src"),"next/link":path.resolve(import.meta.dirname,"src/lib/router.tsx"),"next/navigation":path.resolve(import.meta.dirname,"src/lib/router.tsx")}},build:{outDir:"dist",sourcemap:false,rollupOptions:{output:{manualChunks(id){if(id.includes("node_modules/recharts"))return "charts";if(id.includes("node_modules/gsap"))return "gsap";}}}},server:{host:"127.0.0.1",proxy:{"/api":"http://127.0.0.1:3100"}}});
