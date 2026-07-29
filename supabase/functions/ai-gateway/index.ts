import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createEdgeGatewayHandler } from '../_shared/ai/bootstrap.ts';

Deno.serve(createEdgeGatewayHandler());
