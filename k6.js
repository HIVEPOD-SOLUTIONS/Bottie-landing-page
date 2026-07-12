/**
 * k6 Load Test — EdTech Onboarding Simulation
 * ----------------------------------------------
 * Simulates the real user journey during a mass onboarding event:
 *   1. Signup
 *   2. Login
 *   3. Browse courses (read-heavy, hits DB / read replica)
 *   4. Request a signed video URL (tests signing endpoint, not S3/CloudFront itself)
 *
 * HOW TO RUN
 * ----------
 * 1. Install k6:        https://k6.io/docs/get-started/installation/
 * 2. Set your API base URL as an env var (never hardcode prod secrets in this file):
 *
 *      k6 run -e BASE_URL=https://api.yourapp.com onboarding_load_test.js
 *
 * 3. Recommended progression — do NOT jump straight to 2000:
 *      Run 1: 100 VUs   -> confirm no errors, note response times
 *      Run 2: 500 VUs   -> check RDS DatabaseConnections / CPU in CloudWatch
 *      Run 3: 1000 VUs  -> check EC2 ASG scale-out behavior
 *      Run 4: 2000 VUs  -> full rehearsal, ideally a few days before launch
 *
 *    Override the target VU count without editing the file:
 *      k6 run -e BASE_URL=https://api.yourapp.com -e TARGET_VUS=500 onboarding_load_test.js
 *
 * WHAT TO WATCH WHILE THIS RUNS
 * ------------------------------
 * - CloudWatch: RDS CPUUtilization, DatabaseConnections, FreeableMemory
 * - CloudWatch: ALB TargetResponseTime, HTTPCode_Target_5XX_Count
 * - ASG: whether new EC2 instances actually launch and pass health checks in time
 * - This script's own summary at the end: p95 latency and error rate per endpoint
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Trend } from "k6/metrics";

// ---- Config ----
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || "2000", 10);

// Print first N responses per endpoint to diagnose server errors without
// flooding the console. Set DEBUG_SAMPLES=0 to silence completely.
const DEBUG_SAMPLES = parseInt(__ENV.DEBUG_SAMPLES || "3", 10);
let signupSamples = 0;
let loginSamples = 0;

// ---- Custom metrics (shown in the end-of-run summary) ----
const signupErrors = new Counter("signup_errors");
const loginErrors = new Counter("login_errors");
const browseErrors = new Counter("browse_errors");
const videoUrlErrors = new Counter("video_url_errors");

const signupDuration = new Trend("signup_duration");
const loginDuration = new Trend("login_duration");
const browseDuration = new Trend("browse_duration");
const videoUrlDuration = new Trend("video_url_duration");

// ---- Ramp profile ----
// Mimics a real onboarding push: gradual ramp-up (not instant), a sustained
// peak window (the "everyone is on the platform" period), then ramp-down.
export const options = {
  scenarios: {
    onboarding_rush: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: Math.round(TARGET_VUS * 0.25) }, // early arrivals
        { duration: "3m", target: Math.round(TARGET_VUS * 0.75) }, // main wave
        { duration: "2m", target: TARGET_VUS },                    // full peak
        { duration: "5m", target: TARGET_VUS },                    // hold at peak — this is the window that matters most
        { duration: "3m", target: 0 },                             // ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // Fail the test run (non-zero exit code) if these are breached —
    // useful for wiring into CI or a pre-launch go/no-go check.
    http_req_duration: ["p(95)<1500"],       // 95% of all requests under 1.5s
    signup_duration: ["p(95)<2000"],
    login_duration: ["p(95)<1500"],
    browse_duration: ["p(95)<1000"],
    video_url_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],          // less than 1% hard failures
  },
};

// ---- Helpers ----
function randomEmail() {
  return `loadtest_${Date.now()}_${Math.floor(Math.random() * 1000000)}@example.com`;
}

function jsonHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// ---- Main VU flow ----
export default function () {
  // Generate email once so signup and login use the same credentials.
  const email = randomEmail();
  const password = "LoadTest!2026";
  let authToken = null;

  // 1. SIGNUP
  group("signup", () => {
    const payload = JSON.stringify({
      email,
      password,
      full_name: "Load Test User",
    });

    const res = http.post(`${BASE_URL}/api/auth/signup`, payload, {
      headers: jsonHeaders(),
      tags: { name: "signup" },
    });

    signupDuration.add(res.timings.duration);

    const ok = check(res, {
      "signup status is 200/201": (r) => r.status === 200 || r.status === 201,
    });
    if (!ok) {
      signupErrors.add(1);
      if (signupSamples < DEBUG_SAMPLES) {
        signupSamples++;
        console.error(`[signup] status=${res.status} body=${res.body.slice(0, 300)}`);
      }
    }
  });

  sleep(randomBetween(1, 3));

  // 2. LOGIN — uses the same email created in signup above
  group("login", () => {
    const payload = JSON.stringify({ email, password });

    const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
      headers: jsonHeaders(),
      tags: { name: "login" },
    });

    loginDuration.add(res.timings.duration);

    const ok = check(res, {
      "login status is 200": (r) => r.status === 200,
    });
    if (!ok) {
      loginErrors.add(1);
      if (loginSamples < DEBUG_SAMPLES) {
        loginSamples++;
        console.error(`[login] status=${res.status} body=${res.body.slice(0, 300)}`);
      }
      return;
    }

    try {
      authToken = JSON.parse(res.body).token;
    } catch (e) {
      loginErrors.add(1);
    }
  });

  // Skip authenticated steps if login failed — no point sending 401s.
  if (!authToken) {
    sleep(randomBetween(1, 2));
    return;
  }

  sleep(randomBetween(1, 2));

  // 3. BROWSE COURSES (read-heavy — this is what your read replica should absorb)
  group("browse_courses", () => {
    const res = http.get(`${BASE_URL}/api/courses?page=1&limit=20`, {
      headers: jsonHeaders(authToken),
      tags: { name: "browse_courses" },
    });

    browseDuration.add(res.timings.duration);

    const ok = check(res, {
      "browse status is 200": (r) => r.status === 200,
    });
    if (!ok) browseErrors.add(1);
  });

  sleep(randomBetween(2, 5));

  // 4. REQUEST SIGNED VIDEO URL (tests the signing endpoint on EC2 —
  //    NOT the actual video download, which should go straight to CloudFront)
  group("get_video_url", () => {
    const courseId = Math.floor(Math.random() * 50) + 1;
    const res = http.get(`${BASE_URL}/api/courses/${courseId}/video-url`, {
      headers: jsonHeaders(authToken),
      tags: { name: "get_video_url" },
    });

    videoUrlDuration.add(res.timings.duration);

    const ok = check(res, {
      "video-url status is 200": (r) => r.status === 200,
      "response contains a signed url": (r) => {
        try {
          return !!JSON.parse(r.body).url;
        } catch (e) {
          return false;
        }
      },
    });
    if (!ok) videoUrlErrors.add(1);
  });

  sleep(randomBetween(3, 8));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}