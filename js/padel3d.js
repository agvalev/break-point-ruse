// Общо за двете 3D сцени: материали, текстури, кортът и формата на ракетата
const Padel3D = window.THREE ? (() => {
  const COLORS = { navy: 0x0a1a33, navy2: 0x102647, court: 0x1f56e0, lime: 0xd4ff3d, white: 0xffffff };
  const std = (color, opts) => new THREE.MeshStandardMaterial(Object.assign({ color }, opts));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeIn = t => t * t * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  // Текстура-мрежа за мрежата на корта и оградата
  function gridTexture(diagonal, alpha) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = 1.5;
    g.beginPath();
    if (diagonal) { g.moveTo(0, 0); g.lineTo(32, 32); g.moveTo(32, 0); g.lineTo(0, 32); }
    else { g.moveTo(0, 1); g.lineTo(32, 1); g.moveTo(1, 0); g.lineTo(1, 32); }
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // Под, линии, мрежа, стъклени стени, ограда и колони
  function buildCourt(scene) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.3, 21.6), std(COLORS.navy2, { roughness: .9 }));
    base.position.y = -0.16;
    base.receiveShadow = true;
    scene.add(base);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 20), std(COLORS.court, { roughness: .85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const lineMat = std(COLORS.white, { roughness: .6 });
    const line = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, d), lineMat);
      m.position.set(x, 0.006, z);
      m.receiveShadow = true;
      scene.add(m);
    };
    line(10, .06, 0, 6.95); line(10, .06, 0, -6.95); line(.06, 13.9, 0, 0);
    line(.06, 20, -4.97, 0); line(.06, 20, 4.97, 0); line(10, .06, 0, 9.97); line(10, .06, 0, -9.97);

    const netTex = gridTexture(false, .55);
    netTex.repeat.set(70, 6);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(10, .84),
      new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    net.position.set(0, .46, 0);
    scene.add(net);
    const band = new THREE.Mesh(new THREE.BoxGeometry(10, .07, .04), std(COLORS.white));
    band.position.set(0, .9, 0);
    band.castShadow = true;
    scene.add(band);

    const postMat = std(0x2a4677, { metalness: .5, roughness: .45 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .09, roughness: .1, side: THREE.DoubleSide, depthWrite: false });
    const fenceTex = gridTexture(true, .3);
    fenceTex.repeat.set(40, 8);
    const fenceMat = new THREE.MeshBasicMaterial({ map: fenceTex, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false });

    const panel = (w, h, x, z, ry, material) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
      m.position.set(x, h / 2, z);
      m.rotation.y = ry;
      scene.add(m);
    };
    const box = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), postMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      scene.add(m);
    };
    for (const s of [-1, 1]) {
      panel(10, 3, 0, s * 10, 0, glassMat);
      panel(2, 3, -5, s * 9, Math.PI / 2, glassMat);
      panel(2, 3, 5, s * 9, Math.PI / 2, glassMat);
      panel(16, 3, s * 5, 0, Math.PI / 2, fenceMat);
      for (const x of [-5, -2.5, 0, 2.5, 5]) box(.06, 3, .06, x, 1.5, s * 10);
      for (let z = -8; z <= 8; z += 4) box(.06, 3, .06, s * 5, 1.5, z);
      box(10, .04, .04, 0, 3, s * 10);
      box(.04, .04, 20, s * 5, 3, 0);
      box(.1, 1, .1, s * 5.1, .5, 0);
    }
    return { glassMat };
  }

  // Капковидна перфорирана глава, в метри: гърлото започва от y = 0.17, дръжката е под него
  function racketShape() {
    const s = new THREE.Shape();
    s.moveTo(-0.03, 0.17);
    s.bezierCurveTo(-0.08, 0.2, -0.13, 0.24, -0.13, 0.31);
    s.bezierCurveTo(-0.13, 0.41, -0.07, 0.455, 0, 0.455);
    s.bezierCurveTo(0.07, 0.455, 0.13, 0.41, 0.13, 0.31);
    s.bezierCurveTo(0.13, 0.24, 0.08, 0.2, 0.03, 0.17);
    s.lineTo(-0.03, 0.17);
    for (let ix = -3; ix <= 3; ix++) {
      for (let iy = -3; iy <= 3; iy++) {
        const hx = ix * 0.03, hy = 0.33 + iy * 0.03;
        if ((hx / 0.1) ** 2 + ((hy - 0.33) / 0.1) ** 2 < 1) {
          const hole = new THREE.Path();
          hole.absarc(hx, hy, 0.0095, 0, Math.PI * 2, true);
          s.holes.push(hole);
        }
      }
    }
    return s;
  }

  // Лайм топка с бял шев
  function ballTexture() {
    const bc = document.createElement('canvas');
    bc.width = 256; bc.height = 128;
    const bg = bc.getContext('2d');
    bg.fillStyle = '#d4ff3d';
    bg.fillRect(0, 0, 256, 128);
    bg.strokeStyle = 'rgba(255,255,255,.95)';
    bg.lineWidth = 7;
    bg.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = 64 + Math.sin(x / 256 * Math.PI * 4) * 30;
      x ? bg.lineTo(x, y) : bg.moveTo(x, y);
    }
    bg.stroke();
    return new THREE.CanvasTexture(bc);
  }

  return { COLORS, std, clamp, lerp, easeInOut, easeIn, easeOut, buildCourt, racketShape, ballTexture };
})() : null;
