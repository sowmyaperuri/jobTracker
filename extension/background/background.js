/**
 * JobTrack Extension Background Service Worker (Manifest V3)
 * Manages chrome.storage.local and syncs saved applications to Node.js/Express API + MongoDB.
 */

// Initialize storage schema on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['jobApplications'], (result) => {
    if (!result.jobApplications) {
      chrome.storage.local.set({ jobApplications: [] }, () => {
        console.log('[JobTrack] Initialized jobApplications local storage.');
      });
    }
  });
});

// Centralized message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SAVE_JOB_APPLICATION') {
    saveJobApplication(request.payload)
      .then((savedJob) => sendResponse({ success: true, data: savedJob }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'GET_ALL_JOBS') {
    getAllJobs()
      .then((jobs) => sendResponse({ success: true, data: jobs }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Saves job application locally & syncs to Node.js / Express REST API (MongoDB)
 */
async function saveJobApplication(jobData) {
  // 1. Always save to chrome.storage.local first (Fast local storage & offline safety)
  const localSavedJob = await saveToLocalStorage(jobData);

  // 2. Try syncing to Node.js + Express Backend (http://localhost:5000/api/applications)
  try {
    const response = await fetch('http://localhost:5000/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jobData)
    });

    if (response.ok) {
      const apiResult = await response.json();
      console.log('[JobTrack] Synced to MongoDB via Express API:', apiResult);
    } else {
      console.warn('[JobTrack] API Sync non-200 status code:', response.status);
    }
  } catch (err) {
    console.warn('[JobTrack] Backend API unreachable at http://localhost:5000. Job saved in chrome.storage.local fallback.', err.message);
  }

  return localSavedJob;
}

/**
 * Helper: Persist into chrome.storage.local
 */
function saveToLocalStorage(jobData) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['jobApplications'], (result) => {
      const existing = result.jobApplications || [];
      const index = existing.findIndex(j => j.jobUrl === jobData.jobUrl);

      if (index >= 0) {
        existing[index] = { ...existing[index], ...jobData, updatedAt: new Date().toISOString() };
      } else {
        existing.unshift({ ...jobData, createdAt: new Date().toISOString() });
      }

      chrome.storage.local.set({ jobApplications: existing }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(jobData);
        }
      });
    });
  });
}

/**
 * Helper: Get all jobs (tries API first, falls back to local storage)
 */
async function getAllJobs() {
  try {
    const response = await fetch('http://localhost:5000/api/applications');
    if (response.ok) {
      const json = await response.json();
      return json.data || [];
    }
  } catch (err) {
    console.warn('[JobTrack] Fetching jobs from chrome.storage.local fallback...');
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(['jobApplications'], (res) => {
      resolve(res.jobApplications || []);
    });
  });
}
