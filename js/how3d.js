// „Как се играе“: скролът води сцената — първо ракетата отблизо, после кортът.
// Без WebGL или при намалени анимации секцията остава обикновен списък с карти.
(function how3D() {
  const section = document.getElementById('how');
  const track = document.getElementById('how-track');
  const canvas = document.getElementById('how3d');
  if (!Padel3D || !canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stage = section.querySelector('.how-stage');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) { return; }
  section.classList.add('has-3d');

  const { COLORS, std, clamp, lerp } = Padel3D;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);

  // Светлини: слънце за корта, предна и лайм светлина за ракетата, които угасват при корта
  scene.add(new THREE.HemisphereLight(0xdce8ff, 0x0a1a33, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(-7, 16, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(3, 17, 12);
  fill.target.position.set(0, 14, 0);
  scene.add(fill, fill.target);
  const glow = new THREE.PointLight(COLORS.lime, 0.8, 12);
  glow.position.set(-3.5, 15.5, -2.5);
  scene.add(glow);

  const court = Padel3D.buildCourt(scene);
  const LIME = new THREE.Color(COLORS.lime);
  const glowMat = () => new THREE.MeshBasicMaterial({ color: COLORS.lime, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const serveBox = new THREE.Mesh(new THREE.PlaneGeometry(5, 6.95), glowMat());
  serveBox.rotation.x = -Math.PI / 2;
  serveBox.position.set(-2.5, 0.015, -3.475);
  scene.add(serveBox);
  const wallEdges = [-1, 1].map(s => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(10, 0.06, 0.06), glowMat());
    m.position.set(0, 3, s * 10);
    scene.add(m);
    return m;
  });

  // Ракетата на слоеве: две карбонови повърхности, ядро от EVA, рамка, дръжка и каишка
  function weaveTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const x = i * 16, y = j * 16;
        const gr = (i + j) % 2 ? g.createLinearGradient(x, y, x + 16, y) : g.createLinearGradient(x, y, x, y + 16);
        gr.addColorStop(0, '#0e1930');
        gr.addColorStop(.5, '#2b4170');
        gr.addColorStop(1, '#0e1930');
        g.fillStyle = gr;
        g.fillRect(x, y, 16, 16);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(36, 36);
    return t;
  }
  function gripTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#f3f5f8';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(10,26,51,.22)';
    g.lineWidth = 3;
    for (let k = -64; k < 128; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 3);
    return t;
  }

  const shape = Padel3D.racketShape();
  const slab = (depth, mat) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 28 });
    geo.translate(0, 0, -depth / 2);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  };
  const faceMat = std(0xffffff, { map: weaveTexture(), roughness: .32, metalness: .35 });
  const faceFront = slab(0.004, faceMat);
  const faceBack = slab(0.004, faceMat);
  const core = new THREE.Group();
  core.add(slab(0.024, std(0xeef1f5, { roughness: .95 })));
  const outline = shape.getPoints(48).map(p => V(p.x, p.y, 0));
  if (outline[0].distanceTo(outline[outline.length - 1]) < 1e-6) outline.pop();
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 260, 0.0068, 8, true),
    std(COLORS.lime, { roughness: .4, emissive: COLORS.lime, emissiveIntensity: .25 }));
  rim.castShadow = true;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.016, 0.18, 20), std(0xffffff, { map: gripTexture(), roughness: .75 }));
  grip.position.y = 0.09;
  grip.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.014, 20), std(COLORS.lime));
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0045, 8, 40), std(0x2f6bff, { roughness: .6 }));
  strap.position.y = -0.055;
  core.add(rim, grip, cap, strap);

  const model = new THREE.Group();
  model.add(faceFront, core, faceBack);
  model.scale.setScalar(10);
  model.position.y = -2.3;
  const racket = new THREE.Group();
  racket.add(model);
  scene.add(racket);

  // Топка и траектории от параболични отсечки; линията се „рисува“ заедно с топката
  const BALL_R = 0.22;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 20),
    std(0xffffff, { map: Padel3D.ballTexture(), roughness: .6, emissive: COLORS.lime, emissiveIntensity: .25 }));
  ball.castShadow = true;
  scene.add(ball);
  const BALL_REST = V(1.7, BALL_R, 4.7);
  const LAND = V(3.1, 0.09, 3.4);

  function makePath(points, heights) {
    const pts = [];
    for (let i = 0; i < heights.length; i++) {
      for (let j = i ? 1 : 0; j <= 30; j++) {
        const k = j / 30;
        const p = new THREE.Vector3().lerpVectors(points[i], points[i + 1], k);
        p.y += 4 * heights[i] * k * (1 - k);
        pts.push(p);
      }
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: COLORS.lime, dashSize: .3, gapSize: .2, transparent: true, opacity: .85 }));
    line.computeLineDistances();
    line.visible = false;
    scene.add(line);
    return { points, pts, line };
  }
  function along(path, q, out) {
    const f = clamp(q, 0, 1) * (path.pts.length - 1);
    const i = Math.min(Math.floor(f), path.pts.length - 2);
    out.lerpVectors(path.pts[i], path.pts[i + 1], f - i);
    path.line.geometry.setDrawRange(0, i + 2);
    return out;
  }
  // Стените: удар → отскок на земята → стъклото → пак в игра
  const wallPath = makePath([V(1.8, 1.1, 7.4), V(-1.3, BALL_R, -6.1), V(-1.9, 1.5, -10 + BALL_R), V(-2.7, 1.05, -7.1)], [2.1, 0.55, 0.35]);
  // Сервисът: пускане → отскок зад линията → удар под кръста → диагоналния квадрат
  const servePath = makePath([V(2.5, 1.0, 8.3), V(2.5, BALL_R, 8.5), V(2.55, 0.8, 8.65), V(-2.3, BALL_R, -4.3), V(-2.9, 1.0, -8.2)], [0, 0.18, 1.3, 0.5]);

  const marker = (pos, flat) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 40), glowMat());
    m.position.copy(pos);
    if (flat) { m.rotation.x = -Math.PI / 2; m.position.y = 0.02; }
    else m.position.z = -9.97;
    scene.add(m);
    return m;
  };
  const markers = [
    { m: marker(wallPath.points[1], true), path: 'wall', at: 1 / 3 },
    { m: marker(wallPath.points[2], false), path: 'wall', at: 2 / 3 },
    { m: marker(servePath.points[1], true), path: 'serve', at: 1 / 4 },
    { m: marker(servePath.points[3], true), path: 'serve', at: 3 / 4 }
  ];

  // Ключови кадри по скрола: [прогрес, стойност], между тях — плавно
  function key(p, keys) {
    if (p <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (p <= keys[i][0]) {
        const [p0, v0] = keys[i - 1], [p1, v1] = keys[i];
        const k = (p - p0) / (p1 - p0);
        return lerp(v0, v1, k * k * (3 - 2 * k));
      }
    }
    return keys[keys.length - 1][1];
  }
  const K = {
    rise:    [[0, -3.5], [0.09, 0]],
    yaw:     [[0, -2.8], [0.09, 0.4], [0.15, -0.6], [0.22, 0.65], [0.29, -0.2], [0.34, -0.95], [0.48, -0.95], [0.53, -0.2]],
    roll:    [[0, 0.5], [0.09, -0.1], [0.15, 0.12], [0.22, -0.12], [0.29, 0]],
    pitch:   [[0.09, 0], [0.15, 0.2], [0.22, -0.15], [0.29, 0]],
    explode: [[0.32, 0], [0.38, 1], [0.47, 1], [0.52, 0]],
    fly:     [[0.5, 0], [0.6, 1]],
    shift:   [[0.09, 0], [0.12, 0.2], [0.29, 0.2], [0.32, -0.2], [0.49, -0.2], [0.55, 0], [0.6, 0.13], [0.71, 0.13], [0.74, -0.13], [0.83, -0.13], [0.86, 0.13], [1, 0.13]],
    shiftY:  [[0.08, -0.1], [0.11, 0]],
    shiftYm: [[0.08, -0.04], [0.11, 0.2]],
    az:      [[0.55, 1.1], [0.6, 0.55], [0.71, -0.6], [0.745, 0.7], [0.83, -0.3], [0.86, -0.55], [0.95, 0.4]],
    el:      [[0.55, 0.75], [0.6, 0.6], [0.71, 0.52], [0.74, 0.46], [0.83, 0.5], [0.86, 0.78], [0.95, 0.82]],
    walls:   [[0.72, 0], [0.75, 1], [0.83, 1], [0.86, 0]],
    box:     [[0.84, 0], [0.87, 1]],
    wallBall:  [[0.75, 0], [0.82, 1]],
    serveBall: [[0.87, 0], [0.94, 1]],
    ballSize:  [[0.56, 0.001], [0.6, 1], [0.735, 1], [0.745, 0.001], [0.75, 1], [0.84, 1], [0.855, 0.001], [0.865, 1]]
  };

  const camA = new THREE.Vector3(), camB = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  let wallQ = 0, serveQ = 0;
  function update(p) {
    // Ракетата: върти се наляво-надясно, разслоява се, после пада на корта
    const f = key(p, K.fly), ex = key(p, K.explode);
    racket.position.set(lerp(0, LAND.x, f), lerp(14 + key(p, K.rise), LAND.y, f), lerp(0, LAND.z, f));
    racket.rotation.set(
      lerp(key(p, K.pitch), -Math.PI / 2, f),
      lerp(key(p, K.yaw), 0, f) + Math.sin(f * Math.PI) * 2.4,
      lerp(key(p, K.roll), 0.65, f)
    );
    racket.scale.setScalar(lerp(1, 0.42, f));
    faceFront.position.z = 0.014 + ex * 0.13;
    faceBack.position.z = -0.014 - ex * 0.13;
    fill.intensity = 0.6 * (1 - f);
    glow.intensity = 0.8 * (1 - f);

    // Камерата: отблизо до ракетата → обикаля корта
    const az = key(p, K.az), el = key(p, K.el);
    const R = 28 * clamp(1.05 / camera.aspect, 1, 1.9);
    camB.set(Math.sin(az) * Math.cos(el) * R, 0.3 + Math.sin(el) * R, Math.cos(az) * Math.cos(el) * R);
    camA.set(0, 14, 13 * clamp(0.75 / camera.aspect, 1, 1.9));
    camera.position.lerpVectors(camA, camB, f);
    look.set(0, lerp(14, 0.3, f), 0);
    camera.lookAt(look);

    // Топката: лежи до ракетата, после показва стените и сервиса
    wallQ = key(p, K.wallBall);
    serveQ = key(p, K.serveBall);
    if (p < 0.745) ball.position.copy(BALL_REST);
    else if (p < 0.855) along(wallPath, wallQ, ball.position);
    else along(servePath, serveQ, ball.position);
    ball.scale.setScalar(key(p, K.ballSize));
    ball.rotation.set(p * 60, p * 25, 0);
    wallPath.line.visible = p >= 0.745 && p < 0.855;
    servePath.line.visible = p >= 0.855;
    for (const mk of markers) {
      const live = mk.path === 'wall' ? wallPath.line.visible : servePath.line.visible;
      const q = mk.path === 'wall' ? wallQ : serveQ;
      mk.m.material.opacity = live ? clamp((q - mk.at) * 25, 0, 1) * 0.9 : 0;
    }

    // Подсветки
    const wg = key(p, K.walls);
    court.glassMat.opacity = 0.09 + wg * 0.16;
    court.glassMat.color.setHex(0xffffff).lerp(LIME, wg * 0.6);
    wallEdges.forEach(m => { m.material.opacity = wg; });
    serveBox.material.opacity = key(p, K.box) * 0.3;
  }

  // Етикети, закачени за точки от сцената
  const labelBox = document.getElementById('how-labels');
  const labels = [
    ['holes', faceFront, V(0, 0.36, 0.003), p => p > 0.14 && p < 0.285],
    ['face', faceFront, V(0.075, 0.40, 0.003), p => p > 0.36 && p < 0.485],
    ['core', core, V(0.115, 0.26, 0), p => p > 0.37 && p < 0.485],
    // На телефон слоевете са близо един до друг — „Рамка“ би застъпила другите етикети
    ['frame', core, V(-0.128, 0.33, 0), p => p > 0.38 && p < 0.485 && w >= 760],
    ['grip', core, V(0, 0.07, 0.02), p => p > 0.39 && p < 0.485],
    ['length', null, V(5.2, 0.05, 1.5), p => p > 0.615 && p < 0.71],
    ['width', null, V(-2.5, 3.05, -10), p => p > 0.625 && p < 0.71],
    ['net', null, V(-3.2, 0.95, 0), p => p > 0.635 && p < 0.71],
    ['bounce', null, wallPath.points[1], p => p < 0.845 && wallQ > 0.34],
    ['glass', null, wallPath.points[2], p => p < 0.845 && wallQ > 0.67],
    ['again', null, wallPath.points[3], p => p < 0.845 && wallQ > 0.98],
    ['sdrop', null, servePath.points[1], p => serveQ > 0.26],
    ['sbox', null, V(-2.5, 0, -3.2), p => serveQ > 0.76]
  ].map(([k, obj, at, show]) => ({ el: labelBox.querySelector(`[data-key="${k}"]`), obj, at, show, on: false, flip: false }));

  let w = 0, h = 0;
  function placeLabels(p) {
    const mobile = w < 760;
    for (const l of labels) {
      let on = !!l.el && l.show(p);
      if (on) {
        tmp.copy(l.at);
        if (l.obj) l.obj.localToWorld(tmp);
        tmp.project(camera);
        // На телефон долната част е заета от текста
        on = tmp.z < 1 && Math.abs(tmp.x) < 0.96 && tmp.y < 0.92 && tmp.y > (mobile ? -0.1 : -0.92);
        if (on) {
          const x = (tmp.x + 1) / 2 * w, y = (1 - tmp.y) / 2 * h;
          const flip = x > w * 0.55;
          if (flip !== l.flip) { l.flip = flip; l.el.classList.toggle('flip', flip); }
          l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)${flip ? ' translateX(-100%)' : ''}`;
        }
      }
      if (on !== l.on) { l.on = on; l.el.classList.toggle('on', on); }
    }
  }

  // Текстове, стъпки, лента за прогреса
  const hint = document.getElementById('how-hint');
  const bar = document.getElementById('how-bar');
  const stepsEl = document.getElementById('how-steps');
  const ranged = el => ({ el, from: +el.dataset.in, to: +el.dataset.out, on: false });
  const panels = [...section.querySelectorAll('.how-panel')].map(ranged);
  const steps = [...stepsEl.querySelectorAll('button')].map(ranged);
  const span = () => track.offsetHeight - stage.offsetHeight;
  steps.forEach(s => s.el.addEventListener('click', () => {
    const top = track.getBoundingClientRect().top + window.scrollY + span() * (s.from + 0.04);
    window.scrollTo({ top, behavior: 'smooth' });
  }));
  function ui(p) {
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    hint.classList.toggle('off', p > 0.02);
    stepsEl.classList.toggle('show', p > 0.095);
    for (const x of panels.concat(steps)) {
      const on = p >= x.from && p < x.to;
      if (on !== x.on) { x.on = on; x.el.classList.toggle('on', on); }
    }
  }

  function render(p) {
    update(p);
    const mobile = w < 760;
    // Изместваме кадъра встрани от текста (на телефон — нагоре)
    const sx = mobile ? 0 : key(p, K.shift) * w;
    const sy = key(p, mobile ? K.shiftYm : K.shiftY) * h;
    camera.setViewOffset(w, h, -sx, sy, w, h);
    scene.updateMatrixWorld();
    renderer.render(scene, camera);
    placeLabels(p);
    ui(p);
  }

  let shown = -1;
  function resize() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    shown = -1;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function progress() {
    const s = span();
    return s > 0 ? clamp(-track.getBoundingClientRect().top / s, 0, 1) : 0;
  }

  // Рисуваме само докато секцията е на екрана и само когато скролът се е променил
  let active = false, snap = true, cur = 0, last = performance.now();
  new IntersectionObserver(([e]) => {
    active = e.isIntersecting;
    if (active) snap = true;
  }, { rootMargin: '100px 0px' }).observe(track);
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    if (active && w) {
      const t = progress();
      // Плавно догонване на скрола; при влизане в секцията — направо на място
      cur = snap || Math.abs(t - cur) < 0.0002 ? t : lerp(cur, t, 1 - Math.exp(-dt * 8));
      snap = false;
      if (cur !== shown) { render(cur); shown = cur; }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
