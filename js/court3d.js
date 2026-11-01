// 3D корт: две ракети си разменят топката. Без WebGL остава CSS кортът.
(function court3D() {
  const wrap = document.querySelector('.court-wrap');
  const canvas = document.getElementById('court3d');
  if (!Padel3D || !wrap || !canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) { return; }
  wrap.classList.add('has-3d');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const lookAt = new THREE.Vector3(-0.6, 0.4, 1.5);

  const { COLORS, std, clamp, lerp, easeInOut, easeIn, easeOut } = Padel3D;
  const rand = (a, b) => a + Math.random() * (b - a);

  // Светлини
  scene.add(new THREE.HemisphereLight(0xdce8ff, 0x0a1a33, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(-7, 16, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  Padel3D.buildCourt(scene);

  // Ракета: перфорирана глава с лайм кант и бяла дръжка
  function makeRacket() {
    const s = Padel3D.racketShape();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 28 });
    geo.translate(0, 0, -0.015);
    const head = new THREE.Mesh(geo, [
      std(0x13284f, { roughness: .35, metalness: .35 }),
      std(COLORS.lime, { roughness: .4, emissive: COLORS.lime, emissiveIntensity: .2 })
    ]);
    head.castShadow = true;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.016, 0.18, 16), std(COLORS.white, { roughness: .7 }));
    grip.position.y = 0.09;
    grip.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.014, 16), std(COLORS.lime));
    const racket = new THREE.Group();
    racket.add(head, grip, cap);
    racket.scale.setScalar(3.6);
    return racket;
  }

  // Играч = невидимо „рамо“, около което ракетата замахва
  const HIT_Y = 1.05, HIT_Z = 8.6;
  function makePlayer(side) {
    const body = new THREE.Group();
    body.rotation.y = side > 0 ? 0 : Math.PI;
    const shoulder = new THREE.Group();
    const racket = makeRacket();
    racket.rotation.z = -Math.PI / 2 + 0.35;
    racket.position.set(0.35, 0, 0);
    shoulder.add(racket);
    body.add(shoulder);
    scene.add(body);
    // Отместване от рамото до центъра на главата в момента на удара
    body.position.set(0, 0, 0);
    body.updateMatrixWorld(true);
    const reach = racket.localToWorld(new THREE.Vector3(0, 0.32, 0));
    const player = { side, body, shoulder, racket, reach, hitTime: -10, target: new THREE.Vector3() };
    player.target.set(-reach.x, HIT_Y - reach.y, side * HIT_Z - reach.z);
    body.position.copy(player.target);
    return player;
  }
  const near = makePlayer(1);
  const far = makePlayer(-1);

  // Ъгъл на замаха спрямо момента на удара (r = 0)
  function swingAngle(r) {
    if (r < -0.8) return -0.35;
    if (r < -0.22) return lerp(-0.35, -1.5, easeOut((r + 0.8) / 0.58));
    if (r < 0) return lerp(-1.5, 0, easeIn((r + 0.22) / 0.22));
    if (r < 0.28) return lerp(0, 1.35, easeOut(r / 0.28));
    if (r < 1.0) return lerp(1.35, -0.35, easeInOut((r - 0.28) / 0.72));
    return -0.35;
  }

  // Топка с шев
  const ballTex = Padel3D.ballTexture();
  const BALL_R = 0.22;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 20),
    std(0xffffff, { map: ballTex, roughness: .6, emissive: COLORS.lime, emissiveIntensity: .25 }));
  ball.castShadow = true;
  scene.add(ball);

  // Следа зад топката
  const TRAIL = 12;
  const trail = [];
  for (let i = 0; i < TRAIL; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * (1 - i / TRAIL) * 0.9, 12, 8),
      new THREE.MeshBasicMaterial({ color: COLORS.lime, transparent: true, opacity: 0.35 * (1 - i / TRAIL), depthWrite: false }));
    scene.add(m);
    trail.push(m);
  }
  const history = [];

  // Пръстени при удар и отскок
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 40),
      new THREE.MeshBasicMaterial({ color: COLORS.lime, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    scene.add(m);
    rings.push({ mesh: m, born: -10 });
  }
  let ringIndex = 0;
  function flash(pos, flat, time) {
    const r = rings[ringIndex++ % rings.length];
    r.mesh.position.copy(pos);
    r.mesh.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
    r.born = time;
  }

  // Удар: дъга над мрежата → отскок → към ракетата на другия играч
  function makeShot(from, toSide, t0) {
    const bounce = new THREE.Vector3(rand(-3.4, 3.4), BALL_R, toSide * rand(4.6, 6.4));
    const to = new THREE.Vector3(clamp(bounce.x + rand(-1.2, 1.2), -3.6, 3.6), HIT_Y + rand(-0.12, 0.18), toSide * HIT_Z);
    const d1 = 0.55 + from.distanceTo(bounce) * 0.035;
    const d2 = 0.42;
    const receiver = toSide > 0 ? near : far;
    receiver.hitTime = t0 + d1 + d2;
    receiver.target.set(to.x - receiver.reach.x, to.y - receiver.reach.y, to.z - receiver.reach.z);
    return { from: from.clone(), bounce, to, t0, d1, d2, h1: rand(1.5, 2.2), h2: rand(0.5, 0.8), toSide, receiver, bounced: false };
  }
  function ballAt(s, t, out) {
    const u = Math.max(0, t - s.t0);
    if (u < s.d1) {
      const k = u / s.d1;
      out.lerpVectors(s.from, s.bounce, k);
      out.y = lerp(s.from.y, s.bounce.y, k) + 4 * s.h1 * k * (1 - k);
    } else {
      const k = Math.min((u - s.d1) / s.d2, 1);
      out.lerpVectors(s.bounce, s.to, k);
      out.y = lerp(s.bounce.y, s.to.y, k) + 4 * s.h2 * k * (1 - k);
    }
    return out;
  }

  const start = new THREE.Vector3(0, HIT_Y, -HIT_Z);
  far.hitTime = 0;
  far.target.set(start.x - far.reach.x, start.y - far.reach.y, start.z - far.reach.z);
  far.body.position.copy(far.target);
  let shot = makeShot(start, 1, 0);
  let sim = -0.7;
  const tmp = new THREE.Vector3();

  function update(dt) {
    sim += dt;

    if (!shot.bounced && sim >= shot.t0 + shot.d1) {
      shot.bounced = true;
      flash(tmp.copy(shot.bounce).setY(0.02), true, sim);
    }
    if (sim >= shot.t0 + shot.d1 + shot.d2) {
      const hitter = shot.receiver;
      flash(shot.to, false, sim);
      const prevTo = shot.to;
      shot = makeShot(prevTo, -shot.toSide, sim);
      // Ударилият се връща към центъра на своята половина
      hitter.target.set(-hitter.reach.x, HIT_Y - hitter.reach.y, hitter.side * HIT_Z - hitter.reach.z);
    }

    ballAt(shot, sim, ball.position);
    ball.rotation.x += dt * 14 * shot.toSide;
    ball.rotation.z += dt * 4;

    history.unshift(ball.position.clone());
    if (history.length > TRAIL * 2) history.pop();
    trail.forEach((m, i) => {
      const p = history[Math.min(i * 2 + 1, history.length - 1)];
      m.position.copy(p);
    });

    for (const p of [near, far]) {
      const k = 1 - Math.exp(-dt * 5);
      p.body.position.x = lerp(p.body.position.x, p.target.x, k);
      p.body.position.y = lerp(p.body.position.y, p.target.y, k);
      p.body.position.z = lerp(p.body.position.z, p.target.z, k);
      const r = sim - p.hitTime;
      p.shoulder.rotation.y = swingAngle(r);
      p.racket.rotation.x = Math.sin(sim * 3 + p.side) * 0.08;
    }

    for (const r of rings) {
      const age = sim - r.born;
      const life = 0.45;
      if (age >= 0 && age < life) {
        const k = age / life;
        r.mesh.scale.setScalar(1 + easeOut(k) * 3);
        r.mesh.material.opacity = 0.9 * (1 - k);
      } else {
        r.mesh.material.opacity = 0;
      }
    }
  }

  // Камера: бавно се полюшва и леко следва мишката
  let px = 0, py = 0, mx = 0, my = 0;
  document.querySelector('.hero').addEventListener('pointermove', e => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  });
  function placeCamera(time) {
    px = lerp(px, mx, 0.04);
    py = lerp(py, my, 0.04);
    const az = 0.34 + Math.sin(time * 0.18) * 0.06 + px * 0.05;
    const el = 0.56 + py * 0.03;
    const R = 28.5;
    camera.position.set(
      lookAt.x + Math.sin(az) * Math.cos(el) * R,
      lookAt.y + Math.sin(el) * R,
      lookAt.z + Math.cos(az) * Math.cos(el) * R
    );
    camera.lookAt(lookAt);
  }

  let staticFrame = false;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // setSize изчиства платното — статичният кадър трябва да се нарисува наново
    if (staticFrame) renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  if (reduceMotion) {
    update(0.9);
    placeCamera(0);
    staticFrame = true;
    renderer.render(scene, camera);
    return;
  }

  // Рендерираме само докато кортът се вижда
  let visible = true, last = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  function frame(now) {
    // rAF понякога подава време преди last — отрицателна стъпка би взривила плавното следване
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    if (visible) {
      update(dt);
      placeCamera(now / 1000);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
