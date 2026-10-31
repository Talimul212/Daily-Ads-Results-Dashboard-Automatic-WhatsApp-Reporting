import "dotenv/config";
import {
  fetchGoogleAdsDailyMetrics,
  generateMockDailyMetrics,
  getYesterdayDateInTimezone,
} from "../src/lib/google-ads/queries";
import { ClientSyncConfig } from "../src/lib/google-ads/types";

// 3 Sample clients matching Singapore local service businesses
const sampleClients: ClientSyncConfig[] = [
  {
    id: "test-client-1",
    name: "SG Fast Handyman Pro",
    customerId: process.env.TEST_CUSTOMER_ID_1 || "123-456-7890",
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    currency: "SGD",
    timezone: "Asia/Singapore",
    campaignServiceMaps: [
      { campaignNamePattern: "HMS|Handyman", serviceLabel: "HM" },
      { campaignNamePattern: "Drilling", serviceLabel: "Drilling" },
      { campaignNamePattern: "Plumbing", serviceLabel: "Plumbing" },
    ],
    conversionActionMaps: [
      { conversionActionName: "Call from Ads", type: "CALL" },
      { conversionActionName: "WhatsApp Click", type: "WHATSAPP" },
      { conversionActionName: "Website WhatsApp", type: "WHATSAPP" },
    ],
  },
  {
    id: "test-client-2",
    name: "Islandwide Plumbers SG",
    customerId: process.env.TEST_CUSTOMER_ID_2 || "234-567-8901",
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    currency: "SGD",
    timezone: "Asia/Singapore",
    campaignServiceMaps: [
      { campaignNamePattern: "Emergency", serviceLabel: "Emergency" },
      { campaignNamePattern: "General|Plumbing", serviceLabel: "Plumbing" },
    ],
    conversionActionMaps: [
      { conversionActionName: "Call", type: "CALL" },
      { conversionActionName: "WhatsApp", type: "WHATSAPP" },
    ],
  },
  {
    id: "test-client-3",
    name: "Premier Carpentry & Woodwork",
    customerId: process.env.TEST_CUSTOMER_ID_3 || "345-678-9012",
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    currency: "SGD",
    timezone: "Asia/Singapore",
    campaignServiceMaps: [
      { campaignNamePattern: "Wardrobe|Cabinet", serviceLabel: "Cabinet" },
      { campaignNamePattern: "Door|Repair", serviceLabel: "Door" },
    ],
    conversionActionMaps: [
      { conversionActionName: "Call Now", type: "CALL" },
      { conversionActionName: "WhatsApp Chat", type: "WHATSAPP" },
    ],
  },
];

async function runTest() {
  console.log(
    "=================================================================",
  );
  console.log(" Google Ads Daily Data Extraction Test");
  console.log(
    "=================================================================",
  );

  const targetDate =
    process.argv[2] || getYesterdayDateInTimezone("Asia/Singapore");
  console.log(`Target Date (Singapore Timezone): ${targetDate}`);

  const hasCredentials = Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN,
  );

  console.log(
    `API Status: ${
      hasCredentials
        ? "✓ Real Google Ads API Credentials Detected"
        : "! No API Credentials Detected (Running in Simulated Verification Mode)"
    }`,
  );
  console.log(
    "-----------------------------------------------------------------",
  );

  for (const client of sampleClients) {
    console.log(
      `\nTesting Client: [${client.name}] (CID: ${client.customerId})`,
    );

    try {
      let result;
      if (hasCredentials && process.env.TEST_CUSTOMER_ID_1) {
        console.log("-> Pulling live data via Google Ads API (GAQL)...");
        result = await fetchGoogleAdsDailyMetrics(client, targetDate);
      } else {
        console.log("-> Using deterministic test data generator...");
        result = generateMockDailyMetrics(client, targetDate);
      }

      console.log(`  ✓ Clicks:        ${result.clicks}`);
      console.log(`  ✓ Impressions:   ${result.impressions}`);
      console.log(`  ✓ CTR:           ${result.ctr}%`);
      console.log(`  ✓ Avg CPC:       ${client.currency} ${result.avgCpc}`);
      console.log(`  ✓ Total Cost:    ${client.currency} ${result.cost}`);
      console.log(
        `  ✓ Conversions:   ${result.conversions} (Calls: ${result.callConversions} | WhatsApp: ${result.whatsappConversions})`,
      );

      // Services
      const serviceEntries = Object.entries(result.perService);
      const serviceStr =
        serviceEntries.length > 0
          ? serviceEntries.map(([s, c]) => `${s} - ${c}`).join(" | ")
          : "None";
      console.log(`  ✓ Services:      ${serviceStr}`);

      // Hourly data check
      const hoursWithData = result.hourlyMetrics.filter(
        (h) => h.clicks > 0 || h.conversions > 0,
      );
      console.log(
        `  ✓ Hourly Graph:  ${result.hourlyMetrics.length} hourly bins generated (${hoursWithData.length} hours with activity)`,
      );

      // Check sample WhatsApp Caption output
      console.log("\n  [Generated WhatsApp Caption Preview]");
      console.log("  --------------------------------------");
      console.log(`  📅 ${result.date}`);
      console.log(`  Total Conversion = ${result.conversions}`);
      console.log(
        `  Call - ${result.callConversions} | WhatsApp - ${result.whatsappConversions}`,
      );
      console.log(`  Clicks - ${result.clicks}`);
      console.log(
        `  CTR - ${result.ctr}% | Avg CPC - ${client.currency} ${result.avgCpc}`,
      );
      console.log(`  Cost - ${client.currency} ${result.cost}`);
      if (serviceEntries.length > 0) {
        console.log(`  ${serviceStr}`);
      }
      console.log("  --------------------------------------");
    } catch (err: any) {
      console.error(`  ✗ Error querying client ${client.name}:`, err.message);
    }
  }

  console.log(
    "\n=================================================================",
  );
  console.log(" Phase 1 Test Complete!");
  console.log(
    "=================================================================",
  );
}

runTest().catch(console.error);
