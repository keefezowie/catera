import path from 'node:path';
import type {NextConfig} from 'next';
const root=path.resolve(process.cwd(),'../..');
const distDir=process.env.CATERA_NEXT_DIST_DIR || '.next';
// Scripts and styles are not restricted by the policy: Next's inline runtime and the CSS-variable theme would
// need per-request nonces first. The directives below close the gaps that need no nonce.
export const securityHeaders=[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
  {key:'Content-Security-Policy',value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"},
];
const config:NextConfig={distDir,poweredByHeader:false,devIndicators:false,transpilePackages:['@catera/domain','@catera/api-client','@catera/design-tokens','@catera/backend'],serverExternalPackages:['@electric-sql/pglite'],turbopack:{root},outputFileTracingRoot:root,outputFileTracingIncludes:{'/*':['../../supabase/migrations/*.sql','../../packages/backend/src/*.sql']},async headers(){return [{source:'/(.*)',headers:securityHeaders}]}};
export default config;
