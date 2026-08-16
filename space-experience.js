const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const captureSpherePoster = new URLSearchParams(window.location.search).has('capture-sphere');

scheduleSphereNavigation();
mountScrollVideos();
mountWorldExperience();

function scheduleSphereNavigation() {
  const host = document.getElementById('sphereCanvas');
  if (!host) return;

  let started = false;
  const navigation = host.closest('.sphere-nav');
  const start = () => {
    if (started) return;
    started = true;
    navigation?.removeEventListener('pointerenter', start);
    navigation?.removeEventListener('pointerdown', start);
    navigation?.removeEventListener('focusin', start);
    mountSphereNavigation();
  };

  if (captureSpherePoster) {
    start();
    return;
  }

  navigation?.addEventListener('pointerenter', start, { passive: true });
  navigation?.addEventListener('pointerdown', start, { passive: true });
  navigation?.addEventListener('focusin', start, { passive: true });
}

function mountWorldExperience() {
  const world = document.getElementById('worldExperience');
  if (!world || reducedMotion) return;

  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    import('./lp-world.js').catch(() => {});
  };

  if (!('IntersectionObserver' in window)) {
    load();
    return;
  }

  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    load();
  }, { rootMargin: '80% 0px' });
  observer.observe(world);
}

async function mountSphereNavigation() {
  const host = document.getElementById('sphereCanvas');
  if (!host || !webglAvailable()) {
    document.body.classList.add('sphere-fallback');
    return;
  }

  try {
    const THREE = await import('./assets/vendor/three.module.min.js');
    const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !coarsePointer,
      powerPreference: coarsePointer ? 'low-power' : 'high-performance',
      preserveDrawingBuffer: captureSpherePoster,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(captureSpherePoster && coarsePointer
      ? 2
      : Math.min(window.devicePixelRatio, coarsePointer ? 1 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 80);
    camera.position.set(0, 0, 9);

    const sphere = new THREE.Group();
    scene.add(sphere);

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.12, coarsePointer ? 2 : 3),
      new THREE.MeshBasicMaterial({
        color: 0xf7f3e8,
        transparent: true,
        opacity: .88,
        wireframe: true,
        depthWrite: false,
      }),
    );
    sphere.add(shell);

    const innerShell = new THREE.Mesh(
      new THREE.SphereGeometry(1.72, coarsePointer ? 16 : 28, coarsePointer ? 10 : 18),
      new THREE.MeshBasicMaterial({
        color: 0x3f6fa0,
        transparent: true,
        opacity: .08,
        depthWrite: false,
      }),
    );
    sphere.add(innerShell);

    const pointGeometry = new THREE.IcosahedronGeometry(2.17, coarsePointer ? 2 : 3);
    const pointCloud = new THREE.Points(
      pointGeometry,
      new THREE.PointsMaterial({ color: 0xf0d99a, size: coarsePointer ? .035 : .045, transparent: true, opacity: .78 }),
    );
    sphere.add(pointCloud);

    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xf7f3e8, transparent: true, opacity: .85 });
    const rings = [
      [2.52, 0, 0, 0],
      [2.38, Math.PI / 2.5, 0, Math.PI / 5],
      [2.67, Math.PI / 2, Math.PI / 3.2, 0],
    ].map(([radius, x, y, z]) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .014, 4, coarsePointer ? 40 : 72), ringMaterial.clone());
      ring.rotation.set(x, y, z);
      sphere.add(ring);
      return ring;
    });

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(.34, 1),
      new THREE.MeshBasicMaterial({ color: 0xfff6e2, transparent: true, opacity: .9 }),
    );
    sphere.add(core);

    const starCount = coarsePointer ? 100 : 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      starPositions[index * 3] = (Math.random() - .5) * 20;
      starPositions[index * 3 + 1] = (Math.random() - .5) * 11;
      starPositions[index * 3 + 2] = -2 - Math.random() * 20;
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({ color: 0xe8e6e0, size: coarsePointer ? .025 : .035, transparent: true, opacity: .6 }),
    );
    scene.add(stars);

    let targetX = -.12;
    let targetY = -.32;
    let dragging = false;
    let pointerX = 0;
    let pointerY = 0;
    let visible = true;
    let frame = 0;
    let lastRenderedAt = -Infinity;
    const frameInterval = 1000 / (coarsePointer ? 12 : 24);

    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      renderer.dispose();
      host.replaceChildren();
      document.body.classList.remove('sphere-ready');
      document.body.classList.add('sphere-fallback');
    }, { once: true });

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const landscapeCompact = width <= 900 && window.innerHeight <= 600 && width > window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = landscapeCompact ? 7.2 : 9;
      camera.updateProjectionMatrix();
      const mobile = width <= 860 && !landscapeCompact;
      sphere.position.set(landscapeCompact ? 2.45 : (mobile ? 0 : 2.05), mobile ? .05 : 0, 0);
      sphere.scale.setScalar(landscapeCompact ? .8 : (mobile ? .84 : 1));
    };

    const render = time => {
      if (!visible || document.hidden) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(render);
      if (time - lastRenderedAt < frameInterval) return;
      lastRenderedAt = time;
      const seconds = time * .001;
      sphere.rotation.x += (targetX - sphere.rotation.x) * .065;
      sphere.rotation.y += (targetY - sphere.rotation.y) * .065;
      if (!dragging) targetY += .0015;
      rings[0].rotation.z = seconds * .07;
      rings[1].rotation.y = seconds * .09;
      rings[2].rotation.x = Math.PI / 2 + seconds * .05;
      core.rotation.x = seconds * .42;
      core.rotation.y = seconds * .55;
      stars.rotation.y = seconds * .0025;
      renderer.render(scene, camera);
    };

    const startRendering = () => {
      if (!frame && !reducedMotion) frame = requestAnimationFrame(render);
      if (reducedMotion) renderer.render(scene, camera);
    };

    host.addEventListener('pointerdown', event => {
      dragging = true;
      pointerX = event.clientX;
      pointerY = event.clientY;
      host.setPointerCapture?.(event.pointerId);
    });
    host.addEventListener('pointermove', event => {
      if (!dragging || reducedMotion) return;
      const dx = event.clientX - pointerX;
      const dy = event.clientY - pointerY;
      targetY += dx * .008;
      targetX += dy * .006;
      targetX = Math.max(-1.05, Math.min(1.05, targetX));
      pointerX = event.clientX;
      pointerY = event.clientY;
    });
    const release = event => {
      dragging = false;
      if (event?.pointerId !== undefined && host.hasPointerCapture?.(event.pointerId)) {
        host.releasePointerCapture(event.pointerId);
      }
    };
    host.addEventListener('pointerup', release);
    host.addEventListener('pointercancel', release);

    const visibilityObserver = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) startRendering();
      if (!visible && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }, { rootMargin: '120px' });
    visibilityObserver.observe(host);

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reducedMotion) renderer.render(scene, camera);
    });
    resizeObserver.observe(host);
    resize();
    renderer.render(scene, camera);
    document.body.classList.add('sphere-ready');
    startRendering();
  } catch (error) {
    document.body.classList.add('sphere-fallback');
  }
}

