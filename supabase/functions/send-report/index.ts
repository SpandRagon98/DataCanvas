// Supabase Edge Function — scheduled-report sender
// Deploy: supabase functions deploy send-report
// Trigger: set up a pg_cron job or Supabase scheduled function
//
// Required secrets (set with: supabase secrets set KEY=value):
//   RESEND_API_KEY   — https://resend.com API key for email delivery
//   SITE_URL         — public URL of your DataCanvas deployment

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SITE_URL       = Deno.env.get("SITE_URL") ?? "https://your-datacanvas.vercel.app";

  const now = new Date().toISOString();

  // Fetch all enabled reports due to run
  const { data: reports } = await supabase
    .from("scheduled_reports")
    .select("*, workbooks(name, data)")
    .eq("enabled", true)
    .lte("next_run", now);

  if (!reports?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;

  for (const report of reports) {
    try {
      const dashboardUrl = `${SITE_URL}/#/dashboard?workbook=${report.workbook_id}&share=1`;

      const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family:Inter,sans-serif;background:#0e0e10;color:#e4e4e7;padding:32px;max-width:600px;margin:0 auto">
          <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
              <div style="background:#f59e0b;border-radius:8px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px">📊</div>
              <div>
                <div style="font-size:16px;font-weight:700;color:#fafafa">Scheduled Report</div>
                <div style="font-size:12px;color:#71717a">${report.workbooks?.name ?? "DataCanvas Workbook"}</div>
              </div>
            </div>
            <h2 style="font-size:18px;font-weight:600;color:#fafafa;margin:0 0 8px">${report.name}</h2>
            <p style="color:#a1a1aa;font-size:14px;margin:0 0 20px">
              Your scheduled <strong style="color:#f59e0b">${report.frequency}</strong> report is ready.
              Click the button below to view the live dashboard.
            </p>
            <a href="${dashboardUrl}"
               style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">
              View Dashboard →
            </a>
            <hr style="border-color:#27272a;margin:24px 0">
            <p style="font-size:11px;color:#52525b;margin:0">
              Sent by DataCanvas · <a href="${SITE_URL}" style="color:#71717a">Manage reports</a>
            </p>
          </div>
        </body>
        </html>
      `;

      // Send via Resend
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "DataCanvas <reports@your-domain.com>",
            to: report.recipients,
            subject: `[DataCanvas] ${report.name} — ${new Date().toLocaleDateString()}`,
            html,
          }),
        });
      }

      // Compute next_run
      const next = new Date();
      if (report.frequency === "daily")   next.setDate(next.getDate() + 1);
      if (report.frequency === "weekly")  next.setDate(next.getDate() + 7);
      if (report.frequency === "monthly") next.setMonth(next.getMonth() + 1);

      await supabase.from("scheduled_reports").update({
        last_run: now,
        next_run: next.toISOString(),
      }).eq("id", report.id);

      sent++;
    } catch (err) {
      console.error(`Failed report ${report.id}:`, err);
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
