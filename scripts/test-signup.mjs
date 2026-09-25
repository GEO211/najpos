import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  requireEnv,
} from "./load-env.mjs";

const url = getSupabaseUrl();
const key = getSupabasePublishableKey();
const email = requireEnv("TEST_SIGNUP_EMAIL");
const password = requireEnv("TEST_SIGNUP_PASSWORD");

const signup = await fetch(`${url}/auth/v1/signup`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
console.log("signup status:", signup.status);
console.log("signup body:", await signup.text());

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
console.log("login status:", login.status);
console.log("login body:", await login.text());