function mountScrollVideos() {
  const stories = [...document.querySelectorAll('.story-scroll')];
  if (!stories.length) return;

  const applyPoster = story => {
    const video = story.querySelector('.story-scroll__video');
    const media = story.querySelector('.story-scroll__media');
    const poster = video?.dataset.poster;
    if (!video || !media || !poster || story.classList.contains('is-poster-ready')) return;
    video.poster = poster;
    media.style.setProperty('--story-poster', `url("${poster}")`);
    story.classList.add('is-poster-ready');
  };

  if (reducedMotion) {
    if (!('IntersectionObserver' in window)) {
      stories.forEach(applyPoster);
      return;
    }
    const posterObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        applyPoster(entry.target);
        posterObserver.unobserve(entry.target);
      });
    }, { rootMargin: '20% 0px' });
    stories.forEach(story => posterObserver.observe(story));
    return;
  }

  const mobileAssets = document.body.classList.contains('space-ui--mobile')
    || window.matchMedia('(max-width: 767px)').matches;
  const objectUrls = new Set();
  let seekFrame = 0;

  const fetchSeekableSource = async (video, sources) => {
    const supportedSources = sources.filter(source => video.canPlayType(source.type));
    const candidates = supportedSources.length ? supportedSources : sources;
    let lastError;

    for (const source of candidates) {
      try {
        const response = await fetch(source.src, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`Video request failed: ${response.status}`);
        const blob = await response.blob();
        if (!blob.size) throw new Error('Video response was empty');
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.add(objectUrl);
        video.dataset.assetSource = source.src;
        video.src = objectUrl;
        video.load();
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('No supported video source');
  };

  const seekActiveVideo = () => {
    seekFrame = 0;
    const story = stories.find(candidate => candidate.classList.contains('is-current'));
    const video = story?.querySelector('.story-scroll__video');
    const targetTime = Number.parseFloat(video?.dataset.targetTime || '');
    if (!video || !Number.isFinite(targetTime) || !Number.isFinite(video.duration) || video.duration <= 0) return;
    if (!video.seekable.length) return;
    const seekStart = video.seekable.start(0);
    const seekEnd = video.seekable.end(video.seekable.length - 1);
    if (targetTime < seekStart || targetTime > seekEnd + .02) return;

    const difference = targetTime - video.currentTime;
    if (Math.abs(difference) <= .12) {
      story.classList.add('is-video-ready');
      return;
    }
    if (!video.seeking) {
      const step = Math.min(1.1, Math.max(.08, Math.abs(difference) * .28));
      try {
        video.currentTime += Math.sign(difference) * step;
      } catch (error) {
        story.classList.add('is-video-fallback');
        return;
      }
    }
    seekFrame = requestAnimationFrame(seekActiveVideo);
  };

  const requestSeek = () => {
    if (!seekFrame) seekFrame = requestAnimationFrame(seekActiveVideo);
  };

  const loadVideo = story => {
    const video = story.querySelector('.story-scroll__video');
    if (!video || video.dataset.loaded === 'true') return;
    applyPoster(story);
    const size = mobileAssets ? 'mobile' : 'desktop';
    const sources = [
      { src: video.dataset[`${size}Mp4`], type: 'video/mp4' },
      { src: video.dataset[`${size}Webm`], type: 'video/webm' },
    ];
    video.dataset.loaded = 'true';
    video.addEventListener('loadeddata', () => {
      updateStory(story);
      const targetTime = Number.parseFloat(video.dataset.targetTime || '0');
      const revealVideo = () => {
        if (story.classList.contains('is-video-ready')) return;
        story.classList.add('is-video-ready');
        requestSeek();
      };
      if (Number.isFinite(targetTime) && video.seekable.length) {
        const seekStart = video.seekable.start(0);
        const seekEnd = video.seekable.end(video.seekable.length - 1);
        if (targetTime >= seekStart && targetTime <= seekEnd && Math.abs(video.currentTime - targetTime) > .04) {
          requestAnimationFrame(() => {
            try {
              if (typeof video.fastSeek === 'function') video.fastSeek(targetTime);
              else video.currentTime = targetTime;
            } catch (error) {
              story.classList.add('is-video-fallback');
            }
            requestSeek();
          });
          return;
        }
      }
      revealVideo();
    }, { once: true });
    video.addEventListener('progress', requestSeek);
    video.addEventListener('seeked', requestSeek);
    video.addEventListener('error', () => story.classList.add('is-video-fallback'), { once: true });
    fetchSeekableSource(video, sources).catch(() => story.classList.add('is-video-fallback'));
  };

  if (!('IntersectionObserver' in window)) {
    stories.forEach(loadVideo);
  } else {
    const preloadObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        loadVideo(entry.target);
        preloadObserver.unobserve(entry.target);
      });
    });
    stories.forEach(story => preloadObserver.observe(story));
  }

  let ticking = false;
  const update = () => {
    stories.forEach(updateStory);
    stories.forEach(story => story.querySelector('.story-scroll__video')?.pause());
    requestSeek();
    ticking = false;
  };
  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  window.addEventListener('pagehide', () => {
    objectUrls.forEach(objectUrl => URL.revokeObjectURL(objectUrl));
    objectUrls.clear();
  }, { once: true });
  requestUpdate();
}

function updateStory(story) {
  const video = story.querySelector('.story-scroll__video');
  const rect = story.getBoundingClientRect();
  const travel = Math.max(1, rect.height - window.innerHeight);
  const progress = Math.min(1, Math.max(0, -rect.top / travel));
  story.style.setProperty('--story-progress', progress.toFixed(4));
  story.classList.toggle('is-current', rect.top < window.innerHeight * .55 && rect.bottom > window.innerHeight * .45);

  if (story.classList.contains('story-scroll--automation')) {
    const activeNode = Math.min(4, Math.floor(progress * 5));
    story.querySelectorAll('.automation-chain li').forEach((node, index) => {
      node.classList.toggle('is-current', index === activeNode);
    });
  }

  if (!video || video.dataset.loaded !== 'true' || !Number.isFinite(video.duration) || video.duration <= 0) return;
  const targetTime = Math.min(video.duration - .04, Math.max(.02, progress * (video.duration - .08)));
  video.dataset.targetTime = targetTime.toFixed(3);
  if (Math.abs(video.currentTime - targetTime) > 1.25) story.classList.remove('is-video-ready');
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
