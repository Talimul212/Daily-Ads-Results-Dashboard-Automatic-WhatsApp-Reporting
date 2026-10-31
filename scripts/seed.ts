import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding initial agency data for Digital Resolution...");

  // 1. Create default Admin & Specialist users
  const admin = await prisma.user.upsert({
    where: { email: "admin@digitalresolution.com" },
    update: {},
    create: {
      email: "admin@digitalresolution.com",
      name: "Admin",
      role: "ADMIN",
    },
  });

  const specialist1 = await prisma.user.upsert({
    where: { email: "kevin@digitalresolution.com" },
    update: {},
    create: {
      email: "kevin@digitalresolution.com",
      name: "Kevin Tan",
      role: "SPECIALIST",
    },
  });

  const specialist2 = await prisma.user.upsert({
    where: { email: "sarah@digitalresolution.com" },
    update: {},
    create: {
      email: "sarah@digitalresolution.com",
      name: "Sarah Lim",
      role: "SPECIALIST",
    },
  });

  // 2. Sample 5 local service clients
  const sampleClients = [
    {
      name: "SG Pro Handyman Services",
      specialistId: specialist1.id,
      specialistName: specialist1.name,
      timezone: "Asia/Singapore",
      currency: "SGD",
      highCpaThreshold: 45.0,
      requiresApproval: false,
      customerId: "782-192-3410",
      loginCustomerId: "991-234-5678",
      campaigns: [
        { pattern: "HMS|Handyman|Repair", label: "HM" },
        { pattern: "Drill|Drilling", label: "Drilling" },
        { pattern: "Furniture|Assembly", label: "Assembly" },
      ],
      conversions: [
        { name: "Call extension lead", type: "CALL" as const },
        { name: "Website Call button click", type: "CALL" as const },
        { name: "WhatsApp button click", type: "WHATSAPP" as const },
      ],
      whatsapp: {
        groupId: "120363029182746591@g.us",
        fallbackPhone: "+6591234567",
      },
    },
    {
      name: "QuickFix Plumbing Solutions",
      specialistId: specialist1.id,
      specialistName: specialist1.name,
      timezone: "Asia/Singapore",
      currency: "SGD",
      highCpaThreshold: 55.0,
      requiresApproval: false,
      customerId: "619-382-9012",
      loginCustomerId: "991-234-5678",
      campaigns: [
        { pattern: "Pipe|Burst|Leak", label: "Pipe Leak" },
        { pattern: "Heater|Water", label: "Heater" },
        { pattern: "Toilet|Choke", label: "Choke" },
      ],
      conversions: [
        { name: "Emergency Phone Call", type: "CALL" as const },
        { name: "WhatsApp Quote Request", type: "WHATSAPP" as const },
      ],
      whatsapp: {
        groupId: "120363029182746592@g.us",
        fallbackPhone: "+6592345678",
      },
    },
    {
      name: "Artisan Woodwork & Carpentry",
      specialistId: specialist2.id,
      specialistName: specialist2.name,
      timezone: "Asia/Singapore",
      currency: "SGD",
      highCpaThreshold: 70.0,
      requiresApproval: true,
      customerId: "412-581-7789",
      loginCustomerId: "991-234-5678",
      campaigns: [
        { pattern: "Wardrobe|Cabinet", label: "Cabinet" },
        { pattern: "Door|Frame", label: "Door" },
      ],
      conversions: [
        { name: "WhatsApp Consultation", type: "WHATSAPP" as const },
        { name: "Call Lead", type: "CALL" as const },
      ],
      whatsapp: {
        groupId: "120363029182746593@g.us",
        fallbackPhone: "+6593456789",
      },
    },
    {
      name: "SG Precision Auto Care",
      specialistId: specialist2.id,
      specialistName: specialist2.name,
      timezone: "Asia/Singapore",
      currency: "SGD",
      highCpaThreshold: 60.0,
      requiresApproval: false,
      customerId: "531-890-1122",
      loginCustomerId: "991-234-5678",
      campaigns: [
        { pattern: "Servicing|Oil", label: "Servicing" },
        { pattern: "Aircon|Flush", label: "Aircon" },
        { pattern: "Battery|Recovery", label: "Battery" },
      ],
      conversions: [
        { name: "Call Helpline", type: "CALL" as const },
        { name: "WhatsApp Appointment", type: "WHATSAPP" as const },
      ],
      whatsapp: {
        groupId: "120363029182746594@g.us",
        fallbackPhone: "+6594567890",
      },
    },
    {
      name: "LionCity Core Drilling Specialists",
      specialistId: specialist1.id,
      specialistName: specialist1.name,
      timezone: "Asia/Singapore",
      currency: "SGD",
      highCpaThreshold: 80.0,
      requiresApproval: false,
      customerId: "809-411-9988",
      loginCustomerId: "991-234-5678",
      campaigns: [
        { pattern: "Core Drilling", label: "Core Drill" },
        { pattern: "Wall Sawing", label: "Sawing" },
      ],
      conversions: [
        { name: "Inbound Call", type: "CALL" as const },
        { name: "WhatsApp Site Inspection", type: "WHATSAPP" as const },
      ],
      whatsapp: {
        groupId: "120363029182746595@g.us",
        fallbackPhone: "+6595678901",
      },
    },
  ];

  for (const c of sampleClients) {
    let client = await prisma.client.findFirst({
      where: { name: c.name },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: c.name,
          specialistId: c.specialistId,
          specialistName: c.specialistName,
          timezone: c.timezone,
          currency: c.currency,
          highCpaThreshold: c.highCpaThreshold,
          requiresApproval: c.requiresApproval,
        },
      });
    }

    // Google Ads Account
    const existingAccount = await prisma.googleAdsAccount.findFirst({
      where: { clientId: client.id },
    });
    if (!existingAccount) {
      await prisma.googleAdsAccount.create({
        data: {
          clientId: client.id,
          customerId: c.customerId,
          loginCustomerId: c.loginCustomerId,
          status: "ACTIVE",
        },
      });
    }

    // Campaign Service Maps
    for (const cmp of c.campaigns) {
      const existingMap = await prisma.campaignServiceMap.findFirst({
        where: { clientId: client.id, campaignNamePattern: cmp.pattern },
      });
      if (!existingMap) {
        await prisma.campaignServiceMap.create({
          data: {
            clientId: client.id,
            campaignNamePattern: cmp.pattern,
            serviceLabel: cmp.label,
          },
        });
      }
    }

    // Conversion Action Maps
    for (const conv of c.conversions) {
      const existingConv = await prisma.conversionActionMap.findFirst({
        where: { clientId: client.id, conversionActionName: conv.name },
      });
      if (!existingConv) {
        await prisma.conversionActionMap.create({
          data: {
            clientId: client.id,
            conversionActionName: conv.name,
            type: conv.type,
          },
        });
      }
    }

    // WhatsApp Group
    const existingWa = await prisma.whatsAppGroup.findFirst({
      where: { clientId: client.id },
    });
    if (!existingWa) {
      await prisma.whatsAppGroup.create({
        data: {
          clientId: client.id,
          groupId: c.whatsapp.groupId,
          fallbackPhone: c.whatsapp.fallbackPhone,
          status: "ACTIVE",
        },
      });
    }
  }

  console.log("✓ Initial agency clients and mapping seeded successfully!");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
