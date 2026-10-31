export interface HourlyMetricPoint {
  hour: number;
  clicks: number;
  impressions: number;
  cost: number; // in currency units (e.g. SGD)
  conversions: number;
}

export interface ServiceConversionSummary {
  [serviceLabel: string]: number;
}

export interface GoogleAdsDailyResult {
  date: string; // YYYY-MM-DD
  clicks: number;
  impressions: number;
  ctr: number; // e.g. 6.67 (%)
  avgCpc: number; // in SGD
  cost: number; // in SGD
  conversions: number;
  callConversions: number;
  whatsappConversions: number;
  otherConversions: number;
  perService: ServiceConversionSummary;
  hourlyMetrics: HourlyMetricPoint[];
  hasData: boolean;
  rawWarnings?: string[];
}

export interface ClientSyncConfig {
  id: string;
  name: string;
  customerId: string;
  loginCustomerId?: string | null;
  currency: string;
  timezone: string;
  campaignServiceMaps: {
    campaignNamePattern: string;
    serviceLabel: string;
  }[];
  conversionActionMaps: {
    conversionActionName: string;
    type: "CALL" | "WHATSAPP" | "OTHER";
  }[];
}
