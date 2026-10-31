import "dotenv/config";
import { syncDailyGoogleAdsMetrics } from "../src/lib/services/sync-service";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("Starting Daily Sync test for all clients...");
  const summary = await syncDailyGoogleAdsMetrics({
    useMockIfUnconfigured: true,
  });

  console.log("\n=======================================================");
  console.log(`Sync Completed for Date: ${summary.date}`);
  console.log(`Total Clients: ${summary.totalClients} | Succeeded: ${summary.succeeded} | Failed: ${summary.failed}`);
  console.log("=======================================================");

  for (const item of summary.items) {
    console.log(`\nClient: ${item.clientName} [${item.status}]`);
    if (item.metrics) {
      console.log(`  Conversions: ${item.metrics.conversions} (Calls: ${item.metrics.callConversions}, WA: ${item.metrics.whatsappConversions})`);
      console.log(`  Clicks: ${item.metrics.clicks} | CTR: ${item.metrics.ctr}% | Avg CPC: SGD ${item.metrics.avgCpc}`);
      console.log(`  Cost: SGD ${item.metrics.cost}`);
      console.log(`  Per Service:`, item.metrics.perService);
    } else if (item.error) {
      console.log(`  Error: ${item.error}`);
    }
  }

  // Check stored database records
  const dbMetrics = await prisma.dailyMetric.findMany({
    where: { date: summary.date },
    include: { client: true },
  });

  console.log(`\nVerified: ${dbMetrics.length} daily_metrics rows saved in the database!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
