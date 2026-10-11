import { env } from 'cloudflare:workers';
import { report } from '../../../lib/service.mjs';
export async function GET() {
  const values = env as unknown as Record<string,string>;
  return Response.json({mode:values.OPENAI_API_KEY || process.env.OPENAI_API_KEY ? 'ai' : 'catalog',model:values.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-6.1-sol',report},{headers:{'Cache-Control':'no-store'}});
}
