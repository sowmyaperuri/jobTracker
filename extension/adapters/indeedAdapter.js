/**
 * JobTrack Site Adapter: Indeed Jobs
 * Targeted rules for extracting job details from Indeed job listings and search pages.
 */

export const indeedAdapter = {
  id: 'indeed',
  name: 'Indeed Jobs',

  /**
   * Evaluates if the current document matches Indeed job pages
   */
  matches(urlStr, doc) {
    return urlStr.includes('indeed.com/viewjob') || 
           urlStr.includes('indeed.com/jobs') ||
           urlStr.includes('indeed.com/m/viewjob');
  },

  /**
   * Executes targeted extraction for Indeed DOM structures
   */
  extract(doc, urlStr) {
    let title = '';
    let company = '';
    let location = '';
    let salary = '';
    let jobType = '';

    // 1. Job Title Selectors
    const titleSelectors = [
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1.jobsearch-JobInfoHeader-title',
      'h2.jobTitle',
      'h1'
    ];

    for (const sel of titleSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent.trim().length > 0) {
        title = el.textContent.replace('- job post', '').trim();
        break;
      }
    }

    // 2. Company Name Selectors
    const companySelectors = [
      '[data-testid="inlineHeader-companyName"]',
      '[data-company-name="true"]',
      'div.jobsearch-InlineCompanyRating-companyHeader a',
      '.jobsearch-CompanyReview--heading'
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
      '[data-testid="inlineHeader-companyLocation"]',
      'div.jobsearch-JobInfoHeader-companyLocation',
      '#jobLocationText'
    ];

    for (const sel of locationSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent.trim().length > 0) {
        location = el.textContent.trim();
        break;
      }
    }

    // 4. Salary & Job Type Selectors
    const salaryEl = doc.querySelector('#salaryInfoAndJobType, [data-testid="jobsearch-OtherJobDetailsContainer"]');
    if (salaryEl) {
      const text = salaryEl.textContent.trim();
      if (text.includes('$') || text.includes('a year') || text.includes('an hour')) {
        salary = text;
      }
    }

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
