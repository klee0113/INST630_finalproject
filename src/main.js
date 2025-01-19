import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let scene, camera, renderer, mixer, clock, controls, bgmAudio, bgmButton, overlay, interactionPrompt, jellyPaw;
const moveDirection = new THREE.Vector3(0, 0, 0);
const moveSpeed = 0.05;
let tinycat;
const npcs = [];
const cameraOffset = new THREE.Vector3(0, 6, 12);
let isCameraFrozen = false;
let npcSounds = {};
let rawAnimalData = [];


// Animal data (default values; replaced by API response)
let animalData = {
  CAT: 0,
  DOG: 0,
  BIRD: 0,
  OTHER: 0,
};

// API endpoint
const apiEndpoint = "https://data.montgomerycountymd.gov/resource/e54u-qx42.json";

async function fetchAnimalData() {
  try {
    const response = await fetch(apiEndpoint);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    rawAnimalData = data;

    // Process API response to count animals by type
    animalData = {
      CAT: 0,
      DOG: 0,
      BIRD: 0,
      OTHER: 0,
    };

    data.forEach((pet) => {
      const type = pet.animaltype?.toUpperCase();
      if (type === "CAT") animalData.CAT++;
      else if (type === "DOG") animalData.DOG++;
      else if (type === "BIRD") animalData.BIRD++;
      else animalData.OTHER++;
    });

    console.log("Updated Animal Data from API:", animalData);
  } catch (error) {
    console.error("Error fetching animal data:", error);
  }
}


function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaec6cf);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  clock = new THREE.Clock();

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 3.0);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(10, 15, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  // GLTF Loader
  const loader = new GLTFLoader();
  loader.load(
    "/src/models/tinycat_scene.glb",
    (gltf) => {
      console.log("GLTF loaded:", gltf);

      mixer = new THREE.AnimationMixer(gltf.scene);
      gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });

      const textureLoader = new THREE.TextureLoader();
      const grassTexture = textureLoader.load(
        "/src/textures/GrassBake.png",
        () => console.log("Grass texture loaded successfully."),
        undefined,
        (err) => console.error("Failed to load grass texture:", err)
      );
      grassTexture.wrapS = THREE.RepeatWrapping;
      grassTexture.wrapT = THREE.RepeatWrapping;
      grassTexture.repeat.set(1, 1);

      gltf.scene.traverse((node) => {
        console.log("Node found:", node.name);

        // Apply texture to the ground mesh
        if (node.name === "Map") {
          node.traverse((child) => {
            if (child.isMesh && child.material) {
              console.log("Applying texture to:", child.name);
              child.material.map = grassTexture;
              child.material.needsUpdate = true;
            }
          });
        }

        // Identify and store the Tinycat model
        if (node.name === "Tinycat") {
          tinycat = node;
          tinycat.rotation.y = Math.PI;
        }

        // Add NPCs to the list with proximity radii and animal type
        if (node.name === "NPC1" || node.name === "NPC2" || node.name === "NPC3" || node.name === "NPC4") {
          npcs.push({
            name: node.name,
            position: node.position.clone(),
            radius: 6,
            type: getAnimalTypeFromNPC(node.name),
          });
        }
      });

      scene.add(gltf.scene);
    },
    undefined,
    (error) => {
      console.error("An error occurred while loading the GLTF model:", error);
    }
  );

  // Background Music
  bgmAudio = new Audio("/src/audio/bgm.mp3");
  bgmAudio.loop = true;
  bgmAudio.volume = 0.5;

  bgmButton = document.getElementById("play-bgm");
  bgmButton.addEventListener("click", () => {
    if (bgmAudio.paused) {
      bgmAudio.play();
      bgmButton.textContent = "Stop BGM";
    } else {
      bgmAudio.pause();
      bgmButton.textContent = "Play BGM";
    }
  });

  // Create overlays
  overlay = createOverlay();
  interactionPrompt = createInteractionPrompt();

  // Load the Jelly Paw model
  loadJellyPaw();

  // Event Listeners
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onWindowResize, false);

  // Fetch the latest animal data
  fetchAnimalData();

    // Load NPC sounds
    const audioListener = new THREE.AudioListener();
    camera.add(audioListener);
  
    const audioLoader = new THREE.AudioLoader();
  
    npcSounds = {
      NPC1: new THREE.Audio(audioListener),
      NPC2: new THREE.Audio(audioListener),
      NPC3: new THREE.Audio(audioListener),
      NPC4: new THREE.Audio(audioListener),
    };
  
    audioLoader.load("/src/audio/npc1.mp3", (buffer) => npcSounds.NPC1.setBuffer(buffer));
    audioLoader.load("/src/audio/npc2.mp3", (buffer) => npcSounds.NPC2.setBuffer(buffer));
    audioLoader.load("/src/audio/npc3.mp3", (buffer) => npcSounds.NPC3.setBuffer(buffer));
    audioLoader.load("/src/audio/npc4.mp3", (buffer) => npcSounds.NPC4.setBuffer(buffer));
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer) mixer.update(delta * 0.5);

  // Movement logic
  if (moveDirection.length() > 0 && tinycat) {
    const moveVector = moveDirection.clone().normalize().multiplyScalar(moveSpeed);
    tinycat.position.add(moveVector);

    // Make Tinycat face the movement direction
    const targetPosition = tinycat.position.clone().add(moveVector);
    tinycat.lookAt(targetPosition);
  }

  // Update the camera to follow Tinycat
  updateCamera();

  // Check for interaction prompt
  updateInteractionPrompt();

  controls.update();
  renderer.render(scene, camera);
}

