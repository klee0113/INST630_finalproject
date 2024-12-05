import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Load HDRI environment
const pmremGenerator = new THREE.PMREMGenerator(renderer);
new RGBELoader()
  .setPath('/textures/')
  .load('bg.hdr', (hdrTexture) => {
    const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
    scene.environment = envMap;
    scene.background = envMap;
    hdrTexture.dispose();
    pmremGenerator.dispose();
  });

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Load the cat.glb model with animations
let mixer; // To control animations
const clock = new THREE.Clock(); // For updating animations

const loader = new GLTFLoader();
loader.load('/models/cat.glb', (gltf) => {
  const model = gltf.scene;
  model.scale.set(2, 2, 2);

  // Set up animations
  mixer = new THREE.AnimationMixer(model);
  if (gltf.animations.length > 0) {
    const action = mixer.clipAction(gltf.animations[0]); // Play the first animation
    action.play();
  }

  // Ensure the model receives shadows
  model.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  scene.add(model);
}, undefined, (error) => {
  console.error('Error loading model:', error);
});

// Background audio
const audioButton = document.getElementById('audio-control');
let isAudioPlaying = false;

const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load('/audio/bgm.mp3', (buffer) => {
  sound.setBuffer(buffer);
  sound.setLoop(true);
  sound.setVolume(0.5);
});

audioButton.addEventListener('click', () => {
  if (isAudioPlaying) {
    sound.pause();
    audioButton.textContent = '🎵 Play Audio';
  } else {
    sound.play();
    audioButton.textContent = '🔇 Pause Audio';
  }
  isAudioPlaying = !isAudioPlaying;
});

// Navigation to main page
document.getElementById('enter-main').addEventListener('click', () => {
  const loadingElement = document.getElementById('loading');
  loadingElement.classList.remove('hidden'); // Show loading spinner
  setTimeout(() => {
    window.location.href = '/main.html'; // Navigate to main page
  }, 2000);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Update animations
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
