import { catalog } from '../../../lib/service.mjs';
import { browseCatalog } from '../../../lib/recommendation.mjs';

export async function POST(request: Request) {
  try {
    const text=await request.text();
    if(text.length>10000) return Response.json({error:'Search is too large.'},{status:413});
    const body=JSON.parse(text);
    if(!body || typeof body!=='object' || !body.preferences || typeof body.preferences!=='object' || Array.isArray(body.preferences)) return Response.json({error:'Invalid search preferences.'},{status:400});
    return Response.json(browseCatalog(catalog,body.preferences,body.page,12),{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({error:'The listings could not be loaded. Please try again.'},{status:400});
  }
}
