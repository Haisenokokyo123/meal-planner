import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('customer browser journey and admin order update',async({page,browser})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/register');
  await page.getByLabel('Your name',{exact:true}).fill('Mika Browser');
  await page.getByLabel('Email address',{exact:true}).fill(`browser-${Date.now()}@example.test`);
  await page.getByLabel('Password',{exact:true}).fill('Browser-Test-Only-42!');
  await page.getByLabel('Confirm password',{exact:true}).fill('Browser-Test-Only-42!');
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create my account',exact:true}).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Calculation coefficient (optional)').selectOption('female');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'peanuts',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Weekly meal budget').fill('3500');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'See my personal recipe'}).click();
  await expect(page).toHaveURL(/onboarding\/results$/);
  await page.getByRole('button',{name:'Generate My Week',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your delicious week.',exact:true})).toBeVisible();
  await expect(page.locator('.planner-meal')).toHaveCount(2);
  await page.screenshot({path:'.local/planner-desktop.png',fullPage:true});
  await page.getByRole('button',{name:/^Lock /}).first().click();
  await expect(page.getByRole('button',{name:/^Unlock /})).toHaveCount(1);
  const lockedName=await page.getByRole('button',{name:/^Unlock /}).getAttribute('aria-label');
  await page.getByRole('button',{name:/Regenerate/}).click();
  await expect(page.getByRole('button',{name:lockedName!})).toBeVisible();
  await page.getByRole('button',{name:'Swap',exact:true}).last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.swap-option').first().click();
  await page.getByRole('button',{name:'Confirm swap',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('tab',{name:/Tue/}).click();await expect(page.getByRole('heading',{name:'Tuesday’s good stuff'})).toBeVisible();
  await page.getByRole('link',{name:'Review My Week',exact:true}).click();
  await page.getByRole('link',{name:/Continue to checkout/}).click();
  await page.getByLabel('Complete delivery address').fill('123 Sample Street, Barangay Test, Makati City');
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Confirm demo subscription'}).click();
  await expect(page).toHaveURL(/checkout\/success\?order=/);
  const orderId=new URL(page.url()).searchParams.get('order')!;
  await page.getByRole('link',{name:'View my orders'}).click();await expect(page.locator('.order-card')).toHaveCount(1);
  const admin=await browser.newContext();const a=await admin.newPage();
  const credentials=JSON.parse(readFileSync('.local/e2e-credentials.json','utf8'));
  await a.goto('/login');await a.getByLabel('Email address',{exact:true}).fill(credentials.email);await a.getByLabel('Password',{exact:true}).fill(credentials.password);await a.getByRole('button',{name:'Log in',exact:true}).click();
  await expect(a).toHaveURL(/\/admin$/);await a.goto(`/admin/orders/${orderId}`);
  await a.getByLabel('Move this order forward').selectOption('PREPARING');await a.getByRole('button',{name:'Update status',exact:true}).click();
  await expect(a.locator('.admin-status').filter({hasText:'Preparing'}).first()).toBeVisible();
  await page.getByRole('button',{name:'Refresh status'}).click();await expect(page.locator('.order-card > .order-heading .badge')).toContainText('PREPARING');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/orders-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);await admin.close();
});

test('public routes, mobile menu, image loading and reduced motion at supported widths',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [360,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});await page.goto('/');await expect(page.locator('h1')).toContainText('Your week');
    await expect(page.locator('.public-hero-plate img').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`home at ${width}`).toBe(true);
    await page.goto('/meals');await expect(page.locator('.public-meal-card').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`catalog at ${width}`).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'How it works'}).click();
  await expect(page.locator('h1')).toContainText('thoughtfully');
  for(const path of ['/plans','/about','/contact','/privacy','/terms','/forgot-password','/meals/chicken-inasal']){await page.goto(path);await expect(page.locator('h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path).toBe(true);}
  expect(errors).toEqual([]);
});
