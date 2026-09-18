import { AppState } from 'react-native';
import { getCurrentAnalyticsPath, trackEvent } from './analytics';

const CHECK_INTERVAL_MS = 250;
const STALL_THRESHOLD_MS = 150;
const REPORT_WINDOW_MS = 2000;

export const startUiStallMonitor = () => {
  let interval: ReturnType<typeof setInterval> | null = null;
  let reportTimer: ReturnType<typeof setTimeout> | null = null;
  let expectedAt = 0;
  let largestStall = 0;
  let appState = AppState.currentState;
  let foregroundAt = Date.now();

  const stopChecks = () => {
    if (interval) clearInterval(interval);
    interval = null;
    expectedAt = 0;
  };

  const report = () => {
    reportTimer = null;
    const stallMs = largestStall;
    largestStall = 0;
    if (!stallMs || appState !== 'active') return;
    try {
      void trackEvent('ui_stall', {
        stall_ms: stallMs,
        path: getCurrentAnalyticsPath(),
        app_state: appState,
        since_foreground_ms: Date.now() - foregroundAt,
      });
    } catch {}
  };

  const checkForStall = () => {
    try {
      const now = Date.now();
      const lateBy = now - expectedAt;
      expectedAt = now + CHECK_INTERVAL_MS;
      if (lateBy <= STALL_THRESHOLD_MS) return;
      largestStall = Math.max(largestStall, lateBy);
      if (!reportTimer) reportTimer = setTimeout(report, REPORT_WINDOW_MS);
    } catch {}
  };

  const startChecks = () => {
    if (interval || appState !== 'active') return;
    expectedAt = Date.now() + CHECK_INTERVAL_MS;
    interval = setInterval(checkForStall, CHECK_INTERVAL_MS);
  };

  try {
    startChecks();
    const subscription = AppState.addEventListener('change', (nextState) => {
      try {
        appState = nextState;
        if (nextState === 'active') {
          foregroundAt = Date.now();
          startChecks();
        } else {
          stopChecks();
          largestStall = 0;
          if (reportTimer) clearTimeout(reportTimer);
          reportTimer = null;
        }
      } catch {}
    });
    return () => {
      try {
        stopChecks();
        if (reportTimer) clearTimeout(reportTimer);
        subscription.remove();
      } catch {}
    };
  } catch {
    return () => {};
  }
};
