/**
 * Calculate service pricing based on provider rate and admin commission
 *
 * Pricing Logic:
 * 1. Find providers who match the category requirements (skills, location)
 * 2. Get the provider's rate for this specific service (or base rate)
 * 3. Calculate admin commission based on category settings
 * 4. Total = Provider Rate + Admin Commission
 */

interface AdminCommission {
  type: 'fixed' | 'percentage' | 'hybrid';
  fixed?: number;
  percentage?: number;
  minCommission?: number;
  maxCommission?: number;
}

interface ProviderPricing {
  serviceCategoryId?: string;
  rate: number;
  minRate?: number;
  maxRate?: number;
}

interface ServiceProvider {
  id: string;
  baseRate: string;
  rateUnit: string;
  servicePricing: ProviderPricing[];
}

interface ServiceCategory {
  id: string;
  name?: string;
  priceRange?: {
    min?: number;
    max?: number;
    unit?: string;
  };
  adminCommission: AdminCommission;
}

interface PricingResult {
  providerRate: number;
  adminCommission: number;
  total: number;
  breakdown: string;
  providersInRange: number;
}

export function calculateServicePrice(
  providers: ServiceProvider[],
  category: ServiceCategory,
  requestedCity?: string
): PricingResult {
  // Get category price range as fallback
  const categoryMin = category.priceRange?.min ?? 0;
  const categoryMax = category.priceRange?.max ?? 0;
  const categoryAvg = categoryMin > 0 || categoryMax > 0 ? (categoryMin + categoryMax) / 2 : 0;

  // If no providers available, use category average
  if (!providers || providers.length === 0) {
    const adminCommission = calculateAdminCommission(categoryAvg, category.adminCommission);
    return {
      providerRate: categoryAvg,
      adminCommission,
      total: categoryAvg + adminCommission,
      breakdown: `Estimated price based on ${category.name} category range (${categoryMin} - ${categoryMax}${category.priceRange?.unit || ''})`,
      providersInRange: 0,
    };
  }

  // Get provider rates for this category
  const providerRates = providers.map((provider) => {
    // Check if provider has specific pricing for this category
    const specificPricing = provider.servicePricing?.find(
      (p) => p.serviceCategoryId === category.id
    );

    if (specificPricing) {
      // Use specific service pricing
      return {
        rate: specificPricing.rate,
        minRate: specificPricing.minRate ?? specificPricing.rate,
        maxRate: specificPricing.maxRate ?? specificPricing.rate,
      };
    }

    // Use provider's base rate
    const baseRate = parseFloat(provider.baseRate) || 0;
    return {
      rate: baseRate,
      minRate: baseRate,
      maxRate: baseRate,
    };
  });

  // Calculate average provider rate
  const avgProviderRate =
    providerRates.reduce((sum, r) => sum + r.rate, 0) / providerRates.length;

  const minProviderRate = Math.min(...providerRates.map((r) => r.minRate));
  const maxProviderRate = Math.max(...providerRates.map((r) => r.maxRate));

  // Calculate admin commission
  const adminCommission = calculateAdminCommission(avgProviderRate, category.adminCommission);

  const total = avgProviderRate + adminCommission;

  return {
    providerRate: avgProviderRate,
    adminCommission,
    total,
    breakdown: `Estimated price based on ${providerRates.length} provider(s) (₹${minProviderRate} - ₹${maxProviderRate}) + admin charges`,
    providersInRange: providerRates.length,
  };
}

function calculateAdminCommission(providerRate: number, commission: AdminCommission): number {
  let adminCharge = 0;

  switch (commission.type) {
    case 'percentage':
      adminCharge = (providerRate * (commission.percentage || 0)) / 100;
      // Apply min/max limits
      if (commission.minCommission && adminCharge < commission.minCommission) {
        adminCharge = commission.minCommission;
      }
      if (commission.maxCommission && adminCharge > commission.maxCommission) {
        adminCharge = commission.maxCommission;
      }
      break;

    case 'fixed':
      adminCharge = commission.fixed || 0;
      break;

    case 'hybrid':
      const fixedPart = commission.fixed || 0;
      const percentPart = commission.percentage
        ? (providerRate * commission.percentage) / 100
        : 0;
      adminCharge = fixedPart + percentPart;

      // Apply min/max limits
      if (commission.minCommission && adminCharge < commission.minCommission) {
        adminCharge = commission.minCommission;
      }
      if (commission.maxCommission && adminCharge > commission.maxCommission) {
        adminCharge = commission.maxCommission;
      }
      break;

    default:
      adminCharge = 0;
  }

  return adminCharge;
}
