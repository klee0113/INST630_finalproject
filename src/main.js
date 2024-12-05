import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let scene, camera, renderer, mixer, clock, tinycat, controls, npc1, interactionOverlay, loadingOverlay, displayedModel, npc1Dialog;
const moveSpeed = 0.1;
const moveDirection = new THREE.Vector3(0, 0, 0);
let isInteracting = false;

init();
animate();

function init() {
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaec6cf);

  // Camera setup
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // OrbitControls setup
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 10);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // Load GLB Model
  const loader = new GLTFLoader();
  loader.load("models/tinycat_scene.glb", (gltf) => {
    mixer = new THREE.AnimationMixer(gltf.scene);

    gltf.scene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        if (node.name === "Map") {
          const textureLoader = new THREE.TextureLoader();
          const groundTexture = textureLoader.load("textures/baked_texture.png");
          groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
          groundTexture.repeat.set(10, 10);

          node.material = new THREE.MeshStandardMaterial({
            map: groundTexture,
          });
        }
      }

      if (node.name === "Tinycat") {
        tinycat = node;
        const tinycatClip = THREE.AnimationClip.findByName(gltf.animations, "Tinycat_Move");
        mixer.clipAction(tinycatClip, node).play();
      }

      if (node.name === "NPC1") {
        npc1 = node;
        const npc1Clip = THREE.AnimationClip.findByName(gltf.animations, "NPC1_Move");
        mixer.clipAction(npc1Clip, node).play();
      }
    });

    scene.add(gltf.scene);
  });

  clock = new THREE.Clock();

  interactionOverlay = document.createElement("div");
  interactionOverlay.style.position = "absolute";
  interactionOverlay.style.bottom = "20px";
  interactionOverlay.style.left = "50%";
  interactionOverlay.style.transform = "translateX(-50%)";
  interactionOverlay.style.padding = "10px";
  interactionOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  interactionOverlay.style.color = "white";
  interactionOverlay.style.fontSize = "18px";
  interactionOverlay.style.display = "none";
  interactionOverlay.innerText = "Press Enter to interact with NPC1";
  document.body.appendChild(interactionOverlay);

  // Loading overlay
  loadingOverlay = document.createElement("div");
  loadingOverlay.style.position = "absolute";
  loadingOverlay.style.top = "0";
  loadingOverlay.style.left = "0";
  loadingOverlay.style.width = "100%";
  loadingOverlay.style.height = "100%";
  loadingOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  loadingOverlay.style.color = "white";
  loadingOverlay.style.display = "none";
  loadingOverlay.style.alignItems = "center";
  loadingOverlay.style.justifyContent = "center";
  loadingOverlay.style.fontSize = "24px";
  loadingOverlay.textContent = "Loading 3D Graph...";
  document.body.appendChild(loadingOverlay);

  // NPC1 dialog box
  npc1Dialog = document.createElement("div");
  npc1Dialog.style.position = "absolute";
  npc1Dialog.style.bottom = "20px";
  npc1Dialog.style.left = "50%";
  npc1Dialog.style.transform = "translateX(-50%)";
  npc1Dialog.style.padding = "20px";
  npc1Dialog.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  npc1Dialog.style.color = "white";
  npc1Dialog.style.fontSize = "16px";
  npc1Dialog.style.borderRadius = "10px";
  npc1Dialog.style.display = "none";
  npc1Dialog.style.textAlign = "center";
  npc1Dialog.style.width = "300px";
  npc1Dialog.innerHTML = `
    <p><strong>Adoptable Cats:</strong> 15</p>
    <p>
      This dataset contains a list of shelter animals that are ready to be adopted
      from the Montgomery County Animal Services and Adoption Center at 7315 Muncaster Mill Rd., Derwood MD 20855.
      The 'How To Adopt' details are posted on
      <a href="https://www.montgomerycountymd.gov/animalservices/adoption/howtoadopt.html" target="_blank">this website</a>.
    </p>
    <button id="close-dialog" style="
      margin-top: 10px;
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;">Close</button>
  `;
  document.body.appendChild(npc1Dialog);

  document.getElementById("close-dialog").addEventListener("click", () => {
    npc1Dialog.style.display = "none";
    isInteracting = false;
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onWindowResize, false);
}

function onKeyDown(event) {
  if (isInteracting) return;

  switch (event.code) {
    case "ArrowUp":
      moveDirection.z = 1;
      break;
    case "ArrowDown":
      moveDirection.z = -1;
      break;
    case "ArrowLeft":
      moveDirection.x = -1;
      break;
    case "ArrowRight":
      moveDirection.x = 1;
      break;
    case "Enter":
      if (interactionOverlay.style.display === "block") {
        displayCatDataModel();
        npc1Dialog.style.display = "block";
      }
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case "ArrowUp":
    case "ArrowDown":
      moveDirection.z = 0;
      break;
    case "ArrowLeft":
    case "ArrowRight":
      moveDirection.x = 0;
      break;
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  if (tinycat) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = forward.clone().multiplyScalar(moveDirection.z).add(right.clone().multiplyScalar(moveDirection.x));
    tinycat.position.add(move.multiplyScalar(moveSpeed));

    if (move.lengthSq() > 0) {
      tinycat.rotation.y = Math.atan2(move.x, move.z);
    }

    if (npc1 && tinycat.position.distanceTo(npc1.position) < 2) {
      interactionOverlay.style.display = "block";
    } else {
      interactionOverlay.style.display = "none";
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

function displayCatDataModel() {
  isInteracting = true;
  interactionOverlay.style.display = "none";
  loadingOverlay.style.display = "flex";

  const barGeometry = new THREE.BoxGeometry(1, 1, 1);
  const barMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
  const bar = new THREE.Mesh(barGeometry, barMaterial);

  const catData = 15;
  bar.scale.set(1, 0.1, 1);
  bar.position.set(0, 0.05, -5);

  if (displayedModel) scene.remove(displayedModel);
  displayedModel = bar;
  scene.add(displayedModel);

  loadingOverlay.style.display = "none";

  const targetScaleY = catData;
  const animationDuration = 1.5;
  const animationStartTime = performance.now();

  function animateBarGrowth(currentTime) {
    const elapsedTime = (currentTime - animationStartTime) / 1000;
    const progress = Math.min(elapsedTime / animationDuration, 1);

    bar.scale.y = progress * targetScaleY;
    bar.position.y = bar.scale.y / 2;

    if (progress < 1) {
      requestAnimationFrame(animateBarGrowth);
    } else {
      isInteracting = false;
    }
  }

  requestAnimationFrame(animateBarGrowth);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
