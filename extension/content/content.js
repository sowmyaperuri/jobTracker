/**
 * JobTrack Content Script (4-Layer Progressive Extraction Engine)
 * Runs on the target web page to extract job details when requested by the extension popup.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_JOB_DETAILS') {
    try {
      const extractedData = runExtractionPipeline();
      sendResponse({ success: true, data: extractedData });
    } catch (err) {
      console.error('[JobTrack] Extraction pipeline runtime error:', err);
      sendResponse({ success: false, error: err.message });
    }
  }
  return true; // Keep message channel open for async response
});

/**
 * 4-Layer Progressive Extraction Pipeline
 */
function runExtractionPipeline() {
  const pageUrl = cleanUrl(window.location.href);

  const jobData = {
    jobTitle: '',
    companyName: '',
    location: '',
    salary: '',
    jobType: '',
    jobUrl: pageUrl,
    confidenceScores: {
      jobTitle: 0.0,
      companyName: 0.0,
      location: 0.0,
      salary: 0.0,
      jobUrl: 1.0
    }
  };

  // Layer 1: Standardized JSON-LD Metadata (Confidence ~95%)
  const jsonLd = extractJsonLd();
  if (jsonLd) {
    mergeJobData(jobData, jsonLd);
  }

  // Layer 2: Targeted Site Adapters (Confidence ~85-92%)
  if (jobData.confidenceScores.jobTitle < 0.85 || jobData.confidenceScores.companyName < 0.85) {
    const adapterData = runSiteAdapters(pageUrl);
    if (adapterData) {
      mergeJobData(jobData, adapterData);
    }
  }

  // Layer 3: Generic Meta Tags & Main-Container DOM Heuristics (Confidence ~50-90%)
  const metaHeuristicData = extractMetaAndHeuristics(jobData, pageUrl);
  mergeJobData(jobData, metaHeuristicData);

  return jobData;
}

/**
 * Merges source data into target job object only if source has higher confidence or fills a blank field.
 */
function mergeJobData(target, source) {
  if (!source) return;

  const fields = ['jobTitle', 'companyName', 'location', 'salary', 'jobType'];
  for (const field of fields) {
    const newScore = source.confidenceScores?.[field] || 0.0;
    const currentScore = target.confidenceScores?.[field] || 0.0;

    if (source[field] && (newScore > currentScore || !target[field])) {
      target[field] = source[field];
      target.confidenceScores[field] = newScore;
    }
  }
}

/**
 * Layer 1: JSON-LD Extractor
 */
function extractJsonLd() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent.trim());
      const jobNode = findJobPostingNode(data);

      if (jobNode) {
        const title = jobNode.title || jobNode.name || '';
        
        let company = '';
        if (typeof jobNode.hiringOrganization === 'string') {
          company = jobNode.hiringOrganization;
        } else if (jobNode.hiringOrganization && typeof jobNode.hiringOrganization === 'object') {
          company = jobNode.hiringOrganization.name || '';
        } else if (jobNode.publisher) {
          company = typeof jobNode.publisher === 'string' ? jobNode.publisher : (jobNode.publisher.name || '');
        }

        const location = parseJsonLdLocation(jobNode.jobLocation);
        const salary = parseJsonLdSalary(jobNode.baseSalary);
        const jobType = parseEmploymentType(jobNode.employmentType);

        return {
          jobTitle: title,
          companyName: company,
          location: location,
          salary: salary,
          jobType: jobType,
          description: jobNode.description ? cleanHtmlText(jobNode.description) : '',
          confidenceScores: {
            jobTitle: title ? 0.95 : 0.0,
            companyName: company ? 0.95 : 0.0,
            location: location ? 0.90 : 0.0,
            salary: salary ? 0.90 : 0.0,
            jobUrl: 1.0
          }
        };
      }
    } catch (e) {
      // Ignore JSON parse errors safely
    }
  }

  return null;
}

function findJobPostingNode(obj) {
  if (!obj || typeof obj !== 'object') return null;

  if (obj['@type'] === 'JobPosting' || (Array.isArray(obj['@type']) && obj['@type'].includes('JobPosting'))) {
    return obj;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findJobPostingNode(item);
      if (found) return found;
    }
  } else if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    return findJobPostingNode(obj['@graph']);
  }

  return null;
}

