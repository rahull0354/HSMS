import { db } from './src/db/index.js';
import { serviceRequests, serviceProviders, serviceCategories } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Update pricing for all existing "requested" status service requests
 * Uses the new pricing logic: Provider Rate + Admin Commission
 */

async function updatePricingForRequestedRequests() {
  try {
    console.log('🔄 Starting pricing update for existing requests...\n');

    // 1. Get all "requested" status requests
    const pendingRequests = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.status, 'requested'));

    console.log(`📋 Found ${pendingRequests.length} requests with status "requested"\n`);

    if (pendingRequests.length === 0) {
      console.log('✅ No requests to update. Exiting.');
      process.exit(0);
    }

    // 2. Get all categories (for admin commission)
    const allCategories = await db.select().from(serviceCategories);
    const categoryMap = new Map(allCategories.map(c => [c.id, c]));

    // 3. Get all active providers
    const allProviders = await db.select().from(serviceProviders)
      .where(eq(serviceProviders.isActive, true));

    console.log(`📁 Loaded ${allCategories.length} categories`);
    console.log(`👷 Loaded ${allProviders.length} active providers\n`);

    // 4. Process each request
    let updatedCount = 0;
    let skippedCount = 0;

    for (const request of pendingRequests) {
      console.log(`\nProcessing request: ${request.id}`);
      console.log(`  Title: ${request.serviceTitle}`);
      console.log(`  City: ${(request.serviceAddress as any).city}`);
      console.log(`  Old Price: ₹${request.estimatedPrice}`);

      try {
        const category = categoryMap.get(request.serviceCategoryId);
        if (!category) {
          console.log(`  ⚠️  Category not found. Skipping.`);
          skippedCount++;
          continue;
        }

        // Find matching providers
        const matchingProviders = findMatchingProviders(
          allProviders,
          category,
          (request.serviceAddress as any).city
        );

        console.log(`  Matched providers: ${matchingProviders.length}`);

        let providerRate = 0;
        let adminCommission = 0;
        let breakdown = '';

        if (matchingProviders.length > 0) {
          // Calculate average provider rate
          const providerRates = matchingProviders.map(provider => {
            const specificPricing = (provider.servicePricing as any)?.find(
              (p: any) => p.serviceCategoryId === category.id
            );

            if (specificPricing) {
              return {
                rate: specificPricing.rate,
                minRate: specificPricing.minRate ?? specificPricing.rate,
                maxRate: specificPricing.maxRate ?? specificPricing.rate,
              };
            }

            const baseRate = parseFloat(provider.baseRate as string) || 0;
            return {
              rate: baseRate,
              minRate: baseRate,
              maxRate: baseRate,
            };
          });

          const avgProviderRate = providerRates.reduce((sum, r) => sum + r.rate, 0) / providerRates.length;
          const minProviderRate = Math.min(...providerRates.map(r => r.minRate));
          const maxProviderRate = Math.max(...providerRates.map(r => r.maxRate));

          providerRate = avgProviderRate;
          adminCommission = calculateAdminCommission(avgProviderRate, category.adminCommission as any);
          breakdown = `Estimated price based on ${providerRates.length} provider(s) (₹${minProviderRate} - ₹${maxProviderRate}) + admin charges (₹${adminCommission})`;
        } else {
          // No providers, use category average
          const priceRange = (category.priceRange as any);
          const categoryMin = priceRange?.min ?? 0;
          const categoryMax = priceRange?.max ?? 0;
          const categoryAvg = categoryMin > 0 || categoryMax > 0 ? (categoryMin + categoryMax) / 2 : 0;

          providerRate = categoryAvg;
          adminCommission = calculateAdminCommission(categoryAvg, category.adminCommission as any);
          breakdown = `Estimated price based on ${category.name} category range (₹${categoryMin} - ₹${categoryMax}) + admin charges (₹${adminCommission})`;
        }

        const newTotalPrice = providerRate + adminCommission;

        console.log(`  Provider Rate: ₹${providerRate.toFixed(2)}`);
        console.log(`  Admin Commission: ₹${adminCommission.toFixed(2)}`);
        console.log(`  New Total: ₹${newTotalPrice.toFixed(2)}`);

        // 5. Update the request in database
        await db.update(serviceRequests)
          .set({
            estimatedPrice: newTotalPrice.toFixed(2),
            pricingDetails: {
              providerCharge: providerRate,
              adminCharge: adminCommission,
              subtotal: providerRate + adminCommission,
              total: newTotalPrice,
              commissionRate: adminCommission,
              commissionType: (category.adminCommission as any)?.type || 'fixed',
              additionalBreakdown: breakdown,
              updatedAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(serviceRequests.id, request.id));

        console.log(`  ✅ Updated successfully!`);
        updatedCount++;

      } catch (error) {
        console.error(`  ❌ Error updating request: ${error}`);
        skippedCount++;
      }
    }

    console.log(`\n\n${'='.repeat(60)}`);
    console.log(`📊 SUMMARY:`);
    console.log(`  Total requests processed: ${pendingRequests.length}`);
    console.log(`  ✅ Successfully updated: ${updatedCount}`);
    console.log(`  ⚠️  Skipped: ${skippedCount}`);
    console.log(`${'='.repeat(60)}\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

function findMatchingProviders(
  providers: any[],
  category: any,
  city: string
): any[] {
  return providers.filter(provider => {
    // Check skills match
    if (!provider.skills || provider.skills.length === 0) return false;
    if (!category.requiredSkills || category.requiredSkills.length === 0) return false;

    const providerSkillsLower = provider.skills.map((s: string) => s.toLowerCase());
    const categorySkillsLower = category.requiredSkills.map((s: string) => s.toLowerCase());

    const hasMatchingSkill = providerSkillsLower.some((skill: string) =>
      categorySkillsLower.includes(skill)
    );

    if (!hasMatchingSkill) return false;

    // Check service area
    if (!provider.serviceArea || provider.serviceArea.length === 0) return false;

    const providerCities = (provider.serviceArea as any[])
      .map((area: any) => area.city?.toLowerCase())
      .filter(Boolean);

    return providerCities.includes(city.toLowerCase());
  });
}

function calculateAdminCommission(providerRate: number, adminCommission: any): number {
  if (!adminCommission) return 0;

  const type = adminCommission.type || 'fixed';
  let adminCharge = 0;

  switch (type) {
    case 'percentage':
      adminCharge = (providerRate * (adminCommission.percentage || 0)) / 100;
      if (adminCommission.minCommission && adminCharge < adminCommission.minCommission) {
        adminCharge = adminCommission.minCommission;
      }
      if (adminCommission.maxCommission && adminCharge > adminCommission.maxCommission) {
        adminCharge = adminCommission.maxCommission;
      }
      break;

    case 'fixed':
      adminCharge = adminCommission.fixed || 0;
      break;

    case 'hybrid':
      const fixedPart = adminCommission.fixed || 0;
      const percentPart = adminCommission.percentage
        ? (providerRate * adminCommission.percentage) / 100
        : 0;
      adminCharge = fixedPart + percentPart;

      if (adminCommission.minCommission && adminCharge < adminCommission.minCommission) {
        adminCharge = adminCommission.minCommission;
      }
      if (adminCommission.maxCommission && adminCharge > adminCommission.maxCommission) {
        adminCharge = adminCommission.maxCommission;
      }
      break;

    default:
      adminCharge = 0;
  }

  return adminCharge;
}

// Run the update
updatePricingForRequestedRequests();
