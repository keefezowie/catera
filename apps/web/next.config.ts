import path from 'node:path';
import type {NextConfig} from 'next';
const root=path.resolve(process.cwd(),'../..');
const config:NextConfig={poweredByHeader:false,devIndicators:false,transpilePackages:['@catera/domain','@catera/api-client','@catera/design-tokens','@catera/backend'],serverExternalPackages:['@electric-sql/pglite'],turbopack:{root},outputFileTracingRoot:root,outputFileTracingIncludes:{'/*':['../../supabase/migrations/*.sql','../../packages/backend/src/*.sql']},async headers(){return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}]}]}};
export default config;
