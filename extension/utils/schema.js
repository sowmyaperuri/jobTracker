/**
 * JobTrack Core Data Contract & Utility Helpers
 */

/**
 * Creates a normalized JobApplication object with standard defaults.
 */
export function createDefaultJobApplication(overrides = {}) {
  return {
    id: overrides.id || 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    jobTitle: overrides.jobTitle || '',
    companyName: overrides.companyName || '',
    location: overrides.location || '',
    jobUrl: overrides.jobUrl || window?.location?.href || '',
    salary: overrides.salary || '',
    jobType: overrides.jobType || '',
    status: overrides.status || 'Applied',
    appliedDate: overrides.appliedDate || new Date().toISOString().split('T')[0],
    description: overrides.description || '',
    notes: overrides.notes || '',
    confidenceScores: {
      jobTitle: overrides.confidenceScores?.jobTitle ?? 0.0,
      companyName: overrides.confidenceScores?.companyName ?? 0.0,
      location: overrides.confidenceScores?.location ?? 0.0,
      jobUrl: overrides.confidenceScores?.jobUrl ?? 1.0,
      salary: overrides.confidenceScores?.salary ?? 0.0
    }
  };
}

/**
 * Calculates overall record confidence score based on field weights.
 * @param {Object} confidenceScores - Map of field names to scores (0.0 to 1.0)
 * @returns {number} Weighted confidence score between 0.0 and 1.0
 */
export function calculateOverallConfidence(confidenceScores) {
  if (!confidenceScores) return 0.0;

  const weights = {
    jobTitle: 0.35,
    companyName: 0.35,
    location: 0.15,
    jobUrl: 0.15
  };

  let scoreSum = 0;
  let totalWeight = 0;

  for (const [field, weight] of Object.entries(weights)) {
    const fieldScore = confidenceScores[field] ?? 0.0;
    scoreSum += fieldScore * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Number((scoreSum / totalWeight).toFixed(2)) : 0.0;
}