function parseJsonLdLocation(loc) {
  if (!loc) return '';
  if (typeof loc === 'string') return loc;

  if (Array.isArray(loc)) {
    return loc.map(parseJsonLdLocation).filter(Boolean).join(' / ');
  }

  const addr = loc.address;
  if (!addr) return loc.name || '';
  if (typeof addr === 'string') return addr;

  const parts = [
    addr.addressLocality,
    addr.addressRegion,
    addr.addressCountry
  ].filter(Boolean);

  return parts.join(', ');
}

function parseJsonLdSalary(salary) {
  if (!salary) return '';
  if (typeof salary === 'string' || typeof salary === 'number') return `${salary}`;

  const value = salary.value;
  const currency = salary.currency || '$';

  if (typeof value === 'object') {
    const min = value.minValue;
    const max = value.maxValue;
    const unit = value.unitText ? ` / ${value.unitText.toLowerCase()}` : '';
    if (min && max) return `${currency}${min} - ${currency}${max}${unit}`;
    if (min) return `${currency}${min}+${unit}`;
  } else if (value) {
    return `${currency}${value}`;
  }

  return '';
}

function parseEmploymentType(type) {
  if (!type) return '';
  const val = Array.isArray(type) ? type[0] : type;
  if (typeof val !== 'string') return '';

  const clean = val.toUpperCase();
  if (clean.includes('FULL')) return 'Full-Time';
  if (clean.includes('PART')) return 'Part-Time';
  if (clean.includes('CONTRACT')) return 'Contract';
  if (clean.includes('INTERN')) return 'Internship';
  return val;
}

/**
 * Layer 2: Targeted Site Adapters
 */
function runSiteAdapters(urlStr) {
  // 1. LinkedIn Jobs Adapter
  if (urlStr.includes('linkedin.com')) {
    let title = queryFirst([
      'h1.job-details-jobs-unified-top-card__job-title', 
      '.jobs-unified-top-card__job-title', 
      'h1.top-card-layout__title', 
      '.jobs-details__main-content h1', 
      '.job-details-jobs-unified-top-card__content--two-pane h1',
      'h1'
    ]);

    let company = queryFirst([
      '.job-details-jobs-unified-top-card__company-name a', 
      '.job-details-jobs-unified-top-card__primary-description a', 
      '.jobs-unified-top-card__company-name', 
      'a.topcard__org-name-link'
    ]);

    let location = queryFirst([
      '.job-details-jobs-unified-top-card__primary-description > span:nth-child(2)', 
      '.jobs-unified-top-card__bullet', 
      'span.topcard__flavor--bullet'
    ]);

    try {
      const urlObj = new URL(urlStr);
      const urlCompany = urlObj.searchParams.get('companyName');
      if (urlCompany && !company) {
        company = urlCompany.trim();
      }
    } catch (e) {}

    const modalHeader = queryFirst(['.jobs-easy-apply-modal h2', '[role="dialog"] h2', '#jobs-apply-header']);
    if (modalHeader && modalHeader.toLowerCase().includes('apply to')) {
      const extractedCompany = modalHeader.replace(/apply to/i, '').trim();
      if (extractedCompany && !company) {
        company = extractedCompany;
      }
    }

    if (document.title && document.title.includes('|')) {
      const titleParts = document.title.split('|').map(s => s.trim());
      if (titleParts.length >= 2) {
        if (!title) title = titleParts[0];
        if (!company && !titleParts[1].toLowerCase().includes('linkedin')) {
          company = titleParts[1];
        }
      }
    }

    if (title || company) {
      return {
        jobTitle: title,
        companyName: company,
        location: location,
        confidenceScores: {
          jobTitle: title ? 0.90 : 0.0,
          companyName: company ? 0.90 : 0.0,
          location: location ? 0.85 : 0.0,
          jobUrl: 1.0
        }
      };
    }
  }

  // 2. Indeed Jobs Adapter
  if (urlStr.includes('indeed.com')) {
    const title = queryFirst(['[data-testid="jobsearch-JobInfoHeader-title"]', 'h1.jobsearch-JobInfoHeader-title', 'h1']);
    const company = queryFirst(['[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]', 'div.jobsearch-InlineCompanyRating-companyHeader a']);
    const location = queryFirst(['[data-testid="inlineHeader-companyLocation"]', 'div.jobsearch-JobInfoHeader-companyLocation']);

    if (title || company) {
      return {
        jobTitle: title ? title.replace('- job post', '').trim() : '',
        companyName: company,
        location: location,
        confidenceScores: {
          jobTitle: title ? 0.88 : 0.0,
          companyName: company ? 0.88 : 0.0,
          location: location ? 0.85 : 0.0,
          jobUrl: 1.0
        }
      };
    }
  }

  return null;
}

