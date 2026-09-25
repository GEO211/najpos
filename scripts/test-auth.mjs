import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  requireEnv,
} from "./load-env.mjs";

const url = getSupabaseUrl();
const key = getSupabasePublishableKey();
const email = requireEnv("TEST_AUTH_EMAIL");
const password = requireEnv("TEST_AUTH_PASSWORD");

const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: {
    apikey: key,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password }),
});

console.log("status:", res.status);
console.log("body:", await res.text());
