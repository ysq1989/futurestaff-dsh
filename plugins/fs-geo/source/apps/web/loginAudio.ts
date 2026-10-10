/** Audio follows the film clock; playback never changes the animation timeline. */
export class LoginAudio {
  private enabled = true;
  private playing = true;
  private blocked = false;
  private disposed = false;
  private generation = 0;
  constructor(
    private audio: HTMLAudioElement,
    private clock: () => number,
    private report: (blocked: boolean, error: string) => void,
  ) {
    this.audio.volume = 0.65;
  }
  sync() {
    const generation = ++this.generation;
    if (this.disposed || !this.enabled || !this.playing || document.hidden) {
      this.audio.pause();
      return;
    }
    if (this.audio.readyState > 0) this.audio.currentTime = this.clock();
    void this.audio
      .play()
      .then(() => {
        if (this.disposed || generation !== this.generation) return;
        this.audio.currentTime = this.clock();
        this.blocked = false;
        this.report(false, "");
      })
      .catch((cause: unknown) => {
        if (this.disposed || generation !== this.generation) return;
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        this.blocked = true;
        this.report(
          true,
          cause instanceof DOMException && cause.name === "NotAllowedError"
            ? ""
            : "声音暂时无法播放，请再试一次。",
        );
      });
  }
  setPlaying(playing: boolean) {
    this.playing = playing;
    this.sync();
  }
  toggle() {
    this.enabled = !this.enabled || this.blocked;
    this.sync();
    return this.enabled;
  }
  gesture() {
    if (this.enabled && this.blocked && this.playing) this.sync();
  }
  unavailable() {
    this.blocked = true;
    this.report(true, "声音暂时无法播放，请再试一次。");
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.audio.pause();
  }
}
