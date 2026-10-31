import { Customer, GoogleAdsApi, errors } from "google-ads-api";

export interface GoogleAdsCredentials {
  clientId?: string;
  clientSecret?: string;
}

const clean = (id?: string | null) => id?.replace(/[-\s]/g, "") || undefined;

// Developer tokens were sunset on 9 Sep 2026; access now follows the Google
// Cloud project that owns the OAuth client. google-ads-api@25 still always
// sends a `developer-token` header, and the API rejects an empty one with
// DEVELOPER_TOKEN_PARAMETER_MISSING. Drop the header when no token is set.
let headerPatched = false;
function patchDeveloperTokenHeader() {
  if (headerPatched) return;
  let proto = Customer.prototype;
  while (proto && !Object.getOwnPropertyDescriptor(proto, "callHeaders")) {
    proto = Object.getPrototypeOf(proto);
  }
  const original = proto && Object.getOwnPropertyDescriptor(proto, "callHeaders");
  if (original?.get) {
    Object.defineProperty(proto, "callHeaders", {
      configurable: true,
      get() {
        const headers = original.get!.call(this);
        if (!headers["developer-token"]) delete headers["developer-token"];
        return headers;
      },
    });
  }
  headerPatched = true;
}

export function getGoogleAdsApiInstance(overrides?: GoogleAdsCredentials) {
  const clientId = overrides?.clientId || process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret =
    overrides?.clientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  patchDeveloperTokenHeader();
  return new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
  });
}

export function getCustomerInstance(params: {
  customerId: string;
  loginCustomerId?: string | null;
  refreshToken?: string;
}) {
  const api = getGoogleAdsApiInstance();
  if (!api) {
    throw new Error(
      "Missing GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET.",
    );
  }

  const refreshToken =
    params.refreshToken || process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("Missing GOOGLE_ADS_REFRESH_TOKEN");

  return api.Customer({
    customer_id: clean(params.customerId)!,
    login_customer_id:
      clean(params.loginCustomerId) ??
      clean(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID),
    refresh_token: refreshToken,
  });
}

/**
 * Turn a google-ads-api failure into one actionable sentence.
 */
export function describeGoogleAdsError(error: any): string {
  const first = error?.errors?.[0];

  switch (errorCodeName(first?.error_code)) {
    case "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION":
      return "Your Google Cloud project only has Test access, so it can read test accounts only. Open Google Cloud Console → APIs & Services → Google Ads API → Upgrade access level and apply for Explorer (or Basic) access.";
    case "DEVELOPER_TOKEN_PARAMETER_MISSING":
      return "The API rejected an empty developer-token header. Update the google-ads-api client or keep the header patch in src/lib/google-ads/client.ts.";
    case "USER_PERMISSION_DENIED":
      return "The Google user behind the refresh token has no access to this account. Link the account under the MCC set in GOOGLE_ADS_LOGIN_CUSTOMER_ID, or fix that ID.";
    case "CUSTOMER_NOT_FOUND":
    case "INVALID_CUSTOMER_ID":
      return "That Customer ID was not found. Use the 10-digit sub-account ID shown at the top of Google Ads.";
    case "CUSTOMER_NOT_ENABLED":
      return "This Google Ads account is cancelled or not yet set up (no billing).";
  }
  return first?.message || error?.message || "Failed to fetch Google Ads data";
}

// error_code arrives as e.g. { authorization_error: 32 }; resolve the number
// through errors.AuthorizationErrorEnum.AuthorizationError.
function errorCodeName(errorCode?: Record<string, unknown>) {
  const [key, value] = Object.entries(errorCode ?? {})[0] ?? [];
  if (typeof value !== "number") return value as string | undefined;
  const pascal = key.replace(/(^|_)(\w)/g, (_, __, c: string) => c.toUpperCase());
  const enumType = (errors as any)[`${pascal}Enum`]?.[pascal];
  return enumType?.[value] as string | undefined;
}
