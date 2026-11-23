export const activityCategories = Object.freeze([
  'registration', 'publication', 'guidance', 'organization', 'researcher', 'platform_content',
]);

export function activityIdentityKey({category, entityKey}) {
  if (!activityCategories.includes(category) || typeof entityKey !== 'string' ||
      !entityKey || entityKey.length > 512 || entityKey !== entityKey.trim() || /[\x00-\x1f\x7f]/.test(entityKey)) return null;
  return JSON.stringify([category, entityKey]);
}

export function registryActivityIdentity(registrationNumber) {
  if (typeof registrationNumber !== 'string' || !/^ChiCTR[0-9]+$/i.test(registrationNumber)) return null;
  return 'registry:chictr:' + registrationNumber.toUpperCase();
}
