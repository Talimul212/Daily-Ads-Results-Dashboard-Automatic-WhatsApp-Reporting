import "dotenv/config";

async function testCron() {
  console.log("Testing Cron / Background Daily Run directly...");
  const { GET } = await import("../src/app/api/cron/daily-report/route");

  const req = new Request("http://localhost:3000/api/cron/daily-report?secret=" + (process.env.CRON_SECRET || "sg_daily_ads_reporting_secret_key"), {
    method: "GET",
  });

  const res = await GET(req as any);
  const data = await res.json();

  console.log("\n=======================================================");
  console.log(`Cron Execution Complete (Duration: ${data.durationMs}ms)`);
  console.log(`Target Date: ${data.date}`);
  console.log(`Total Sync: ${data.syncSummary?.totalClients} clients (Succeeded: ${data.syncSummary?.succeeded})`);
  console.log(`WhatsApp Dispatches: Total ${data.dispatch?.total} | Sent: ${data.dispatch?.sent} | Pending Review: ${data.dispatch?.pendingApproval}`);
  console.log("=======================================================");

  for (const item of data.dispatch?.results || []) {
    console.log(`  -> ${item.clientName}: [${item.status}] ${item.mode ? `(Mode: ${item.mode})` : ""} ${item.error ? `Error: ${item.error}` : ""}`);
  }
}

testCron().catch(console.error);
