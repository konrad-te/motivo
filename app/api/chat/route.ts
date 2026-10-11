import { env } from 'cloudflare:workers';
import { chat } from '../../../lib/service.mjs';

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 40000) return Response.json({error:'Conversation is too large.'},{status:413});
    const text = await request.text();
    if (text.length > 40000) return Response.json({error:'Conversation is too large.'},{status:413});
    const body = JSON.parse(text);
    const values = env as unknown as Record<string,string>;
    const result = await chat(body, { apiKey:values.OPENAI_API_KEY || process.env.OPENAI_API_KEY, model:values.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-6.1-sol' });
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const e = error as {status?:number;message?:string};
    return Response.json({error:e.status===400 ? e.message : error instanceof SyntaxError ? 'Invalid request.' : 'The request could not be completed. Please try again.'},{status:e.status || (error instanceof SyntaxError ? 400 : 500)});
  }
}