function queryFirst(selectors) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 0) {
        return el.textContent.trim();
      }
    } catch (e) {
      // Ignore query errors safely
    }
  }
  return '';
}

/**
 * Layer 3: Main-Container Scoped Heuristics & Right-to-Left Domain Parsing
 */
function extractMetaAndHeuristics(currentJobData, pageUrl) {
  const result = {
    jobTitle: '',
    companyName: '',
    location: '',
    salary: '',
    confidenceScores: {
      jobTitle: 0.0,
      companyName: 0.0,
      location: 0.0,
      salary: 0.0,
      jobUrl: 1.0
    }
  };

  // 1. Scoped Main-Content Title Extraction
  if (!currentJobData.jobTitle || currentJobData.confidenceScores.jobTitle < 0.85) {
    const mainTitle = extractMainContentTitle();
    if (mainTitle) {
      result.jobTitle = cleanJobTitle(mainTitle);
      result.confidenceScores.jobTitle = 0.85;
    } else {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
      const docTitle = document.title;

      if (ogTitle && isGoodTitle(ogTitle)) {
        result.jobTitle = cleanJobTitle(ogTitle);
        result.confidenceScores.jobTitle = 0.70;
      } else if (docTitle && isGoodTitle(docTitle)) {
        result.jobTitle = cleanJobTitle(docTitle);
        result.confidenceScores.jobTitle = 0.60;
      }
    }
  }

  // 2. Company Name Extraction (Prioritize Clean Right-to-Left Domain Parser)
  if (!currentJobData.companyName || currentJobData.confidenceScores.companyName < 0.75) {
    const domainCompany = extractCompanyFromDomain(pageUrl);
    const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.content;
    const metaPublisher = document.querySelector('meta[name="publisher"]')?.content;

    // Validate ogSiteName is not a developer placeholder variable
    if (domainCompany) {
      result.companyName = domainCompany;
      result.confidenceScores.companyName = 0.85;
    } else if (ogSiteName && isValidSiteName(ogSiteName)) {
      result.companyName = ogSiteName;
      result.confidenceScores.companyName = 0.75;
    } else if (metaPublisher && isValidSiteName(metaPublisher)) {
      result.companyName = metaPublisher;
      result.confidenceScores.companyName = 0.70;
    }
  }

  // 3. Extract Location from Page Text or Subtitles
  if (!currentJobData.location || currentJobData.confidenceScores.location < 0.5) {
    const bodyText = document.body?.innerText || '';
    const locMatch = bodyText.match(/\b(HYDERABAD|BANGALORE|BENGALURU|MUMBAI|PUNE|DELHI|GURUGRAM|NOIDA|CHENNAI|SAN FRANCISCO|NEW YORK|LONDON|AUSTIN|SEATTLE|REMOTE|HYBRID|ON-SITE|ONSITE)\b/i);
    if (locMatch) {
      result.location = formatLocationString(locMatch[0]);
      result.confidenceScores.location = 0.65;
    }
  }

  return result;
}

function extractMainContentTitle() {
  const detailContainers = document.querySelectorAll(
    'main, [role="main"], [class*="detail" i], [class*="job-desc" i], [class*="jobdesc" i], [id*="jobdesc" i], [class*="right-pane" i], [class*="content-pane" i], .hero-content, .job-header'
  );

  for (const container of detailContainers) {
    if (isSidebarOrNav(container)) continue;

    const headings = container.querySelectorAll('h1, h2, [class*="title" i], [class*="jobTitle" i]');
    for (const h of headings) {
      if (isSidebarOrNav(h)) continue;
      const text = h.textContent?.trim();
      if (isGoodTitle(text)) {
        return text;
      }
    }
  }

  const allHeadings = document.querySelectorAll('h1, h2, [class*="jobTitle" i], [class*="title" i]');
  for (const h of allHeadings) {
    if (isSidebarOrNav(h)) continue;
    const text = h.textContent?.trim();
    if (isGoodTitle(text)) {
      return text;
    }
  }

  return '';
}

