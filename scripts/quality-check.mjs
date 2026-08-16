import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);
const fallbackModules = process.env.CODEX_NODE_MODULES
  || `${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`;
const loadDependency = name => {
  try {
    return require(name);
  } catch {
    return require(`${fallbackModules}/${name}`);
  }
};
const { chromium } = loadDependency('playwright');
const { PNG } = loadDependency('pngjs');

const origin = process.env.SITE_ORIGIN || 'http://127.0.0.1:8032';
const usePublicRoutes = process.env.PUBLIC_ROUTES === '1';
const route = (localPath, publicPath) => usePublicRoutes ? publicPath : localPath;
const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const chrome = chromeCandidates.find(candidate => existsSync(candidate));
const bannedCopy = /AIスクール|AI塾|ChatGPT講座/;

const cases = [
  { name: 'home-desktop', path: route('/dist/index.html', '/'), viewport: { width: 1440, height: 900 }, canonical: 'https://aprire.pages.dev/', schemas: ['Organization', 'Person', 'WebSite', 'Service'], sphere: true, compactHome: true },
  { name: 'home-mobile', path: route('/dist/index.html', '/'), viewport: { width: 390, height: 844 }, canonical: 'https://aprire.pages.dev/', schemas: ['Organization', 'Person', 'WebSite', 'Service'], sphere: true, compactHome: true },
  { name: 'services-desktop', path: route('/dist/services.html', '/services'), viewport: { width: 1440, height: 1200 }, canonical: 'https://aprire.pages.dev/services', schemas: ['WebPage', 'Service', 'FAQPage'], heroImage: true, services: true },
  { name: 'services-mobile', path: route('/dist/services.html', '/services'), viewport: { width: 390, height: 1200 }, canonical: 'https://aprire.pages.dev/services', schemas: ['WebPage', 'Service', 'FAQPage'], heroImage: true, services: true },
  { name: 'about-desktop', path: route('/dist/about.html', '/about'), viewport: { width: 1440, height: 1200 }, canonical: 'https://aprire.pages.dev/about', schemas: ['ProfilePage', 'Person'], heroImage: true },
  { name: 'about-mobile', path: route('/dist/about.html', '/about'), viewport: { width: 390, height: 1200 }, canonical: 'https://aprire.pages.dev/about', schemas: ['ProfilePage', 'Person'], heroImage: true },
  { name: 'contact-desktop', path: route('/dist/contact.html', '/contact'), viewport: { width: 1440, height: 1200 }, canonical: 'https://aprire.pages.dev/contact', schemas: ['ContactPage'], heroImage: true, contact: true },
  { name: 'contact-mobile', path: route('/dist/contact.html', '/contact'), viewport: { width: 390, height: 1200 }, canonical: 'https://aprire.pages.dev/contact', schemas: ['ContactPage'], heroImage: true, contact: true },
];

const requestedCase = process.argv[2] || process.env.TEST_CASE;
const selectedCases = requestedCase ? cases.filter(testCase => testCase.name === requestedCase) : cases;
if (!selectedCases.length) throw new Error(`Unknown TEST_CASE: ${requestedCase}`);

function sampledColorCount(png) {
  const colors = new Set();
  for (let index = 0; index < png.data.length; index += 4 * 97) {
    colors.add(`${png.data[index] >> 4},${png.data[index + 1] >> 4},${png.data[index + 2] >> 4}`);
  }
  return colors.size;
}

function pixelDifferenceRatio(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let compared = 0;
  let different = 0;
  for (let index = 0; index < a.data.length; index += 4 * 11) {
    const delta = Math.abs(a.data[index] - b.data[index])
      + Math.abs(a.data[index + 1] - b.data[index + 1])
      + Math.abs(a.data[index + 2] - b.data[index + 2]);
    compared += 1;
    if (delta > 36) different += 1;
  }
  return different / compared;
}

const browser = await chromium.launch({
  headless: true,
  ...(chrome ? { executablePath: chrome } : {}),
  args: ['--no-sandbox', '--disable-background-networking', '--enable-unsafe-swiftshader'],
});