function loadJellyPaw() {
  const loader = new GLTFLoader();
  loader.load(
    "/src/models/jelly_paw.glb",
    (gltf) => {
      jellyPaw = gltf.scene;
      jellyPaw.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      jellyPaw.visible = false;
      scene.add(jellyPaw);
    },
    undefined,
    (error) => {
      console.error("Failed to load jelly_paw model:", error);
    }
  );
}

function showJellyPaw(animalType, npcName) {
  if (!jellyPaw) return;

  const count = animalData[animalType] || 0;
  const targetScale = count * 0.4;
  const basePositionY = 0.5;

  // Set initial scale to zero for animation
  jellyPaw.scale.set(0, 0, 0);
  jellyPaw.position.set(0, basePositionY, 0);
  jellyPaw.visible = true;

  // Store animal type for interaction
  jellyPaw.userData = { type: animalType };

  // Play NPC sound
  if (npcSounds[npcName]) {
    if (npcSounds[npcName].isPlaying) npcSounds[npcName].stop();
    npcSounds[npcName].play();
  }

  // Animate appearance
  const animationDuration = 1.5;
  const startTime = performance.now();

  function animateJellyPaw(currentTime) {
    const elapsed = (currentTime - startTime) / 1000;
    const progress = Math.min(elapsed / animationDuration, 1);
    const interpolatedScale = targetScale * progress;

    jellyPaw.scale.set(interpolatedScale, interpolatedScale, interpolatedScale);
    jellyPaw.position.y = basePositionY + (interpolatedScale / 2);

    if (progress < 1) {
      requestAnimationFrame(animateJellyPaw);
    }
  }

  requestAnimationFrame(animateJellyPaw);
}

function interactWithJellyPaw(animalType) {
  let filteredData = rawAnimalData.filter(
    (pet) => pet.animaltype?.toUpperCase() === animalType
  );

  const prompts = ["breed", "color", "age", "sex"];
  let currentPromptIndex = 0;

  function askUser() {
    if (currentPromptIndex < prompts.length) {
      const options = [
        ...new Set(filteredData.map((pet) => pet[prompts[currentPromptIndex]]).filter(Boolean)),
      ].map((option) => option.toUpperCase());

      if (options.length === 0) {
        // No options available, show the results immediately
        displayFilteredData(filteredData);
        return;
      }

      const userInput = prompt(
        `Select ${prompts[currentPromptIndex]}:\nAvailable options: ${options.join(
          ", "
        )}`
      );

      if (userInput) {
        filteredData = filteredData.filter(
          (pet) =>
            pet[prompts[currentPromptIndex]]
              ?.toUpperCase()
              .includes(userInput.toUpperCase())
        );
        currentPromptIndex++;
        askUser();
      } else {
        alert("Interaction canceled.");
      }
    } else {
      displayFilteredData(filteredData);
    }
  }

  askUser();
}


