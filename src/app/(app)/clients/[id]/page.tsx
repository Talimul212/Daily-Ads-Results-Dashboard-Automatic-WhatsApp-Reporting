"use client";

import { useParams } from "next/navigation";
import { AccountReport } from "@/components/AccountReport";

export default function ClientAccountPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AccountReport
      mode="internal"
      dataUrl={(start, end) => `/api/client/${id}?start=${start}&end=${end}`}
      campaignsUrl={(client, start, end) =>
        client.customerId ? `/api/ads-report?customerId=${client.customerId}&start=${start}&end=${end}` : null
      }
    />
  );
}
