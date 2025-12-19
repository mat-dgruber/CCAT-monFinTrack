import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Wait for the login form to be visible
    await expect(page.locator('app-login')).toBeVisible();

    // Fill in credentials (mock or test user)
    // Using widely accessible selectors like label or placeholder if specific IDs aren't guaranteed
    // Best practice: use data-testid if available, otherwise getByLabel/Placeholder
    await page.getByLabel('Email').fill('testuser@example.com');
    await page.getByLabel('Password').fill('password123');

    // Click login button
    await page.getByRole('button', { name: /entrar/i }).click();

    // Wait for navigation to dashboard or home
    // Expect URL to change or a specific element on the dashboard to appear
    await expect(page).toHaveURL('/home');

    // confirm dashboard element is present
    await expect(page.locator('app-home')).toBeVisible({ timeout: 15000 });
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpass');
    await page.getByRole('button', { name: /entrar/i }).click();

    // specific error message locator might vary, checking for a generic toast or error text
    await expect(page.locator('.p-toast-message-error, .error-message')).toBeVisible();
  });
});