try {
  for (const testCase of selectedCases) {
    const context = await browser.newContext({ viewport: testCase.viewport });
    const page = await context.newPage();
    const pageErrors = [];
    const badResponses = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(origin) && response.status() >= 400) {
        badResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    if (testCase.contact && !usePublicRoutes) {
      await page.route('https://formsubmit.co/ajax/**', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: 'true', message: 'The form was submitted successfully.' }),
      }));
    }

    await page.goto(`${origin}${testCase.path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(testCase.portfolio || testCase.services ? 2200 : 1400);

    const result = await page.evaluate(pattern => {
      const bodyText = document.body.innerText;
      const schemaTypes = [];
      const schemaParseErrors = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach((script, index) => {
        try {
          const data = JSON.parse(script.textContent);
          const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
          nodes.forEach(node => {
            const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
            types.filter(Boolean).forEach(type => schemaTypes.push(type));
          });
        } catch (error) {
          schemaParseErrors.push(`${index}:${error.message}`);
        }
      });
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
        ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
        ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
        h1Count: document.querySelectorAll('h1').length,
        mainCount: document.querySelectorAll('main').length,
        missingAlt: document.querySelectorAll('img:not([alt])').length,
        missingImageDimensions: [...document.images].filter(image => !image.hasAttribute('width') || !image.hasAttribute('height')).length,
        overflow: document.documentElement.scrollWidth - innerWidth,
        banned: new RegExp(pattern).test(bodyText),
        navLinks: document.querySelectorAll('#nav a').length,
        footer: Boolean(document.querySelector('.footer')),
        contactLinks: document.querySelectorAll('a[href="/contact#email"]').length,
        schemaTypes,
        schemaParseErrors,
      };
    }, bannedCopy.source);

    if (!result.title.includes('アプリーレ')) throw new Error(`${testCase.name}: unexpected title`);
    if (result.description.length < 45 || result.description.length > 180) throw new Error(`${testCase.name}: description length ${result.description.length}`);
    if (result.canonical !== testCase.canonical) throw new Error(`${testCase.name}: canonical ${result.canonical}`);
    if (!result.ogTitle || !result.ogDescription || !result.ogImage) throw new Error(`${testCase.name}: social metadata incomplete`);
    if (result.h1Count !== 1 || result.mainCount !== 1) throw new Error(`${testCase.name}: landmarks h1=${result.h1Count}, main=${result.mainCount}`);
    if (result.missingAlt || result.missingImageDimensions) throw new Error(`${testCase.name}: image metadata alt=${result.missingAlt}, dimensions=${result.missingImageDimensions}`);
    if (result.overflow > 1) throw new Error(`${testCase.name}: horizontal overflow ${result.overflow}px`);
    if (result.banned) throw new Error(`${testCase.name}: old school wording remains`);
    if (result.navLinks !== 4 || !result.footer || result.contactLinks < 1) throw new Error(`${testCase.name}: shared HP navigation incomplete`);
    if (result.schemaParseErrors.length || testCase.schemas.some(type => !result.schemaTypes.includes(type))) {
      throw new Error(`${testCase.name}: structured data failed ${JSON.stringify({ types: result.schemaTypes, errors: result.schemaParseErrors })}`);
    }
    if (pageErrors.length) throw new Error(`${testCase.name}: page errors ${pageErrors.join(' | ')}`);
    if (badResponses.length) throw new Error(`${testCase.name}: failed resources ${badResponses.join(' | ')}`);

    if (testCase.viewport.width <= 980) {
      await page.locator('#hamburger').click();
      const navigationState = await page.evaluate(() => ({
        expanded: document.querySelector('#hamburger')?.getAttribute('aria-expanded'),
        open: document.querySelector('#nav')?.classList.contains('open'),
        visibleLinks: [...document.querySelectorAll('#nav a')].filter(link => {
          const rect = link.getBoundingClientRect();
          return rect.width > 0 && rect.height >= 44;
        }).length,
      }));
      if (navigationState.expanded !== 'true' || !navigationState.open || navigationState.visibleLinks !== 4) {
        throw new Error(`${testCase.name}: mobile navigation failed ${JSON.stringify(navigationState)}`);
      }
      await page.keyboard.press('Escape');
      if (await page.locator('#nav').evaluate(element => element.classList.contains('open'))) {
        throw new Error(`${testCase.name}: mobile navigation did not close with Escape`);
      }
    }

    if (testCase.heroImage) {
      const imageState = await page.evaluate(() => {
        const hero = document.querySelector('.page-hero');
        const image = hero?.querySelector('.page-hero__media img');
        const rect = image?.getBoundingClientRect();
        return {
          currentSrc: image?.currentSrc || '',
          loaded: Boolean(image?.complete && image.naturalWidth > 0),
          visible: Boolean(rect && rect.width > 0 && rect.height > 0 && getComputedStyle(image).display !== 'none'),
          hasDimensions: Boolean(image?.hasAttribute('width') && image?.hasAttribute('height')),
          videoCount: hero?.querySelectorAll('video').length || 0,
          toggleCount: hero?.querySelectorAll('[data-video-toggle]').length || 0,
        };
      });
      if (!imageState.currentSrc || !imageState.loaded || !imageState.visible || !imageState.hasDimensions || imageState.videoCount || imageState.toggleCount) {
        throw new Error(`${testCase.name}: static hero image failed ${JSON.stringify(imageState)}`);
      }
    }

    if (testCase.sphere) {
      const posterState = await page.evaluate(() => {
        const poster = document.querySelector('.sphere-nav__poster img');
        return {
          visible: Boolean(poster && getComputedStyle(poster).display !== 'none' && poster.getBoundingClientRect().width > 0),
          loaded: Boolean(poster?.complete && poster.naturalWidth > 0),
          deferred: !document.querySelector('#sphereCanvas canvas'),
        };
      });
      if (!posterState.visible || !posterState.loaded || !posterState.deferred) {
        throw new Error(`${testCase.name}: lightweight sphere preview failed ${JSON.stringify(posterState)}`);
      }
      await page.locator('#sphereCanvas').hover({ position: { x: Math.min(120, testCase.viewport.width / 2), y: 120 } });
      await page.locator('#sphereCanvas canvas').waitFor({ state: 'visible' });
      const sphereState = await page.evaluate(() => {
        const actions = [...document.querySelectorAll('.hero__actions .btn')].map(button => {
          const rect = button.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        });
        return {
          ready: document.body.classList.contains('sphere-ready'),
          poster: {
            opacity: getComputedStyle(document.querySelector('.sphere-nav__poster')).opacity,
            currentSrc: document.querySelector('.sphere-nav__poster img')?.currentSrc,
            naturalWidth: document.querySelector('.sphere-nav__poster img')?.naturalWidth,
            naturalHeight: document.querySelector('.sphere-nav__poster img')?.naturalHeight,
            rect: document.querySelector('.sphere-nav__poster img')?.getBoundingClientRect().toJSON(),
          },
          links: [...document.querySelectorAll('.sphere-nav__link')].map(link => ({ href: link.getAttribute('href'), label: link.getAttribute('aria-label'), height: link.getBoundingClientRect().height })),
          actions,
          bottomNav: Boolean(document.querySelector('.bnav')),
        };
      });
      if (!sphereState.ready || sphereState.links.length !== 6 || sphereState.links.some(link => !link.href.startsWith('/') || !link.label || link.height < 44)) {
        throw new Error(`${testCase.name}: sphere navigation failed ${JSON.stringify(sphereState)}`);
      }
      if (sphereState.bottomNav || sphereState.actions.length !== 2 || sphereState.actions.some(action => action.left < 0 || action.right > testCase.viewport.width || action.height < 44)) {
        throw new Error(`${testCase.name}: primary actions are clipped ${JSON.stringify(sphereState.actions)}`);
      }
      if (process.env.LAYER_SCREENSHOTS === '1') {
        console.log(`${testCase.name}: ${JSON.stringify(sphereState.poster)}`);
        await page.locator('.sphere-nav__poster').evaluate(element => { element.style.visibility = 'hidden'; });
        await page.screenshot({ path: `/tmp/business-ai-${testCase.name}-canvas-only.png`, fullPage: false });
        await page.locator('.sphere-nav__poster').evaluate(element => { element.style.visibility = ''; });
        await page.locator('#sphereCanvas').evaluate(element => { element.style.visibility = 'hidden'; });
        await page.screenshot({ path: `/tmp/business-ai-${testCase.name}-poster-only.png`, fullPage: false });
        await page.locator('#sphereCanvas').evaluate(element => { element.style.visibility = ''; });
      }
    }

    if (testCase.compactHome) {
      const compactState = await page.evaluate(() => {
        const hero = document.querySelector('.hero')?.getBoundingClientRect();
        const proofbar = document.querySelector('.proofbar')?.getBoundingClientRect();
        const heroText = document.querySelector('.hero__text')?.getBoundingClientRect();
        const footer = document.querySelector('.footer');
        return {
          compact: document.body.classList.contains('home-compact'),
          longSections: document.querySelectorAll('.home-answer, .service-directory, .portfolio-feature, .evidence, .profile-teaser, .cta-band').length,
          proofItems: document.querySelectorAll('.proofbar__item').length,
          compactFooter: footer?.classList.contains('footer--compact'),
          footerHidden: footer ? getComputedStyle(footer).display === 'none' : false,
          scrollOverflow: document.scrollingElement.scrollHeight - innerHeight,
          contentInsideViewport: Boolean(hero && proofbar && heroText
            && heroText.bottom <= hero.bottom + 1
            && proofbar.bottom <= innerHeight + 1),
        };
      });
      if (!compactState.compact || compactState.longSections || compactState.proofItems !== 4 || !compactState.compactFooter
        || !compactState.footerHidden || compactState.scrollOverflow > 1 || !compactState.contentInsideViewport) {
        throw new Error(`${testCase.name}: compact home failed ${JSON.stringify(compactState)}`);
      }
    }

    if (testCase.services) {
      const serviceTypography = await page.evaluate(() => [...document.querySelectorAll('.service-detail')].map(item => {
        const number = item.querySelector('.service-detail__num');
        const heading = item.querySelector('h3');
        const numberRect = number.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        return {
          numberSize: parseFloat(getComputedStyle(number).fontSize),
          headingSize: parseFloat(getComputedStyle(heading).fontSize),
          topDelta: Math.abs(numberRect.top - headingRect.top),
        };
      }));
      if (serviceTypography.some(item => item.numberSize < 15 || item.numberSize / item.headingSize < .5 || item.topDelta > 14)) {
        throw new Error(`${testCase.name}: service number and heading balance failed ${JSON.stringify(serviceTypography)}`);
      }

      const world = page.locator('#worldExperience');
      await world.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('#worldExperience')?.classList.contains('world-live'));
      const worldCanvas = page.locator('#lpWorldStage canvas');
      await worldCanvas.waitFor({ state: 'visible' });
      const startPng = PNG.sync.read(await worldCanvas.screenshot());
      if (sampledColorCount(startPng) < 12) throw new Error(`${testCase.name}: 3D process canvas blank`);
      const beforeY = await page.evaluate(() => scrollY);
      await page.locator('[data-world-step="4"]').click();
      await page.waitForFunction(() => document.querySelector('[data-world-step="4"]')?.classList.contains('is-active'));
      await page.waitForTimeout(800);
      const endPng = PNG.sync.read(await worldCanvas.screenshot());
      const afterY = await page.evaluate(() => scrollY);
      const worldTitle = await page.locator('#worldTitle').textContent();
      if (!worldTitle.includes('必要な対応と優先順位') || Math.abs(afterY - beforeY) > 4 || pixelDifferenceRatio(startPng, endPng) < .02) {
        throw new Error(`${testCase.name}: compact 3D selector failed title=${worldTitle}, scroll=${afterY - beforeY}`);
      }

      const motion = page.locator('#serviceMotion');
      await motion.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => Boolean(document.querySelector('[data-motion-image]')?.naturalWidth));
      await page.locator('[data-motion="beauty"]').click();
      await page.waitForFunction(() => document.querySelector('[data-motion-image]')?.currentSrc.includes('scene-beauty'));
      const motionTitle = await page.locator('[data-motion-title]').textContent();
      if (!motionTitle.includes('美容・ヘルスケア商品の販路')) throw new Error(`${testCase.name}: motion selector failed`);

      await page.locator('#faq').scrollIntoViewIfNeeded();
      await page.waitForSelector('.faq-item');
      if (await page.locator('.faq-item').count() !== 7) throw new Error(`${testCase.name}: FAQ count failed`);
      await page.locator('.faq-question').first().click();
      if (await page.locator('.faq-item.open').count() !== 1) throw new Error(`${testCase.name}: FAQ accordion failed`);
    }

    if (testCase.contact) {
      const formState = await page.evaluate(() => {
        const form = document.querySelector('[data-contact-form]');
        const requiredNames = ['name', 'email', 'inquiryType', 'message', 'privacyConsent'];
        return {
          exists: Boolean(form),
          action: form?.getAttribute('action'),
          endpoint: form?.dataset.endpoint,
          method: form?.method,
          missingRequired: requiredNames.filter(name => !form?.elements.namedItem(name)?.required),
          recipientFields: form?.querySelectorAll('[name="to"], [name="recipient"], [name="_cc"]').length || 0,
        };
      });
      const formId = '(?:[a-f0-9]{32}|YOUR_FORMSUBMIT_FORM_ID)';
      const anonymousAction = new RegExp(`^https://formsubmit\\.co/${formId}$`).test(formState.action || '');
      const anonymousEndpoint = new RegExp(`^https://formsubmit\\.co/ajax/${formId}$`).test(formState.endpoint || '');
      if (!formState.exists || !anonymousAction || !anonymousEndpoint || formState.action.includes('@') || formState.endpoint.includes('@') || formState.method !== 'post' || formState.missingRequired.length || formState.recipientFields) {
        throw new Error(`${testCase.name}: contact form configuration failed ${JSON.stringify(formState)}`);
      }

      if (!usePublicRoutes) {
        await page.locator('[name="company"]').fill('検証用会社');
        await page.locator('[name="name"]').fill('検証担当者');
        await page.locator('[name="email"]').fill('contact@example.com');
        await page.locator('[name="inquiryType"]').selectOption('personal');
        await page.locator('[name="message"]').fill('問い合わせフォームの画面動作を確認するためのテストです。');
        await page.locator('[name="privacyConsent"]').check();
        await page.locator('.contact-form__submit').scrollIntoViewIfNeeded();
        await page.locator('.contact-form__submit').click();
        await page.waitForFunction(() => document.querySelector('[data-form-status]')?.classList.contains('is-success'));
        const submittedState = await page.evaluate(() => ({
          message: document.querySelector('[data-form-status]')?.textContent,
          name: document.querySelector('[name="name"]')?.value,
          disabled: document.querySelector('.contact-form__submit')?.disabled,
        }));
        if (!submittedState.message?.includes('送信') || submittedState.name || submittedState.disabled) {
          throw new Error(`${testCase.name}: contact form submit state failed ${JSON.stringify(submittedState)}`);
        }
      }
    }

    await page.screenshot({ path: `/tmp/business-ai-${testCase.name}.png`, fullPage: false });
    console.log(`${testCase.name}: ok, overflow=${result.overflow}px, nav=${result.navLinks}, contact=${result.contactLinks}`);
    await context.close();
  }
} finally {
  await browser.close();
}
