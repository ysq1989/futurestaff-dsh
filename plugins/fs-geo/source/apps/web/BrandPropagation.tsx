import { useEffect, useRef, useState } from "react";
import { CHAPTERS, FILM_DURATION, chapterAt } from "./propagationTimeline";
import { createCognitionRenderer } from "./effects/cognitionRenderer";
import { LoginAudio } from "./loginAudio";

export function BrandPropagation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const elapsed = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [sound, setSound] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const transportRef = useRef<LoginAudio | null>(null);
  const [audioError, setAudioError] = useState("");
  const rendererRef = useRef<ReturnType<typeof createCognitionRenderer>>(null);
  const [gpuReady, setGpuReady] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createCognitionRenderer(canvas);
    rendererRef.current = renderer;
    setGpuReady(Boolean(renderer));
    const lost = (event: Event) => {
      event.preventDefault();
      setGpuReady(false);
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      renderer?.dispose();
      rendererRef.current = null;
    };
  }, []);
  function toggleSound() {
    const transport = transportRef.current;
    if (transport) setSound(transport.toggle());
  }
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const transport = new LoginAudio(
      audio,
      () => elapsed.current / 1000,
      (blocked, error) => {
        setAudioBlocked(blocked);
        setAudioError(error);
      },
    );
    transportRef.current = transport;
    const sync = () => transport.sync();
    const gesture = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".film-controls")
      )
        return;
      transport.gesture();
    };
    transport.sync();
    document.addEventListener("visibilitychange", sync);
    document.addEventListener("pointerdown", gesture);
    document.addEventListener("click", gesture);
    document.addEventListener("keydown", gesture);
    return () => {
      transport.dispose();
      transportRef.current = null;
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("pointerdown", gesture);
      document.removeEventListener("click", gesture);
      document.removeEventListener("keydown", gesture);
    };
  }, []);
  useEffect(() => {
    transportRef.current?.setPlaying(playing);
  }, [playing]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0,
      last = 0,
      drawn = 0,
      visible = !document.hidden,
      inView = true;
    let w = 0,
      h = 0,
      activeChapter = -1;
    let focus = { x: 0.32, y: 0.5, size: 520 };
    const paint = () => {
      const t = reduced ? 24 : elapsed.current / 1000;
      rendererRef.current?.render(t, w, h, focus);
      const next = chapterAt(t);
      if (activeChapter !== next) {
        activeChapter = next;
        setChapter(next);
      }
    };
    const resize = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect();
      w = bounds.width;
      h = bounds.height;
      const visual = visualRef.current?.getBoundingClientRect();
      if (visual && w && h)
        focus = {
          x: (visual.left + visual.width / 2 - bounds.left) / w,
          y: 1 - (visual.top + visual.height / 2 - bounds.top) / h,
          size: Math.min(visual.width, visual.height),
        };
      paint();
    });
    resize.observe(canvas);
    if (visualRef.current) resize.observe(visualRef.current);
    const tick = (now: number) => {
      if (last)
        elapsed.current = (elapsed.current + now - last) % FILM_DURATION;
      last = now;
      if (now - drawn >= 1000 / 30) {
        paint();
        drawn = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (playing && !reduced && visible && inView)
        frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      visible = !document.hidden;
      sync();
    };
    const intersection = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", visibility);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [playing, reduced]);
  return (
    <section
      className="propagation cognition"
      aria-label="GEO 能力演绎"
      data-chapter={chapter}
    >
      <canvas
        ref={canvasRef}
        className="cognition-backdrop"
        aria-hidden="true"
        data-renderer={gpuReady ? "webgl" : "fallback"}
      />
      <div className="film-heading">
        <h2>
          让品牌，
          <br />被 AI 看见。
        </h2>
        <p>洞察品牌提及、内容引用与模型间的表现差异。</p>
      </div>
      <div className="film-screen" ref={visualRef}>
        {!gpuReady && <div className="cognition-fallback" />}
        <div className="cognition-core">
          <span>GEO</span>
          <small>生成式引擎优化</small>
        </div>
        <div
          className={`cognition-fragments phase-${chapter}`}
          aria-hidden="true"
        >
          <span className="fragment fragment-one">品牌提及</span>
          <span className="fragment fragment-two">内容引用</span>
          <span className="fragment fragment-three">模型对比</span>
        </div>
      </div>
      <div className="cognition-thought" key={chapter}>
        <span>{CHAPTERS[chapter]}</span>
        <p>
          {
            [
              "追踪品牌在 AI 回答中的出现。",
              "看懂问题语境，识别相关内容。",
              "沿着引用来源，找到信任的依据。",
              "比较不同模型中的品牌表现。",
              "用回答证据，衡量品牌可见性。",
            ][chapter]
          }
        </p>
      </div>
      <div className="film-footer">
        <span className="cognition-signature">AI 答案中的品牌洞察</span>
        <div className="film-controls">
          <button
            type="button"
            className="film-sound"
            aria-pressed={sound && !audioBlocked}
            title={audioBlocked ? "浏览器需要一次互动才能播放声音" : undefined}
            onClick={toggleSound}
          >
            {sound && !audioBlocked ? "关闭音效" : "开启音效"}
          </button>
          {reduced ? (
            <span>静态演绎</span>
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              aria-label={playing ? "暂停动画" : "播放动画"}
            >
              {playing ? "Ⅱ" : "▷"}
            </button>
          )}
          <button
            type="button"
            aria-label="重播动画"
            onClick={() => {
              elapsed.current = 0;
              if (audioRef.current) audioRef.current.currentTime = 0;
              setPlaying(true);
            }}
          >
            ↻
          </button>
        </div>
      </div>
      {audioError && (
        <p className="film-audio-error" role="status">
          {audioError}
        </p>
      )}
      <audio
        ref={audioRef}
        src="/_futurestaff/geo/audio/futurestaff-signal.wav"
        preload="auto"
        loop
        onError={() => {
          transportRef.current?.unavailable();
        }}
      />
    </section>
  );
}
