import { Temple } from '../models/index.js';

/**
 * Generates a clean URL slug from text.
 * @param {string} text 
 * @returns {string}
 */
export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-') // Replace spaces and special chars with a dash
    .replace(/^-+|-+$/g, ''); // Remove leading and trailing dashes
};

/**
 * Generates a unique slug for a Temple, appending the city or an incremental counter if duplicate.
 * @param {string} templeName 
 * @param {string} [city] 
 * @param {Object} [options]
 * @param {mongoose.ClientSession} [options.session]
 * @returns {Promise<string>}
 */
export const generateUniqueTempleSlug = async (templeName, city = '', options = {}) => {
  const baseName = city ? `${templeName}-${city}` : templeName;
  let candidateSlug = slugify(baseName);

  // If slugify results in empty string (e.g. non-ascii only), fallback to temple-timestamp
  if (!candidateSlug) {
    candidateSlug = `temple-${Date.now()}`;
  }

  const queryOptions = options.session ? { session: options.session } : {};
  let existing = await Temple.findOne({ slug: candidateSlug }, null, queryOptions);

  if (!existing) {
    return candidateSlug;
  }

  // If duplicate, append numerical suffix
  let counter = 1;
  while (existing) {
    const nextSlug = `${candidateSlug}-${counter}`;
    existing = await Temple.findOne({ slug: nextSlug }, null, queryOptions);
    if (!existing) {
      return nextSlug;
    }
    counter += 1;
  }

  return `${candidateSlug}-${counter}`;
};

export default {
  slugify,
  generateUniqueTempleSlug,
};
