(() => {
  function createController(audioFiles = window.GOGODOWN_CONFIG.audio) {
    const elements = Object.fromEntries(
      Object.entries(audioFiles).map(([key, src]) => {
        const element = new Audio(src);
        element.preload = "auto";
        element.volume = key === "music" ? 0.38 : 0.68;
        element.loop = key === "music";
        return [key, element];
      })
    );

    return Object.freeze({
      play(name) {
        const element = elements[name];
        if (!element) {
          return;
        }

        const instance = element.cloneNode();
        instance.volume = element.volume;
        instance.play().catch(() => {});
      },

      playMusic() {
        const music = elements.music;
        if (!music) {
          return;
        }

        music.currentTime = 0;
        music.play().catch(() => {});
      },

      stopMusic() {
        const music = elements.music;
        if (!music) {
          return;
        }

        music.pause();
        music.currentTime = 0;
      }
    });
  }

  window.GogoAudio = Object.freeze({ createController });
})();
