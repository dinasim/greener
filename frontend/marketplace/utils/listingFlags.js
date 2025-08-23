/**
 * Derives boolean flags from a listing object to determine if it's a business or individual listing.
 * This helps standardize UI components that need to differentiate between seller types.
 * @param {object} listing - The listing object, expected to have a `seller` property.
 * @param {boolean} isBusinessParam - A hint from navigation params.
 * @returns {{isBusiness: boolean, isIndividual: boolean}}
 */
export const deriveListingFlags = (listing, isBusinessParam = false) => {
  if (!listing) {
    return { isBusiness: isBusinessParam, isIndividual: !isBusinessParam };
  }

  const seller = listing.seller || {};

  // A listing is from a business if any of these explicit flags are true.
  const isBusiness =
    isBusinessParam ||
    listing.isBusiness === true ||
    listing.isBusinessListing === true ||
    seller.isBusiness === true ||
    listing.sellerType === 'business';

  // A listing is from an individual if it's explicitly flagged or if it's not a business.
  const isIndividual =
    listing.isIndividual === true ||
    seller.isIndividual === true ||
    listing.sellerType === 'individual';

  // If business flag is set, it's a business. Otherwise, if individual flag is set, it's individual.
  // Default to individual if no flags are conclusive.
  if (isBusiness) {
    return { isBusiness: true, isIndividual: false };
  }
  if (isIndividual) {
    return { isBusiness: false, isIndividual: true };
  }

  // Fallback based on param or assume individual
  return { isBusiness: isBusinessParam, isIndividual: !isBusinessParam };
};
