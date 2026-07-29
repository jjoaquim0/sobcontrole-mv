import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createEdgeGatewayHandler } from '../_shared/ai/bootstrap.ts';

// Alias temporário para clientes que ainda invocam o nome antigo. Toda a
// autenticação, governança, quota, auditoria e chamada de provider permanecem
// centralizadas no mesmo handler do ai-gateway.
Deno.serve(createEdgeGatewayHandler());
