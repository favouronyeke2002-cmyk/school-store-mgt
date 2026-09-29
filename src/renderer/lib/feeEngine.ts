// ─── Registration Fee Engine ──────────────────────────────────────────────────
// Single source of truth for walk-in applicant registration pricing.
// Pricing is determined by the class's category_group (JUNIOR / SENIOR / REMEDIAL)
// and the student's residency status (Day / Boarding).

export type CategoryGroup = 'JUNIOR' | 'SENIOR' | 'REMEDIAL';
export const CATEGORY_GROUPS: CategoryGroup[] = ['JUNIOR', 'SENIOR', 'REMEDIAL'];

interface TierPricing {
  Day: number;
  Boarding: number;
  coaching?: number;
}

export const REGISTRATION_FEES: Record<CategoryGroup, TierPricing> = {
  JUNIOR:   { Day: 306_000, Boarding: 448_600, coaching: 10_000 },
  SENIOR:   { Day: 323_300, Boarding: 467_300, coaching: 10_000 },
  REMEDIAL: { Day: 350_500, Boarding: 503_100 },
};

export interface FeeBreakdown {
  categoryGroup: CategoryGroup | null;
  base: number;
  coachingCost: number;
  hasCoachingOption: boolean;
  warning: string | null;
}

export function getRegistrationFee(
  proposedClass: string,
  studentStatus: 'Day' | 'Boarding',
  classCategoryMap: Record<string, string>
): FeeBreakdown {
  const group = (classCategoryMap[proposedClass] || '') as CategoryGroup;
  const tier = REGISTRATION_FEES[group];

  if (!tier) {
    return {
      categoryGroup: null,
      base: 0,
      coachingCost: 0,
      hasCoachingOption: false,
      warning: 'Please assign a category group to this class in Admin Settings.',
    };
  }

  return {
    categoryGroup: group,
    base: tier[studentStatus],
    coachingCost: tier.coaching ?? 0,
    hasCoachingOption: !!tier.coaching,
    warning: null,
  };
}
