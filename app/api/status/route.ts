import { env } from 'cloudflare:workers';
import { report } from '../../../lib/service.mjs';
import { getModelConfig } from '../../../lib/model-config.mjs';
export async function GET() {
  const values = env as unknown as Record<string,string>;
  const config = getModelConfig(values);
  return Response.json({mode:config.provider === 'catalog' ? 'catalog' : 'ai',provider:config.provider,model:config.model,report},{headers:{'Cache-Control':'no-store'}});
}
