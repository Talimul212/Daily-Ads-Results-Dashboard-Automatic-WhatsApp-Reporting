import "dotenv/config";
import { describeGoogleAdsError, getCustomerInstance, getGoogleAdsApiInstance } from "../src/lib/google-ads/client";

// Read-only connectivity check for the Google Ads credentials in .env.
// Usage: npm run diagnose:ads
async function main() {
  const api = getGoogleAdsApiInstance();
  if (!api) return console.log("Missing GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET");
  const mcc = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, "");

  console.log("1) Accounts this Google login can access ...");
  try {
    const res = await api.listAccessibleCustomers(process.env.GOOGLE_ADS_REFRESH_TOKEN!);
    console.log("   OK:", res.resource_names.join(", "));
  } catch (e: any) {
    return console.log("   FAILED:", describeGoogleAdsError(e));
  }

  if (!mcc) return console.log("No GOOGLE_ADS_LOGIN_CUSTOMER_ID set.");
  console.log(`2) Client accounts under MCC ${mcc} ...`);
  try {
    const rows = await getCustomerInstance({ customerId: mcc }).query(`
      SELECT customer_client.id, customer_client.descriptive_name,
             customer_client.manager, customer_client.test_account, customer_client.status
      FROM customer_client WHERE customer_client.level <= 1`);
    for (const r of rows as any[]) {
      const c = r.customer_client;
      console.log(`   ${c.id}  manager=${c.manager}  test=${c.test_account}  ${c.descriptive_name}`);
    }
  } catch (e: any) {
    console.log("   FAILED:", describeGoogleAdsError(e));
  }
}
main();
