/**
 * JobTrack Extension Popup Controller
 * Manages Verification Gate UI interactions and saves user-verified data to background storage.
 */

import { createDefaultJobApplication, calculateOverallConfidence } from '../utils/schema.js';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('jobForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const toast = document.getElementById('toast');
  const confidenceBadge = document.getElementById('confidenceBadge');

  // Trigger Extraction on Active Tab
  try {
    const activeTab = await getActiveTab();
    if (activeTab && activeTab.id) {
      requestExtraction(activeTab);
    }
  } catch (err) {
    console.error('[JobTrack] Popup extraction startup error:', err);
    populateForm(createDefaultJobApplication({}));
  }

  /**
   * Send extraction request to active tab with programmatic script injection retry.
   * Note: "Could not establish connection" on first sendMessage is expected when
   * a tab was open before the extension was reloaded. We silently re-inject and retry.
   */
  function requestExtraction(activeTab) {
    chrome.tabs.sendMessage(activeTab.id, { action: 'EXTRACT_JOB_DETAILS' }, async (response) => {
      // Consume lastError silently to prevent Chrome flagging it in Extensions panel
      const connectionError = chrome.runtime.lastError;

      if (connectionError || !response?.data) {
        // Expected on tabs open before extension reload — re-inject content script
        console.log('[JobTrack] Re-injecting content script into active tab...');
        
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content/content.js']
          });

          chrome.tabs.sendMessage(activeTab.id, { action: 'EXTRACT_JOB_DETAILS' }, (retryResponse) => {
            // Consume any retry error silently too
            void chrome.runtime.lastError;

            if (retryResponse?.data) {
              populateForm(retryResponse.data);
            } else {
              console.log('[JobTrack] Retry could not extract — using URL-only fallback.');
              populateForm(createDefaultJobApplication({ jobUrl: activeTab.url || '' }));
            }
          });
        } catch (injectErr) {
          // chrome:// pages, PDF tabs, etc. cannot have scripts injected — that is fine
          console.log('[JobTrack] Script injection not allowed on this page type:', injectErr.message);
          populateForm(createDefaultJobApplication({ jobUrl: activeTab.url || '' }));
        }
      } else {
        populateForm(response.data);
      }
    });
  }

  // Handle Form Submission (Human Verification Complete)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      id: 'job_' + Date.now(),
      jobTitle: document.getElementById('jobTitle').value.trim(),
      companyName: document.getElementById('companyName').value.trim(),
      location: document.getElementById('location').value.trim(),
      salary: document.getElementById('salary').value.trim(),
      jobUrl: document.getElementById('jobUrl').value.trim(),
      appliedDate: document.getElementById('appliedDate').value || new Date().toISOString().split('T')[0],
      status: document.getElementById('status').value,
      jobType: document.getElementById('jobType').value,
      notes: document.getElementById('notes').value.trim()
    };

    chrome.runtime.sendMessage({ action: 'SAVE_JOB_APPLICATION', payload }, (res) => {
      if (res && res.success) {
        showToast('✅ Saved to JobTrack!');
        setTimeout(() => window.close(), 1200);
      } else {
        alert('Failed to save application: ' + (res?.error || 'Unknown error'));
      }
    });
  });

  cancelBtn.addEventListener('click', () => {
    window.close();
  });

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function populateForm(data) {
    document.getElementById('jobTitle').value = data.jobTitle || '';
    document.getElementById('companyName').value = data.companyName || '';
    document.getElementById('location').value = data.location || '';
    document.getElementById('salary').value = data.salary || '';
    document.getElementById('jobUrl').value = data.jobUrl || '';
    document.getElementById('appliedDate').value = data.appliedDate || new Date().toISOString().split('T')[0];
    if (data.jobType) document.getElementById('jobType').value = data.jobType;

    const scores = data.confidenceScores || {};
    const overallScore = calculateOverallConfidence(scores);

    confidenceBadge.textContent = `Confidence: ${Math.round(overallScore * 100)}%`;
    if (overallScore >= 0.85) {
      confidenceBadge.className = 'confidence-badge badge-high';
    } else if (overallScore >= 0.60) {
      confidenceBadge.className = 'confidence-badge badge-medium';
    } else {
      confidenceBadge.className = 'confidence-badge badge-low';
    }

    updateFieldBadge('titleBadge', scores.jobTitle);
    updateFieldBadge('companyBadge', scores.companyName);
    updateFieldBadge('locationBadge', scores.location);
    updateFieldBadge('salaryBadge', scores.salary);
  }

  function updateFieldBadge(elementId, score) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const val = score ? Math.round(score * 100) : 0;
    el.textContent = `${val}%`;
  }

  function showToast(msg) {
    toast.querySelector('span').textContent = msg;
    toast.classList.remove('hidden');
  }
});
