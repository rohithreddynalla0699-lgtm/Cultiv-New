// @ts-ignore: Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({ success: true }, 200);
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  return jsonResponse({
    success: false,
    code: "disabled_unauthenticated_order_creation",
    message: "Direct order creation is disabled. Use prepaid checkout confirmation or secure internal POS order creation.",
  }, 403);
});
