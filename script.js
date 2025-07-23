const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('scene-container').appendChild(renderer.domElement);

camera.position.z = 80;

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = false;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI / 2 + 0.5;
controls.minPolarAngle = Math.PI / 2 - 0.5;

const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,
    0.4,
    0.85
);
const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

const starVertices = [];
for (let i = 0; i < 10000; i++) {
    const x = (Math.random() - 0.5) * 2000;
    const y = (Math.random() - 0.5) * 2000;
    const z = (Math.random() - 0.5) * 2000;
    starVertices.push(x, y, z);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

const textureLoader = new THREE.TextureLoader();
const fontLoader = new THREE.FontLoader();
const dummy = new THREE.Object3D();

const PHOTO_COUNT = 20;
const TEXT_COUNT = 70;
const HEART_COUNT = 60;

const instancedMeshesToUpdate = [];

const photoFiles = ['photo1.jpg', 'photo2.jpg', 'photo3.jpg', 'photo4.jpg', 'photo5.jpg', 'photo6.jpg'];
const photoTextures = photoFiles.map(file => textureLoader.load(file));
const photoGeometry = new THREE.BoxGeometry(25, 25, 0.1);

for (let i = 0; i < photoTextures.length; i++) {
    const photoMaterial = new THREE.MeshBasicMaterial({ map: photoTextures[i] });
    const instanceCount = Math.ceil(PHOTO_COUNT / photoTextures.length);
    const photoMesh = new THREE.InstancedMesh(photoGeometry, photoMaterial, instanceCount);

    for (let j = 0; j < instanceCount; j++) {
        dummy.position.set(
            (Math.random() - 0.5) * 150,
            Math.random() * 270 - 120,
            (Math.random() - 0.5) * 150
        );
        dummy.rotation.set(0, Math.random() * Math.PI, 0);
        dummy.updateMatrix();
        photoMesh.setMatrixAt(j, dummy.matrix);
    }
    scene.add(photoMesh);
    instancedMeshesToUpdate.push({ mesh: photoMesh, type: 'photo' });
}

fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font) {
    const textGeometry = new THREE.TextGeometry('Thinking about u', {
        font: font,
        size: 5,
        height: 0.5,
    });
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0xff69b4 });
    const textMesh = new THREE.InstancedMesh(textGeometry, textMaterial, TEXT_COUNT);

    for (let i = 0; i < TEXT_COUNT; i++) {
        dummy.position.set(
            (Math.random() - 0.5) * 200,
            Math.random() * 270 - 120,
            (Math.random() - 0.5) * 200
        );
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        textMesh.setMatrixAt(i, dummy.matrix);
    }
    scene.add(textMesh);
    instancedMeshesToUpdate.push({ mesh: textMesh, type: 'text' });
});

const heartTexture = textureLoader.load('heart.png');
const heartMaterial = new THREE.MeshBasicMaterial({ map: heartTexture, color: 0xff0000, transparent: true, side: THREE.DoubleSide });
const heartGeometry = new THREE.PlaneGeometry(4, 4);
const heartMesh = new THREE.InstancedMesh(heartGeometry, heartMaterial, HEART_COUNT);

for (let i = 0; i < HEART_COUNT; i++) {
    dummy.position.set(
        (Math.random() - 0.5) * 200,
        Math.random() * 270 - 120,
        (Math.random() - 0.5) * 200
    );
    dummy.updateMatrix();
    heartMesh.setMatrixAt(i, dummy.matrix);
}
scene.add(heartMesh);
instancedMeshesToUpdate.push({ mesh: heartMesh, type: 'heart' });

const BUTTERFLY_COUNT = 22;

const butterflyVertexShader = `
    uniform float uTime;
    attribute vec3 aOffset;
    attribute float aSpeed;
    attribute float aFlutter;
    attribute float aLifetime;
    attribute float aScale;
    varying vec2 vUv;
    varying float vLifetime;
    varying float vSpeed;
    void main() {
        vUv = uv;
        vLifetime = aLifetime;
        vSpeed = aSpeed;
        float time = uTime * 0.2 * aSpeed;
        float angle = time + aOffset.z;
        vec3 pos = vec3(0.0);
        pos.x = cos(angle) * (aOffset.x + sin(time * 1.2) * 2.0);
        pos.z = sin(angle) * (aOffset.x + cos(time * 1.5) * 2.0);
        pos.y = sin(time * 0.8) * 10.0 + aOffset.y + cos(angle) * 3.0;
        float flutterSpeed = uTime * 20.0 * aFlutter;
        float flutterAmount = sin(flutterSpeed) * 0.5 * step(0.0, position.x) - sin(flutterSpeed) * 0.5 * step(position.x, 0.0);
        pos.y += flutterAmount;
        vec4 modelViewPosition = modelViewMatrix * vec4(pos, 1.0);
        modelViewPosition.xyz *= aScale;
        modelViewPosition.xyz += position; 
        gl_Position = projectionMatrix * modelViewPosition;
    }
`;

const butterflyFragmentShader = `
    uniform float uTime;
    uniform sampler2D uTexture;
    varying vec2 vUv;
    varying float vLifetime;
    varying float vSpeed;
    void main() {
        float lifeProgress = mod(uTime * 0.2 * vSpeed, vLifetime) / vLifetime;
        float fadeTime = 0.2; 
        float alpha = 1.0;
        if (lifeProgress < fadeTime) {
            alpha = lifeProgress / fadeTime;
        } else if (lifeProgress > 1.0 - fadeTime) {
            alpha = (1.0 - lifeProgress) / fadeTime;
        }
        vec4 textureColor = texture2D(uTexture, vUv);
        gl_FragColor = vec4(textureColor.rgb, textureColor.a * alpha);
    }
`;

