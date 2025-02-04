export function setupUI(scene, bgmAudio) {
  // Reload Button Functionality
  document.getElementById("reload").addEventListener("click", () => {
    window.location.reload();
  });

  // BGM Control Button Functionality
  const bgmControlButton = document.getElementById("bgm-control");
  let isBgmPlaying = false;

  bgmControlButton.addEventListener("click", () => {
    if (isBgmPlaying) {
      bgmAudio.pause();
      bgmControlButton.textContent = "Play BGM";
    } else {
      bgmAudio.play();
      bgmControlButton.textContent = "Pause BGM";
    }
    isBgmPlaying = !isBgmPlaying;
  });
}
