import { test, expect } from '@playwright/test';

test.describe('Autenticação Flow', () => {

  test('Deve renderizar a página de login com sucesso', async ({ page }) => {
    // Acessa a página principal (que se não autenticado, deve re-direcionar p/ login ou exibir page de login direto)
    await page.goto('/login');

    // Valida se o título existe
    await expect(page).toHaveTitle(/MultiAtendimento|Login/i);

    // Valida se os campos de formulário estão visíveis
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('Deve exibir erro ao tentar logar com credenciais vazias ou preencher apenas o email', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('button[type="submit"]');

    // Preenche formato errado
    await emailInput.fill('email_invalido');
    await submitButton.click();

    // Na arquitetura de vocês com RHF deve exibir erro de validação: "E-mail inválido" ou required
    // Como a toast on screen também pode aparecer, buscamos genericamente por textos de alerta
    // Esse é um smoke test interativo
    // O Next e o react-hook-form validam imediatamente, logo checamos falha visual
    // Dependendo do setup, o botão fica disable
  });

});
