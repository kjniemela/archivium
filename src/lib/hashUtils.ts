import crypto from 'crypto';

/************************************************************/
// Add any hashing utility functions below
/************************************************************/

/** @module hashUtils */

/**
 * Creates a hash using the sha256 algorithm. The salt is optional.
 * @param {string} data - The data to hash.
 * @param {string} [salt] - The salt to add to the data before hashing.
 * @returns {string} A string with the hashed value.
 */
export const createHash = (data: string, salt: string = ''): string => {
  const shasum = crypto.createHash('sha256');
  shasum.update(data + salt);
  return shasum.digest('hex');
};

/**
 * Compares a value and a salt with a previously hashed value.
 * @param {string} attempted - The attempted value.
 * @param {string} stored - The previous hash value.
 * @param {string} salt - The salt.
 * @returns {boolean} A boolean indicating if the attempted value
 * matches the stored value.
 */
export const compareHash = (attempted: string, stored: string, salt: string): boolean => {
  return stored === createHash(attempted, salt);
};

/**
 * Creates a random 32 byte string.
 * @returns {string} A random string.
 */
export const createRandom32String = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

