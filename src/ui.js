export function setupUI(scene, model) {
  const infoPanel = document.getElementById('info-panel');
  const infoText = document.getElementById('info-text');

  function showInfo(text) {
    infoText.textContent = text;
    infoPanel.classList.remove('hidden');
    infoPanel.classList.add('visible');
  }

  function hideInfo() {
    infoPanel.classList.remove('visible');
    setTimeout(() => infoPanel.classList.add('hidden'), 500);
  }

  document.getElementById('about').addEventListener('click', () => {
    showInfo('This is the About Me section.');
    model.rotation.y += Math.PI / 2; // Rotate model
    setTimeout(hideInfo, 3000);
  });

  document.getElementById('projects').addEventListener('click', () => {
    showInfo('This is the Projects section.');
    model.scale.set(3, 3, 3); // Scale model up
    setTimeout(hideInfo, 3000);
  });

  document.getElementById('skills').addEventListener('click', () => {
    showInfo('This is the Skills section.');
    model.scale.set(1, 1, 1); // Reset model scale
    setTimeout(hideInfo, 3000);
  });

  document.getElementById('contact').addEventListener('click', () => {
    showInfo('This is the Contact section.');
    model.position.set(0, 2, 0); // Move model
    setTimeout(hideInfo, 3000);
  });
}
