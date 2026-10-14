/**
 * JobTrack Multi-Layer Extraction Engine Core
 * Extracts job information using JSON-LD, OpenGraph, Meta tags, and Semantic HTML heuristics.
 */

import { createDefaultJobApplication } from './schema.js';

/**
 * Main Extraction Entry Point
 * @param {Document} doc - The DOM document object of the job page
 * @param {string} pageUrl - The URL of the job page
 * @returns {Object} Normalized JobApplication object with confidence scores
 */
export function extractJobDetails(doc = document, pageUrl = window.location.href) {
  // Layer 1: Check for JSON-LD Structured Data
  const jsonLdData = extractJsonLd(doc);
  if (jsonLdData && jsonLdData.jobTitle && jsonLdData.companyName) {
    return createDefaultJobApplication({
      ...jsonLdData,
      jobUrl: cleanUrl(pageUrl)
    });
  }

  // Layer 2 & 3: Fall back to Meta tags, OpenGraph & Semantic HTML heuristics
  const metaData = extractMetaAndHeuristics(doc, pageUrl, jsonLdData);
  
  return createDefaultJobApplication({
    ...metaData,
    jobUrl: cleanUrl(pageUrl)
  });
}

/**
 * Layer 1: JSON-LD Extractor
 */
function extractJsonLd(doc) {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent.trim());
      const jobNode = findJobPostingNode(data);

      if (jobNode) {
        const title = jobNode.title || jobNode.name || '';
        const company = jobNode.hiringOrganization?.name || jobNode.publisher?.name || '';
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
      // Ignore invalid JSON-LD blocks safely
    }
  }

  return null;
}

/**
 * Recursively find node with @type: "JobPosting"
 */
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
  } else {
    if (obj['@graph'] && Array.isArray(obj['@graph'])) {
      return findJobPostingNode(obj['@graph']);
    }
  }

  return null;
}

/**
 * Parse location object from JSON-LD
 */
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

/**
 * Parse salary object from JSON-LD
 */
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

/**
 * Normalize employment type codes
 */
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
 * Layer 2 & 3: OpenGraph, Meta Tags & Heuristics
 */
function extractMetaAndHeuristics(doc, pageUrl, partialJsonLd) {
  const result = {
    jobTitle: partialJsonLd?.jobTitle || '',
    companyName: partialJsonLd?.companyName || '',
    location: partialJsonLd?.location || '',
    salary: partialJsonLd?.salary || '',
    confidenceScores: {
      jobTitle: partialJsonLd?.confidenceScores?.jobTitle || 0.0,
      companyName: partialJsonLd?.confidenceScores?.companyName || 0.0,
      location: partialJsonLd?.confidenceScores?.location || 0.0,
      salary: partialJsonLd?.confidenceScores?.salary || 0.0,
      jobUrl: 1.0
    }
  };

  // 1. Extract Job Title from <h1> or OpenGraph title
  if (!result.jobTitle) {
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.content;
    const h1Text = doc.querySelector('h1')?.textContent?.trim();
    const docTitle = doc.title;

    if (h1Text && h1Text.length < 100) {
      result.jobTitle = cleanJobTitle(h1Text);
      result.confidenceScores.jobTitle = 0.75;
    } else if (ogTitle) {
      result.jobTitle = cleanJobTitle(ogTitle);
      result.confidenceScores.jobTitle = 0.70;
    } else if (docTitle) {
      result.jobTitle = cleanJobTitle(docTitle);
      result.confidenceScores.jobTitle = 0.50;
    }
  }

  // 2. Extract Company Name from OpenGraph or Domain Name
  if (!result.companyName) {
    const ogSiteName = doc.querySelector('meta[property="og:site_name"]')?.content;
    const metaPublisher = doc.querySelector('meta[name="publisher"]')?.content;

    if (ogSiteName) {
      result.companyName = ogSiteName;
      result.confidenceScores.companyName = 0.75;
    } else if (metaPublisher) {
      result.companyName = metaPublisher;
      result.confidenceScores.companyName = 0.70;
    } else {
      result.companyName = extractCompanyFromDomain(pageUrl);
      result.confidenceScores.companyName = 0.50;
    }
  }

  // 3. Heuristic Regex for Location & Salary in Page Text
  if (!result.location) {
    const bodyText = doc.body?.innerText || '';
    const locMatch = bodyText.match(/\b(Remote|Hybrid|On-site|Onsite|San Francisco|New York|London|Bengaluru|Bangalore|Austin|Seattle)\b/i);
    if (locMatch) {
      result.location = locMatch[0];
      result.confidenceScores.location = 0.50;
    }
  }

  return result;
}

/**
 * Clean URL (strip tracking parameters like utm_source)
 */
function cleanUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'gh_jid'].forEach(param => url.searchParams.delete(param));
    return url.toString();
  } catch (e) {
    return urlStr;
  }
}

/**
 * Clean Job Title strings (strip company trailing parts like "Sr Engineer - Google")
 */
function cleanJobTitle(title) {
  if (!title) return '';
  return title
    .replace(/\s*[\-\|•]\s*(Careers|Jobs|Job Board|Workday|Greenhouse|Lever).*$/i, '')
    .trim();
}

/**
 * Extract Company Name from Hostname (e.g. careers.stripe.com -> Stripe)
 */
function extractCompanyFromDomain(urlStr) {
  try {
    const hostname = new URL(urlStr).hostname.replace('www.', '');
    const parts = hostname.split('.');

    // Exclude generic job aggregators
    const aggregators = ['linkedin', 'indeed', 'glassdoor', 'naukri', 'monster', 'greenhouse', 'lever'];
    
    for (const part of parts) {
      if (!['com', 'org', 'net', 'co', 'io', 'careers', 'jobs', 'app'].includes(part.toLowerCase()) &&
          !aggregators.includes(part.toLowerCase())) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
    }

    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch (e) {
    return '';
  }
}

/**
 * Helper to strip HTML tags from raw strings
 */
function cleanHtmlText(htmlStr) {
  if (!htmlStr) return '';
  return htmlStr.replace(/<[^>]*>?/gm, '').trim();
}