function displayFilteredData(data) {
  const result = data
    .map(
      (pet) =>
        `Name: ${pet.petname || "Unknown"}, Breed: ${
          pet.breed || "Unknown"
        }, Color: ${pet.color || "Unknown"}, Age: ${pet.age || "Unknown"}, Sex: ${
          pet.sex || "Unknown"
        }`
    )
    .join("\n");

  alert(`Matching results:\n\n${result}`);
}


function updateCamera() {
  if (!tinycat) return;

  isCameraFrozen = false;
  npcs.forEach((npc) => {
    const distance = tinycat.position.distanceTo(npc.position);
    if (distance < npc.radius) {
      isCameraFrozen = true;
    }
  });

  if (!isCameraFrozen) {
    const targetPosition = tinycat.position.clone().add(cameraOffset);
    camera.position.lerp(targetPosition, 0.1);
    camera.lookAt(tinycat.position.clone().add(new THREE.Vector3(0, 1, 0)));
  }
}

function updateInteractionPrompt() {
  if (!tinycat) return;

  let isPromptVisible = false;

  // Check for NPC proximity
  npcs.forEach((npc) => {
    const distance = tinycat.position.distanceTo(npc.position);
    if (distance < npc.radius) {
      interactionPrompt.style.display = "block";
      isPromptVisible = true;
    }
  });

  // Check for Jelly Paw proximity
  if (
    jellyPaw &&
    jellyPaw.visible &&
    tinycat.position.distanceTo(jellyPaw.position) < 3
  ) {
    interactionPrompt.style.display = "block";
    isPromptVisible = true;
  }

  // Hide prompt if no proximity matches
  if (!isPromptVisible) {
    interactionPrompt.style.display = "none";
  }
}


function onKeyDown(event) {
  switch (event.code) {
    case "KeyW":
      moveDirection.z = -1;
      break;
    case "KeyS":
      moveDirection.z = 1;
      break;
    case "KeyA":
      moveDirection.x = -1;
      break;
    case "KeyD":
      moveDirection.x = 1;
      break;
    case "Space":
      checkInteraction();
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case "KeyW":
    case "KeyS":
      moveDirection.z = 0;
      break;
    case "KeyA":
    case "KeyD":
      moveDirection.x = 0;
      break;
  }
}

function checkInteraction() {
  if (!tinycat) return;

  // Check NPC interactions
  npcs.forEach((npc) => {
    const distance = tinycat.position.distanceTo(npc.position);
    if (distance < npc.radius) {
      showOverlay(npc.type);
      showJellyPaw(npc.type, npc.name);
    }
  });

  // Check Jelly_Paw interaction
  if (
    jellyPaw &&
    jellyPaw.visible &&
    tinycat.position.distanceTo(jellyPaw.position) < 3
  ) {
    interactWithJellyPaw(jellyPaw.userData.type);
  }
}

function getAnimalTypeFromNPC(npcName) {
  switch (npcName) {
    case "NPC1":
      return "CAT";
    case "NPC2":
      return "DOG";
    case "NPC3":
      return "BIRD";
    case "NPC4":
      return "OTHER";
    default:
      return null;
  }
}

function createOverlay() {
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.top = "50%";
  overlay.style.left = "50%";
  overlay.style.transform = "translate(-50%, -50%)";
  overlay.style.padding = "20px";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  overlay.style.color = "white";
  overlay.style.fontSize = "18px";
  overlay.style.borderRadius = "10px";
  overlay.style.display = "none";
  overlay.style.textAlign = "center";
  document.body.appendChild(overlay);
  return overlay;
}

function createInteractionPrompt() {
  const prompt = document.createElement("div");
  prompt.style.position = "absolute";
  prompt.style.bottom = "50px";
  prompt.style.left = "50%";
  prompt.style.transform = "translateX(-50%)";
  prompt.style.padding = "10px 20px";
  prompt.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
  prompt.style.color = "white";
  prompt.style.fontSize = "16px";
  prompt.style.borderRadius = "5px";
  prompt.style.display = "none";
  prompt.innerText = "Press SPACEBAR to interact";
  document.body.appendChild(prompt);
  return prompt;
}

function showOverlay(animalType) {
  overlay.innerHTML = `<p><strong>${animalType} Count: ${animalData[animalType] || 0}</strong></p>`;
  overlay.style.display = "block";
  setTimeout(() => {
    overlay.style.display = "none";
  }, 3000);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Initialize and Start Animation
init();
animate();
