import * as THREE from './assets/vendor/three.module.min.js';

const worldEl = document.getElementById('worldExperience');
if (worldEl) {
  document.body.classList.add('lp-world-enabled');
  mountSiteProgress();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (webglAvailable() && !reducedMotion) {
    if ('IntersectionObserver' in window) {
      const mountObserver = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        mountObserver.disconnect();
        tryMountWorld();
      }, { rootMargin: '110% 0px' });
      mountObserver.observe(worldEl);
    } else {
      tryMountWorld();
    }
  }
}

function tryMountWorld() {
  try {
    mountWorld();
  } catch (error) {
    worldEl?.classList.remove('world-live');
  }
}

function mountSiteProgress() {
  const root = document.createElement('div');
  root.className = 'lp-site-progress';
  root.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span');
  root.appendChild(fill);
  document.body.appendChild(root);

  let ticking = false;
  const update = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    fill.style.transform = `scaleX(${Math.min(1, Math.max(0, window.scrollY / max))})`;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
}

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext
      && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch (error) {
    return false;
  }
}

function mountWorld() {
  const STEPS = [
    {
      eyebrow: 'CHECK / 現状確認',
      title: 'まず、何が起きているのかを確認する。',
      body: '事実と認識を分けながら、誰が関係し、今何が起きているのかを丁寧に確認します。',
      tags: ['ヒアリング', '事実確認'],
      accent: '#f97368',
    },
    {
      eyebrow: 'SORT / 情報整理',
      title: '事実・認識・感情・期待を分ける。',
      body: '混ざりやすい事実と解釈、感情と期待を一つずつ切り分けて整理します。',
      tags: ['事実', '解釈', '感情'],
      accent: '#60a5fa',
    },
    {
      eyebrow: 'STRUCTURE / 構造把握',
      title: '役割・責任・関係性を整理する。',
      body: '誰が何を担っているのか、役割・責任・仕組みの構造を可視化します。',
      tags: ['役割', '責任', '境界線'],
      accent: '#3355c9',
    },
    {
      eyebrow: 'CLARIFY / 課題明確化',
      title: '「何となく」を、具体的な課題にする。',
      body: '感覚的な違和感やうまくいかなさを、扱える課題の形に落とし込みます。',
      tags: ['課題設定', '言語化'],
      accent: '#f4b740',
    },
    {
      eyebrow: 'MOVE / 次の一手',
      title: '必要な対応と優先順位を整理する。',
      body: '選択肢を整理し、次に取るべき行動と優先順位を明確にします。',
      tags: ['優先順位', '行動計画'],
      accent: '#34d399',
    },
  ];

  const stage = document.getElementById('lpWorldStage');
  const fallback = worldEl.querySelector('.world-fallback');
  const copy = worldEl.querySelector('.world-copy');
  const num = document.getElementById('worldStepNum');
  const eyebrow = document.getElementById('worldEyebrow');
  const title = document.getElementById('worldTitle');
  const body = document.getElementById('worldBody');
  const tags = document.getElementById('worldTags');
  const worldProgress = document.getElementById('worldProgressFill');
  const routeButtons = [...worldEl.querySelectorAll('[data-world-step]')];
  const interactiveMode = worldEl.dataset.worldMode === 'interactive';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (!stage || !copy || !num || !eyebrow || !title || !body || !tags) return;

  const renderer = new THREE.WebGLRenderer({ antialias: !coarsePointer, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.25 : 1.75));
  renderer.setClearColor(0x5c94dc, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    stop();
    renderer.dispose();
    stage.replaceChildren();
    worldEl.classList.remove('world-live');
    if (fallback) fallback.hidden = false;
  }, { once: true });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x5c94dc);
  scene.fog = new THREE.FogExp2(0x5c94dc, 0.022);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 150);

  scene.add(new THREE.HemisphereLight(0xfff0d0, 0xc7c9d0, 1.25));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(-6, 12, 8);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xd9ac57, 1.1);
  rimLight.position.set(10, 6, -12);
  scene.add(rimLight);

  const material = (color, options = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: .48,
    metalness: .18,
    ...options,
  });
  const glowMaterial = color => material(color, {
    emissive: color,
    emissiveIntensity: .42,
    roughness: .34,
    metalness: .25,
  });
  const root = new THREE.Group();
  scene.add(root);

  const scenePositions = [
    new THREE.Vector3(3, 0, 0),
    new THREE.Vector3(-2, 0, -18),
    new THREE.Vector3(3, 0, -36),
    new THREE.Vector3(-2, 0, -54),
    new THREE.Vector3(3, 0, -72),
  ];
  const sceneBuilders = [buildBottleneck, buildBlueprint, buildAutomation, buildApproval, buildOutcome];
  const worldNodes = scenePositions.map((position, index) => buildScene(position, index, sceneBuilders[index]));

  const routeCurve = new THREE.CatmullRomCurve3(
    scenePositions.map(position => position.clone().add(new THREE.Vector3(0, .42, 0))),
    false,
    'catmullrom',
    .25
  );
  const routeTube = new THREE.Mesh(
    new THREE.TubeGeometry(routeCurve, 280, .045, 8, false),
    new THREE.MeshBasicMaterial({ color: 0x4fa8ff, transparent: true, opacity: .52 })
  );
  root.add(routeTube);

  const particleCount = coarsePointer ? 28 : 54;
  const particles = new THREE.InstancedMesh(
    new THREE.SphereGeometry(.075, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xf4b740 }),
    particleCount
  );
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(particles);
  const particleDummy = new THREE.Object3D();

  const grid = new THREE.GridHelper(150, 75, 0x24476d, 0x132a43);
  grid.position.set(0, -1.08, -36);
  grid.material.transparent = true;
  grid.material.opacity = .34;
  scene.add(grid);

  const cameraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-8, 5.8, 11),
    new THREE.Vector3(8, 5.2, -7),
    new THREE.Vector3(-8, 6, -25),
    new THREE.Vector3(8, 5.4, -43),
    new THREE.Vector3(-8, 5.8, -61),
  ], false, 'catmullrom', .38);
  const targetCurve = new THREE.CatmullRomCurve3(
    scenePositions.map(position => position.clone().add(new THREE.Vector3(0, .65, 0))),
    false,
    'catmullrom',
    .25
  );
  const cameraPoint = new THREE.Vector3();
  const targetPoint = new THREE.Vector3();

  function buildScene(position, index, builder) {
    const group = new THREE.Group();
    group.position.copy(position);
    const accent = new THREE.Color(STEPS[index].accent).getHex();
    const platformMaterial = material(0x152942, { emissive: accent, emissiveIntensity: .12 });
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.65, .28, 48), platformMaterial);
    platform.position.y = -1;
    group.add(platform);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .65 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.47, .045, 8, 64), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -.84;
    group.add(ring);
    const built = builder(accent);
    group.add(built.group);
    root.add(group);
    return { group, platformMaterial, ringMaterial, animations: built.animations || [] };
  }

  function buildBottleneck(accent) {
    const group = new THREE.Group();
    const cards = [];
    for (let i = 0; i < 4; i += 1) {
      const card = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.25, .12), material(0xdce7f5));
      card.add(panel);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(.15, 1.25, .15), material(i === 2 ? 0xf97368 : 0x60a5fa));
      rail.position.x = -1.05;
      card.add(rail);
      for (let line = 0; line < 3; line += 1) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.25 - line * .16, .1, .14), material(0x8195ae));
        bar.position.set(.12, .34 - line * .3, .03);
        card.add(bar);
      }
      const baseY = .05 + i * .42;
      card.position.set((i - 1.5) * .48, baseY, -i * .42);
      card.rotation.y = -.24 + i * .13;
      group.add(card);
      cards.push({ card, baseY });
    }
    const barrierMaterial = glowMaterial(accent);
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.7, .18, .22), barrierMaterial);
    barrier.position.set(0, .42, 1.35);
    barrier.rotation.z = -.08;
    group.add(barrier);
    const alert = new THREE.Mesh(new THREE.OctahedronGeometry(.36, 0), glowMaterial(0xf97368));
    alert.position.set(1.5, 1.15, 1.2);
    group.add(alert);
    group.rotation.y = .12;
    return {
      group,
      animations: [time => {
        cards.forEach(({ card, baseY }, i) => { card.position.y = baseY + Math.sin(time * 1.05 + i) * .035; });
        alert.rotation.y = time * .8;
        barrierMaterial.emissiveIntensity = .3 + Math.sin(time * 1.8) * .12;
      }],
    };
  }

  function buildBlueprint(accent) {
    const group = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(5.2, .18, 3.5), material(0xd9e6f4));
    board.position.y = -.32;
    group.add(board);
    const points = [
      new THREE.Vector3(-1.7, -.08, .8),
      new THREE.Vector3(-.55, -.08, -.7),
      new THREE.Vector3(.8, -.08, .55),
      new THREE.Vector3(1.8, -.08, -.8),
    ];
    for (let i = 0; i < points.length - 1; i += 1) addLine(group, points[i], points[i + 1], accent);
    points.forEach((point, index) => {
      const node = new THREE.Mesh(
        new THREE.CylinderGeometry(.3, .3, .3, 24),
        index === 2 ? glowMaterial(0x3355c9) : material(index === 3 ? 0xf4b740 : 0x3b82f6)
      );
      node.position.copy(point).add(new THREE.Vector3(0, .25, 0));
      group.add(node);
    });
    const scanner = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, .055, 10, 48),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .84 })
    );
    scanner.rotation.x = Math.PI / 2;
    scanner.position.set(-.15, .18, 0);
    group.add(scanner);
    group.rotation.y = -.18;
    return {
      group,
      animations: [time => {
        scanner.rotation.z = time * .35;
        scanner.scale.setScalar(.95 + Math.sin(time * 1.3) * .05);
      }],
    };
  }

  function buildAutomation() {
    const group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.82, 1), glowMaterial(0x3355c9));
    core.position.y = .62;
    group.add(core);
    const orbitA = new THREE.Mesh(
      new THREE.TorusGeometry(1.3, .055, 10, 56),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: .82 })
    );
    orbitA.position.y = .62;
    orbitA.rotation.x = 1.1;
    group.add(orbitA);
    const orbitB = orbitA.clone();
    orbitB.rotation.set(.3, .85, .2);
    group.add(orbitB);
    const conveyor = new THREE.Group();
    const blocks = [];
    for (let i = 0; i < 5; i += 1) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(.48, .48, .48), material(i === 4 ? 0xf4b740 : 0x60a5fa));
      block.position.set(-2.5 + i * 1.2, -.22, .25);
      conveyor.add(block);
      blocks.push(block);
    }
    group.add(conveyor);
    return {
      group,
      animations: [time => {
        core.rotation.x = time * .25;
        core.rotation.y = time * .42;
        orbitA.rotation.z = time * .35;
        orbitB.rotation.z = -time * .28;
        blocks.forEach((block, i) => { block.position.y = -.22 + Math.max(0, Math.sin(time * 1.5 - i * .8)) * .18; });
      }],
    };
  }

  function buildApproval() {
    const group = new THREE.Group();
    const frameMaterial = material(0xdce7f5);
    const left = new THREE.Mesh(new THREE.BoxGeometry(.28, 2.5, .3), frameMaterial);
    left.position.set(-1.25, .2, 0);
    group.add(left);
    const right = left.clone();
    right.position.x = 1.25;
    group.add(right);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.8, .28, .3), frameMaterial);
    top.position.y = 1.45;
    group.add(top);
    const gateMaterial = glowMaterial(0xf4b740);
    const gate = new THREE.Mesh(new THREE.BoxGeometry(2.15, .2, .22), gateMaterial);
    gate.position.y = .38;
    group.add(gate);
    const consoleBase = new THREE.Mesh(new THREE.BoxGeometry(2.1, .3, 1.1), material(0x17283e));
    consoleBase.position.set(0, -.52, 1.2);
    group.add(consoleBase);
    const approveMaterial = glowMaterial(0x34d399);
    const approve = new THREE.Mesh(new THREE.BoxGeometry(.62, .16, .44), approveMaterial);
    approve.position.set(-.45, -.3, 1.45);
    group.add(approve);
    const reject = new THREE.Mesh(new THREE.BoxGeometry(.62, .16, .44), glowMaterial(0xf97368));
    reject.position.set(.45, -.3, 1.45);
    group.add(reject);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.32, 18, 18), material(0xf2c9a5));
    head.position.set(0, 1.85, 1.05);
    group.add(head);
    const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(.34, .5, 6, 14), material(0x2563eb));
    bodyMesh.position.set(0, 1.22, 1.05);
    group.add(bodyMesh);
    group.rotation.y = -.12;
    return {
      group,
      animations: [time => {
        gate.position.y = .38 + Math.sin(time * 1.15) * .18;
        approveMaterial.emissiveIntensity = .34 + Math.sin(time * 1.8) * .16;
      }],
    };
  }

  function buildOutcome() {
    const group = new THREE.Group();
    const screen = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.75, .18), material(0xdce7f5));
    screen.position.y = .45;
    group.add(screen);
    const bars = [];
    for (let i = 0; i < 4; i += 1) {
      const baseHeight = .45 + i * .3;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(.55, baseHeight, .22), glowMaterial(i === 3 ? 0x34d399 : 0x60a5fa));
      bar.position.set(-1.55 + i * .85, -.55 + baseHeight / 2, .14);
      group.add(bar);
      bars.push({ bar, baseHeight });
    }
    const check = new THREE.Group();
    const short = new THREE.Mesh(new THREE.BoxGeometry(.72, .18, .2), glowMaterial(0x34d399));
    short.rotation.z = -.72;
    short.position.set(.12, .05, 0);
    check.add(short);
    const long = new THREE.Mesh(new THREE.BoxGeometry(1.45, .18, .2), glowMaterial(0x34d399));
    long.rotation.z = .75;
    long.position.set(.78, .18, 0);
    check.add(long);
    check.position.set(.75, .68, .2);
    group.add(check);
    group.rotation.y = .16;
    return {
      group,
      animations: [time => {
        bars.forEach(({ bar, baseHeight }, i) => {
          const scale = .86 + .14 * (.5 + .5 * Math.sin(time * 1.05 + i * .65));
          bar.scale.y = scale;
          bar.position.y = -.55 + (baseHeight * scale) / 2;
        });
        check.rotation.y = Math.sin(time * .65) * .1;
      }],
    };
  }

  function addLine(group, start, end, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: .76 })
    );
    group.add(line);
  }

  let activeIndex = -1;
  let targetProgress = 0;
  let currentProgress = 0;
  let visible = false;
  let rafId = 0;
  let lastTime = performance.now();
  let compact = false;

  function setActive(index) {
    if (index === activeIndex || !STEPS[index]) return;
    activeIndex = index;
    const step = STEPS[index];
    worldEl.style.setProperty('--lp-world-accent', step.accent);
    num.textContent = `${String(index + 1).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`;
    eyebrow.textContent = step.eyebrow;
    title.textContent = step.title;
    body.textContent = step.body;
    tags.replaceChildren(...step.tags.map(tag => {
      const item = document.createElement('li');
      item.textContent = tag;
      return item;
    }));
    copy.classList.toggle('is-final', index === STEPS.length - 1);
    routeButtons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === index;
      button.classList.toggle('is-active', selected);
      if (selected) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    if (!reducedMotion) copy.animate([{ opacity: .48 }, { opacity: 1 }], {
      duration: 180,
      easing: 'cubic-bezier(.23, 1, .32, 1)',
    });
  }

  function readScroll() {
    if (interactiveMode) return;
    const rect = worldEl.getBoundingClientRect();
    const travel = Math.max(1, worldEl.offsetHeight - window.innerHeight);
    targetProgress = THREE.MathUtils.clamp(-rect.top / travel, 0, 1);
    if (worldProgress) worldProgress.style.transform = `scaleY(${targetProgress})`;
    setActive(Math.round(targetProgress * (STEPS.length - 1)));
    if (reducedMotion && visible) renderScene(targetProgress, performance.now() / 1000);
  }

  function jumpTo(index) {
    if (interactiveMode) {
      targetProgress = index / (STEPS.length - 1);
      setActive(index);
      if (worldProgress) worldProgress.style.transform = `scaleY(${targetProgress})`;
      start();
      return;
    }
    const rect = worldEl.getBoundingClientRect();
    const worldTop = window.scrollY + rect.top;
    const travel = Math.max(1, worldEl.offsetHeight - window.innerHeight);
    window.scrollTo({
      top: worldTop + (index / (STEPS.length - 1)) * travel,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }

  routeButtons.forEach((button, index) => button.addEventListener('click', () => jumpTo(index)));

  function resize() {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    compact = width <= 700;
    camera.aspect = width / height;
    camera.fov = compact ? 56 : 44;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.25 : 1.75));
    renderer.setSize(width, height, false);
    renderScene(reducedMotion ? targetProgress : currentProgress, performance.now() / 1000);
  }

  function updateParticles(time) {
    for (let i = 0; i < particleCount; i += 1) {
      const progress = (time * .022 + i / particleCount) % 1;
      routeCurve.getPointAt(progress, particleDummy.position);
      const scale = .65 + Math.sin(progress * Math.PI) * .5;
      particleDummy.scale.setScalar(scale);
      particleDummy.updateMatrix();
      particles.setMatrixAt(i, particleDummy.matrix);
    }
    particles.instanceMatrix.needsUpdate = true;
  }

  function renderScene(progress, time) {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const cameraPosition = cameraCurve.getPointAt(p, cameraPoint);
    const target = targetCurve.getPointAt(p, targetPoint);
    if (compact) {
      cameraPosition.x = target.x + (cameraPosition.x - target.x) * .56;
      cameraPosition.y += 1.35;
      cameraPosition.z += 3.2;
      target.y = .08;
    } else {
      target.x -= 1.8;
    }
    camera.position.copy(cameraPosition);
    camera.lookAt(target);

    const closest = Math.round(p * (STEPS.length - 1));
    worldNodes.forEach((node, index) => {
      const active = index === closest;
      const targetScale = active ? 1 : .94;
      const nextScale = node.group.scale.x + (targetScale - node.group.scale.x) * .08;
      node.group.scale.setScalar(nextScale);
      node.platformMaterial.emissiveIntensity += ((active ? .42 : .1) - node.platformMaterial.emissiveIntensity) * .08;
      node.ringMaterial.opacity += ((active ? .95 : .42) - node.ringMaterial.opacity) * .08;
      if (!reducedMotion) node.animations.forEach(animation => animation(time));
    });
    if (!reducedMotion) updateParticles(time);
    renderer.render(scene, camera);
  }

  function frame(now) {
    rafId = 0;
    if (!visible || document.hidden) return;
    const delta = Math.min(.05, (now - lastTime) / 1000);
    lastTime = now;
    const easing = reducedMotion ? 1 : 1 - Math.pow(.001, delta);
    currentProgress += (targetProgress - currentProgress) * easing;
    renderScene(currentProgress, now / 1000);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (reducedMotion) {
      if (visible && !document.hidden) renderScene(targetProgress, performance.now() / 1000);
      return;
    }
    if (rafId || !visible || document.hidden) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) start();
    else stop();
  }, { rootMargin: '0px' });
  observer.observe(worldEl);

  let scrollTicking = false;
  if (!interactiveMode) {
    window.addEventListener('scroll', () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        readScroll();
        scrollTicking = false;
      });
    }, { passive: true });
  }
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  if (fallback) fallback.hidden = true;
  worldEl.classList.add('world-live');
  setActive(0);
  if (!interactiveMode) readScroll();
  else targetProgress = 0;
  currentProgress = targetProgress;
  resize();
}