const butterflyTexture = textureLoader.load('butterfly.png');
const butterflyGeometry = new THREE.PlaneGeometry(3, 3);

const offsets = new Float32Array(BUTTERFLY_COUNT * 3);
const speeds = new Float32Array(BUTTERFLY_COUNT);
const flutters = new Float32Array(BUTTERFLY_COUNT);
const lifetimes = new Float32Array(BUTTERFLY_COUNT);
const scales = new Float32Array(BUTTERFLY_COUNT);

for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    const i3 = i * 3;
    offsets[i3 + 0] = Math.random() * 40 + 20;
    offsets[i3 + 1] = (Math.random() - 0.5) * 50;
    offsets[i3 + 2] = Math.random() * Math.PI * 2;
    speeds[i] = Math.random() * 0.5 + 0.2;
    flutters[i] = Math.random() * 0.5 + 0.2;
    lifetimes[i] = Math.random() * 10.0 + 10.0;
    scales[i] = Math.random() * 0.5 + 0.5;
}

butterflyGeometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
butterflyGeometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
butterflyGeometry.setAttribute('aFlutter', new THREE.InstancedBufferAttribute(flutters, 1));
butterflyGeometry.setAttribute('aLifetime', new THREE.InstancedBufferAttribute(lifetimes, 1));
butterflyGeometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));

const butterflyMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uTexture: { value: butterflyTexture }
    },
    vertexShader: butterflyVertexShader,
    fragmentShader: butterflyFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
});

const butterflyMesh = new THREE.InstancedMesh(butterflyGeometry, butterflyMaterial, BUTTERFLY_COUNT);
scene.add(butterflyMesh);

const PARTICLE_COUNT = 300;

const particleVertexShader = `
    uniform float uTime;
    attribute float aScale;
    attribute vec3 aRandom;
    void main() {
        vec3 pos = position;
        pos.y += sin(uTime * 0.5 + aRandom.x * 10.0) * aRandom.y * 20.0;
        pos.x += cos(uTime * 0.4 + aRandom.y * 10.0) * aRandom.z * 15.0;
        vec4 modelViewPosition = modelViewMatrix * vec4(pos, 1.0);
        vec4 viewPosition = viewMatrix * modelViewPosition;
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = aScale * 20.0 * (1.0 / -viewPosition.z);
    }
`;

const particleFragmentShader = `
    void main() {
        float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
        float strength = 1.0 - (distanceToCenter * 2.0);
        gl_FragColor = vec4(1.0, 1.0, 1.0, strength);
    }
`;

const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
const particleScales = new Float32Array(PARTICLE_COUNT);
const particleRandoms = new Float32Array(PARTICLE_COUNT * 3);

for(let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    particlePositions[i3 + 0] = (Math.random() - 0.5) * 150;
    particlePositions[i3 + 1] = (Math.random() - 0.5) * 200;
    particlePositions[i3 + 2] = (Math.random() - 0.5) * 150;
    particleScales[i] = Math.random() * 0.5 + 0.2;
    particleRandoms[i3 + 0] = Math.random();
    particleRandoms[i3 + 1] = Math.random();
    particleRandoms[i3 + 2] = Math.random();
}
particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particleGeometry.setAttribute('aScale', new THREE.BufferAttribute(particleScales, 1));
particleGeometry.setAttribute('aRandom', new THREE.BufferAttribute(particleRandoms, 3));

const particleMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }},
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const glowingParticles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(glowingParticles);

const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    stars.rotation.y += 0.0001;

    scene.rotation.y = THREE.MathUtils.lerp(scene.rotation.y, (mouse.x * Math.PI) / 20, 0.05);
    scene.rotation.x = THREE.MathUtils.lerp(scene.rotation.x, (mouse.y * Math.PI) / 20, 0.05);

    instancedMeshesToUpdate.forEach(instanced => {
        const mesh = instanced.mesh;
        for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
            dummy.position.y -= (0.15 + Math.random() * 0.02);
            dummy.position.x += Math.sin(elapsedTime + dummy.position.y * 0.5) * 0.05;
            if (instanced.type === 'photo') {
                dummy.lookAt(camera.position);
            }
            if (instanced.type === 'heart') {
                dummy.rotation.copy(camera.rotation);
                const scaleValue = 1 + Math.sin(elapsedTime * 5 + dummy.position.x) * 0.15;
                dummy.scale.set(scaleValue, scaleValue, scaleValue);
            }
            if (dummy.position.y < -120) {
                dummy.position.y = 150;
                dummy.position.x = (Math.random() - 0.5) * 200;
                dummy.position.z = (Math.random() - 0.5) * 200;
            }
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });

    butterflyMaterial.uniforms.uTime.value = elapsedTime;
    particleMaterial.uniforms.uTime.value = elapsedTime;

    controls.update();
    composer.render();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(window.innerWidth, window.innerHeight);
});

const music = document.getElementById('background-music');
music.play().catch(error => {
    console.warn("Browser Autoplay Policy ကြောင့် သီချင်းကို အလိုအလျောက်ဖွင့်မရပါ:", error);
});

animate();
