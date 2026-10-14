/**
 * JobTrack Site Adapter: LinkedIn Jobs
 * Targeted rules for extracting job details from LinkedIn job listings and search pages.
 */

export const linkedinAdapter = {
  id: 'linkedin',
  name: 'LinkedIn Jobs',

  /**
   * Evaluates if the current document matches LinkedIn job pages
   */
  matches(urlStr, doc) {
    return urlStr.includes('linkedin.com/jobs/') || 
           urlStr.includes('linkedin.com/jobs/view/') ||
           urlStr.includes('linkedin.com/jobs/search/');
  },

  /**
   * Executes targeted extraction for LinkedIn DOM structures
   */
  extract(doc, urlStr) {
    let title = '';
    let company = '';
    let location = '';
    let salary = '';
    let jobType = '';

    // 1. Job Title Selectors (semantic & fallback class lists)
    const titleSelectors = [
      'h1.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'h1.top-card-layout__title',
      '.jobs-details__main-content h1',
      'h1'
    ];

    for (const sel of titleSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent.trim().length > 0) {
        title = el.textContent.trim();
        break;
      }
    }

    // 2. Company Name Selectors
    const companySelectors = [
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__primary-description a',
      '.jobs-unified-top-card__company-name',
      'a.topcard__org-name-link',
      '.jobs-details__main-content a[href*="/company/"]'
    ];

    for (const sel of companySelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent.trim().length > 0) {
        company = el.textContent.trim();
        break;
      }
    }

    // 3. Location Selectors
    const locationSelectors = [
      '.job-details-jobs-unified-top-card__primary-description > span:nth-child(2)',
      '.jobs-unified-top-card__bullet',
      'span.topcard__flavor--bullet',
      '.jobs-unified-top-card__workplace-type'
    ];

    for (const sel of locationSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent.trim().length > 0) {
        location = el.textContent.trim();
        break;
      }
    }

    // 4. Salary & Job Type Insights
    const insightElements = doc.querySelectorAll('.job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight');
    insightElements.forEach(el => {
      const text = el.textContent.trim();
      if (text.includes('$') || text.includes('€') || text.includes('£') || text.match(/\b\d{2,3}k\b/i)) {
        salary = text.split('·')[0].trim();
      }
      if (text.match(/\b(Full-time|Part-time|Contract|Internship)\b/i)) {
        jobType = text.match(/\b(Full-time|Part-time|Contract|Internship)\b/i)[0];
      }
    });

    return {
      jobTitle: title,
      companyName: company,
      location: location,
      salary: salary,
      jobType: jobType,
      confidenceScores: {
        jobTitle: title ? 0.88 : 0.0,
        companyName: company ? 0.88 : 0.0,
        location: location ? 0.85 : 0.0,
        salary: salary ? 0.80 : 0.0,
        jobUrl: 1.0
      }
    };
  }
};