function isSidebarOrNav(el) {
  if (!el || !el.closest) return false;
  const parent = el.closest('aside, nav, [class*="sidebar" i], [class*="left-pane" i], [class*="job-list" i], [class*="search-result" i], [id*="sidebar" i], [id*="list" i], [class*="step" i], [class*="wizard" i]');
  return !!parent;
}

/**
 * Validates candidate job title string (filters out form wizard step headers & generic site text)
 */
function isGoodTitle(text) {
  if (!text) return false;
  const clean = text.trim();
  if (clean.length < 3 || clean.length > 100) return false;
  
  const blackList = [
    'Educational Requirements', 'Service Line', 'Responsibilities', 'Qualifications', 
    'About Us', 'Jobs', 'Careers', 'Search', 'Back to jobs search', 'Find Jobs', 
    'Sign In', 'Register', 'Select your resume', 'Select Resume', 'My Information', 
    'My Experience', 'Application Questions', 'Voluntary Disclosures', 'Review', 
    'First time here?', 'Already registered?', 'Choose a method', 'Applying to'
  ];

  for (const item of blackList) {
    if (clean.toLowerCase() === item.toLowerCase() || clean.toLowerCase().startsWith(item.toLowerCase())) {
      return false;
    }
  }

  return true;
}

/**
 * Filter out developer placeholder meta tags (e.g. MetaOgSite_nameApplicationMethods)
 */
function isValidSiteName(name) {
  if (!name || name.length > 50) return false;
  if (name.match(/MetaOg|ApplicationMethods|Site_name|Template|Undefined|Null/i)) {
    return false;
  }
  return true;
}

function cleanUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'gh_jid', 'sourceId'].forEach(param => url.searchParams.delete(param));
    return url.toString();
  } catch (e) {
    return urlStr;
  }
}

function cleanJobTitle(title) {
  if (!title) return '';
  return title
    .replace(/\s*[\-\|•]\s*(Careers|Move Forward|Take the World|Jobs|Job Board|Workday|Greenhouse|Lever).*$/i, '')
    .replace(/^([A-Z\s]+,\s*[A-Z\s]+\s*[\-\|•]\s*)?/i, '')
    .trim();
}

/**
 * Right-to-Left Domain Parsing Algorithm
 */
function extractCompanyFromDomain(urlStr) {
  try {
    const urlObj = new URL(urlStr);
    let hostname = urlObj.hostname.toLowerCase().replace('www.', '');
    const path = urlObj.pathname;
    const parts = hostname.split('.');

    const atsPlatforms = ['greenhouse', 'lever', 'workday', 'myworkdayjobs', 'smartrecruiters', 'icims', 'taleo', 'ashbyhq', 'bamboohr'];

    const pathParts = path.split('/').filter(Boolean);
    for (const ats of atsPlatforms) {
      if (hostname.includes(ats)) {
        if (pathParts.length > 0 && !['job', 'jobs', 'careers', 'viewjob'].includes(pathParts[0].toLowerCase())) {
          return formatCompanyName(pathParts[0]);
        }
        if (parts.length > 2) {
          return formatCompanyName(parts[0]);
        }
      }
    }

    const tldList = ['com', 'org', 'net', 'co', 'io', 'in', 'us', 'uk', 'de', 'fr', 'ca', 'au', 'ai', 'app', 'dev'];
    let domainSegments = parts.filter(p => !tldList.includes(p));

    if (domainSegments.length > 0) {
      let targetSegment = domainSegments[domainSegments.length - 1];
      // Strip trailing 'careers' or 'jobs' from domain (e.g. metlifecareers -> metlife)
      targetSegment = targetSegment.replace(/(careers|career|jobs|job)$/i, '');
      return formatCompanyName(targetSegment);
    }

    return formatCompanyName(parts[0]);
  } catch (e) {
    return '';
  }
}

function formatCompanyName(name) {
  if (!name) return '';
  const clean = name.replace(/[-_]/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function formatLocationString(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function cleanHtmlText(htmlStr) {
  if (!htmlStr) return '';
  return htmlStr.replace(/<[^>]*>?/gm, '').trim();
}
