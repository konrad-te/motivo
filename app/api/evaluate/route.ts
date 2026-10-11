import { catalog } from '../../../lib/service.mjs';
import { runBaselineEvaluation } from '../../../lib/evaluation.mjs';
export async function POST(){return Response.json({version:'baseline-v1',results:runBaselineEvaluation(catalog)},{headers:{'Cache-Control':'no-store'}});}
