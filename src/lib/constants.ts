export function getAdminCode(): string {
  const code = process.env.ADMIN_CODE?.trim();
  if (!code) {
    throw new Error("ADMIN_CODE is not configured in environment variables.");
  }
  return code;
}
