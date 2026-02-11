/**
 * Provider deduplication and normalization utilities
 */

// Known provider duplicate groups - prioritized left to right
// If multiple providers from the same group exist, only show the leftmost one
const PROVIDER_DUPLICATE_GROUPS = [
  ["Netflix", "Netflix Standard with Ads"],
  ["HBO Max", "HBO Max Amazon Channel", "HBO Max  Amazon Channel"],
  ["Apple TV", "Apple TV Amazon Channel"],
  ["Amazon Prime Video", "Amazon Prime Video with Ads"],
];

interface WatchProvider {
  providerId: number;
  providerName: string;
  logoPath?: string;
  displayPriority: number;
}

interface NormalizedProvider extends WatchProvider {
  normalizedName: string;
}

/**
 * Normalizes provider name by removing common suffixes and variations
 */
function normalizeProviderName(name: string): string {
  return name
    .replace(/\s+Standard(\s+with\s+Ads)?$/i, "")
    .replace(/\s+with\s+Ads$/i, "")
    .trim();
}

/**
 * Finds which duplicate group a provider belongs to (if any)
 */
function findDuplicateGroup(providerName: string): string[] | null {
  for (const group of PROVIDER_DUPLICATE_GROUPS) {
    if (group.some(name => name.toLowerCase() === providerName.toLowerCase())) {
      return group;
    }
  }
  return null;
}

/**
 * Deduplicates and normalizes a list of watch providers
 * Rules:
 * 1. For providers in known duplicate groups, only keep the highest priority (leftmost) one
 * 2. For other providers, normalize names and deduplicate by normalized name
 * 3. Maintain original display priority sorting
 */
export function deduplicateProviders(providers: WatchProvider[]): NormalizedProvider[] {
  if (!providers || providers.length === 0) return [];

  // Track which providers we've seen from each duplicate group
  const seenGroups = new Map<string[], string>();

  // Track normalized names we've seen (for non-grouped deduplication)
  const seenNormalizedNames = new Set<string>();

  const result: NormalizedProvider[] = [];

  for (const provider of providers) {
    const duplicateGroup = findDuplicateGroup(provider.providerName);

    // Handle known duplicate groups
    if (duplicateGroup) {
      const groupKey = duplicateGroup.join("|");
      const existingProvider = seenGroups.get(duplicateGroup);

      // If we haven't seen this group yet, add this provider
      if (!existingProvider) {
        seenGroups.set(duplicateGroup, provider.providerName);
        result.push({
          ...provider,
          normalizedName: normalizeProviderName(provider.providerName),
        });
      } else {
        // Check if this provider has higher priority (appears earlier in the group)
        const existingIndex = duplicateGroup.findIndex(
          name => name.toLowerCase() === existingProvider.toLowerCase()
        );
        const currentIndex = duplicateGroup.findIndex(
          name => name.toLowerCase() === provider.providerName.toLowerCase()
        );

        // Replace if this provider has higher priority
        if (currentIndex < existingIndex) {
          // Remove the old provider and add this one
          const oldProviderIndex = result.findIndex(
            p => p.providerName.toLowerCase() === existingProvider.toLowerCase()
          );
          if (oldProviderIndex !== -1) {
            result.splice(oldProviderIndex, 1);
          }
          seenGroups.set(duplicateGroup, provider.providerName);
          result.push({
            ...provider,
            normalizedName: normalizeProviderName(provider.providerName),
          });
        }
        // Otherwise skip this provider
      }
    } else {
      // Handle non-grouped providers with standard normalization
      const normalized = normalizeProviderName(provider.providerName);

      if (!seenNormalizedNames.has(normalized.toLowerCase())) {
        seenNormalizedNames.add(normalized.toLowerCase());
        result.push({
          ...provider,
          normalizedName: normalized,
        });
      }
    }
  }

  return result;
}
