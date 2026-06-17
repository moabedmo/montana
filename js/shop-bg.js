(function () {
  try {
  var canvas = document.getElementById('shop-bg-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x231840, 1);

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2A204E, 0.0095);

  var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 150);
  camera.position.set(0, 0, 14);

  var ambL = new THREE.AmbientLight(0x2A1548, 1.6);
  scene.add(ambL);

  var pl1 = new THREE.PointLight(0x7C3AED, 3.2, 70);
  pl1.position.set(8, 6, 12);
  scene.add(pl1);

  var pl2 = new THREE.PointLight(0x5B21B6, 2.2, 55);
  pl2.position.set(-8, -5, 10);
  scene.add(pl2);

  var pl3 = new THREE.PointLight(0x8B5CF6, 1.8, 45);
  pl3.position.set(0, 12, 6);
  scene.add(pl3);

  var rg = new THREE.Group();
  scene.add(rg);
  [
    [2.2, 0.008, 0x8B5CF6, 0.40, 0.30, 0.10, 0.00, 0.0035],
    [4.0, 0.006, 0x7C3AED, 0.32, 0.10, 0.40, 0.20, -0.0025],
    [6.0, 0.005, 0x7C3AED, 0.26, 0.50, 0.20, 0.10, 0.0018],
    [8.2, 0.004, 0x6D28D9, 0.20, 0.15, 0.55, 0.30, -0.0013],
    [10.5, 0.004, 0x6D28D9, 0.16, 0.35, 0.10, 0.45, 0.0009],
    [1.5, 0.009, 0xA78BFA, 0.44, 0.60, 0.30, 0.20, -0.0042],
    [5.0, 0.005, 0x8B5CF6, 0.28, 0.20, 0.60, 0.15, 0.0016]
  ].forEach(function (cfg) {
    var m = new THREE.Mesh(
      new THREE.TorusGeometry(cfg[0], cfg[1], 3, 128),
      new THREE.MeshBasicMaterial({ color: cfg[2], transparent: true, opacity: cfg[3] })
    );
    m.rotation.set(cfg[4], cfg[5], cfg[6]);
    m.userData = { spd: cfg[7] };
    rg.add(m);
  });

  var sg = new THREE.Group();
  scene.add(sg);
  for (var i = 0; i < 18; i++) {
    var pts = [];
    var ox = (Math.random() - 0.5) * 26;
    var oy = (Math.random() - 0.5) * 18;
    var oz = -10 - Math.random() * 12;
    var L = 5 + Math.random() * 7;
    var amp = 0.3 + Math.random() * 0.7;
    var fr = 1.2 + Math.random() * 2;
    for (var j = 0; j < 22; j++) {
      var t = j / 21;
      pts.push(new THREE.Vector3(
        ox + Math.sin(t * fr * Math.PI) * amp,
        oy + (t - 0.5) * L,
        oz + Math.cos(t * fr * Math.PI * 1.4) * amp * 0.4
      ));
    }
    var h = 255 + Math.random() * 28;
    var sm = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.007 + Math.random() * 0.012, 4, false),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('hsl(' + h + ',68%,62%)'),
        transparent: true,
        opacity: 0.14 + Math.random() * 0.18
      })
    );
    sm.userData = { ph: Math.random() * Math.PI * 2, spd: (Math.random() - 0.5) * 0.0007 };
    sg.add(sm);
  }

  var hg = new THREE.Group();
  scene.add(hg);
  var HR = 2.0;
  var HW = HR * Math.sqrt(3);
  for (var row = -4; row <= 4; row++) {
    for (var col = -5; col <= 5; col++) {
      var hexPts = [];
      for (var k = 0; k <= 6; k++) {
        var a = k / 6 * Math.PI * 2 - Math.PI / 6;
        hexPts.push(new THREE.Vector3(Math.cos(a) * HR, Math.sin(a) * HR, 0));
      }
      var hm = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(hexPts),
        new THREE.LineBasicMaterial({ color: 0x8B5CF6, transparent: true, opacity: 0.09 + Math.random() * 0.11 })
      );
      hm.position.set(col * HW + (row % 2) * HW * 0.5, row * HR * 1.5, -16 - Math.random() * 8);
      hm.rotation.z = Math.random() * 0.2;
      hg.add(hm);
    }
  }

  var PC = 500;
  var ptG = new THREE.BufferGeometry();
  var ptP = new Float32Array(PC * 3);
  var ptC = new Float32Array(PC * 3);
  var ptPH = new Float32Array(PC);
  for (var pi = 0; pi < PC; pi++) {
    ptP[pi * 3] = (Math.random() - 0.5) * 44;
    ptP[pi * 3 + 1] = (Math.random() - 0.5) * 28;
    ptP[pi * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
    var tint = Math.random();
    ptC[pi * 3] = 0.35 + tint * 0.25;
    ptC[pi * 3 + 1] = 0.18 + tint * 0.12;
    ptC[pi * 3 + 2] = 0.65 + tint * 0.2;
    ptPH[pi] = Math.random() * Math.PI * 2;
  }
  ptG.setAttribute('position', new THREE.BufferAttribute(ptP, 3));
  ptG.setAttribute('color', new THREE.BufferAttribute(ptC, 3));
  scene.add(new THREE.Points(ptG, new THREE.PointsMaterial({
    size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.28, vertexColors: true
  })));

  var mouseX = 0;
  var mouseY = 0;
  var camCurX = 0;
  var camCurY = 0;
  var camCurZ = 14;
  var t = 0;

  document.addEventListener('mousemove', function (e) {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  (function tick() {
    requestAnimationFrame(tick);
    t += 0.007;

    var targX = mouseX * 0.35;
    var targY = -mouseY * 0.25;
    camCurX += (targX - camCurX) * 0.04;
    camCurY += (targY - camCurY) * 0.04;
    camCurZ += (14 - camCurZ) * 0.02;
    camera.position.set(camCurX, camCurY + Math.sin(t * 0.28) * 0.1, camCurZ);
    camera.lookAt(mouseX * 0.25, mouseY * 0.15, 0);

    rg.children.forEach(function (m) {
      m.rotation.y += m.userData.spd;
      m.rotation.z += m.userData.spd * 0.3;
    });
    rg.rotation.y = t * 0.006;
    rg.rotation.x = Math.sin(t * 0.1) * 0.025;

    sg.children.forEach(function (m) {
      m.rotation.y += m.userData.spd;
      m.position.y += Math.sin(t * 0.35 + m.userData.ph) * 0.0006;
    });
    sg.rotation.y = -t * 0.004;

    hg.rotation.z = t * 0.008;
    hg.rotation.y = Math.sin(t * 0.07) * 0.03;

    pl1.position.x = Math.sin(t * 0.42) * 9;
    pl1.position.z = Math.cos(t * 0.42) * 9 + 6;
    pl3.position.x = Math.cos(t * 0.34) * 7;
    pl3.position.y = Math.sin(t * 0.34) * 6;
    pl2.position.x = Math.sin(t * 0.28 + 2) * 5;
    pl2.position.y = Math.cos(t * 0.28 + 2) * 4;

    var pa = ptG.attributes.position.array;
    for (var i = 0; i < PC; i++) {
      pa[i * 3 + 1] += 0.0022;
      pa[i * 3] += Math.sin(t + ptPH[i]) * 0.0006;
      if (pa[i * 3 + 1] > 14) pa[i * 3 + 1] = -14;
    }
    ptG.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  })();
  } catch (e) { /* background optional */ }
})();
