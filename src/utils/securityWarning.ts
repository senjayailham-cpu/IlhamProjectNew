export function checkDefaultCredentials(): void {
  const isDev = import.meta.env.DEV;
  const adminPass = import.meta.env.VITE_DEFAULT_ADMIN_PASS;
  
  if (!isDev) return;
  
  const weakPasswords = ['admin123', '123456', 'changeme', 'password'];
  if (!adminPass || weakPasswords.includes(adminPass)) {
    console.warn(
      '%c⚠ SECURITY WARNING',
      'color: #ff6b35; font-weight: bold; font-size: 14px;',
      '\nDefault weak passwords detected in environment variables.',
      '\nChange VITE_DEFAULT_ADMIN_PASS and VITE_DEFAULT_STAFF_PASS',
      '\nbefore deploying to production!'
    );
  }
}
