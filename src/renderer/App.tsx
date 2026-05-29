import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Loader2,
  Pause,
  Play,
  X
} from "lucide-react";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAnimationDefinition,
  getAnimationDurationMs,
  pickTapReaction,
  resolveAnimationState
} from "../shared/animationState";
import {
  clearReaderSnapshot,
  createReaderSnapshot,
  loadReaderSnapshot,
  saveReaderSnapshot
} from "../shared/readerStorage";
import type {
  NovelPayload,
  PetAnimationState,
  PetManifest,
  PetMotionState,
  ReaderSnapshot
} from "../shared/types";

type PromptMode = "url" | "manual" | null;

const INITIAL_MOTION_STATE: PetMotionState = {
  animation: "idle",
  behavior: "rest",
  direction: null,
  dragging: false,
  offscreen: false,
  paused: false,
  readerActive: false
};

const DRAG_CLICK_TOLERANCE = 5;

interface PetDragSession {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  moved: boolean;
}

export function App() {
  const [manifest, setManifest] = useState<PetManifest | null>(null);
  const [motionState, setMotionState] =
    useState<PetMotionState>(INITIAL_MOTION_STATE);
  const [overrideState, setOverrideState] =
    useState<PetAnimationState | null>(null);
  const [reader, setReader] = useState<ReaderSnapshot | null>(() =>
    loadReaderSnapshot(window.localStorage)
  );
  const [promptMode, setPromptMode] = useState<PromptMode>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [manualDraft, setManualDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeAnimation = resolveAnimationState({
    motionState: motionState.animation,
    readerActive: Boolean(reader),
    overrideState
  });

  useEffect(() => {
    fetch("/pet/manifest.json")
      .then((response) => response.json() as Promise<PetManifest>)
      .then(setManifest)
      .catch(() => setManifest(null));
  }, []);

  useEffect(() => {
    if (!manifest) {
      return;
    }

    const version = manifest.assetVersion
      ? `?v=${encodeURIComponent(manifest.assetVersion)}`
      : "";

    for (const definition of Object.values(manifest.states)) {
      for (const frame of definition.frames) {
        const image = new Image();
        image.src = `${definition.framesPath}/${frame}${version}`;
      }
    }
  }, [manifest]);

  useEffect(() => {
    const offMotion = window.bunnyPet.onMotionState(setMotionState);
    const offReaderCommand = window.bunnyPet.onReaderCommand((command) => {
      if (command.type === "prompt-url") {
        setPromptMode("url");
      }

      if (command.type === "load-url") {
        void handleLoadUrl(command.url);
      }

      if (command.type === "manual-text") {
        void handleManualText(command.text);
      }
    });

    return () => {
      offMotion();
      offReaderCommand();
    };
  }, []);

  useEffect(() => {
    if (reader) {
      void window.bunnyPet.setReaderActive(true);
    }
  }, []);

  useEffect(() => {
    if (!overrideState) {
      return;
    }

    const durationMs = getAnimationDurationMs(manifest, overrideState);
    const timer = window.setTimeout(() => setOverrideState(null), durationMs);
    return () => window.clearTimeout(timer);
  }, [manifest, overrideState]);

  useEffect(() => {
    if (!reader?.autoPlay || reader.lines.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      updateReader((current) => {
        if (!current) {
          return current;
        }

        const nextIndex = Math.min(current.index + 1, current.lines.length - 1);
        return {
          ...current,
          index: nextIndex,
          autoPlay: nextIndex < current.lines.length - 1
        };
      });
    }, reader.speedMs);

    return () => window.clearInterval(timer);
  }, [reader?.autoPlay, reader?.speedMs, reader?.lines.length]);

  async function handleLoadUrl(rawUrl: string) {
    const url = rawUrl.trim();
    if (!isHttpUrl(url)) {
      setError("请输入 http 或 https 开头的小说网址。");
      setPromptMode("url");
      return;
    }

    setLoading(true);
    setError("");
    setPromptMode(null);

    try {
      const payload = await window.bunnyPet.loadNovelFromUrl(url);
      activateReader(payload, { autoPlay: true });
    } catch (err) {
      setError(toErrorMessage(err));
      setPromptMode("manual");
    } finally {
      setLoading(false);
    }
  }

  async function handleManualText(text: string) {
    setLoading(true);
    setError("");

    try {
      const payload = await window.bunnyPet.loadManualText(text);
      activateReader(payload, { autoPlay: true });
      setManualDraft("");
      setPromptMode(null);
    } catch (err) {
      setError(toErrorMessage(err));
      setPromptMode("manual");
    } finally {
      setLoading(false);
    }
  }

  function activateReader(
    payload: NovelPayload,
    patch: Partial<Pick<ReaderSnapshot, "autoPlay" | "index" | "speedMs">> = {}
  ) {
    const snapshot = createReaderSnapshot(payload, patch);
    setReader(snapshot);
    saveReaderSnapshot(window.localStorage, snapshot);
  }

  function updateReader(
    updater: (current: ReaderSnapshot | null) => ReaderSnapshot | null
  ) {
    setReader((current) => {
      const next = updater(current);
      if (next) {
        saveReaderSnapshot(window.localStorage, next);
      }
      return next;
    });
  }

  function closeReader() {
    clearReaderSnapshot(window.localStorage);
    setReader(null);
    void window.bunnyPet.closeReader();
  }

  function nudgeReader(delta: number) {
    updateReader((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        index: Math.min(
          Math.max(current.index + delta, 0),
          current.lines.length - 1
        )
      };
    });
  }

  function toggleAutoPlay() {
    updateReader((current) =>
      current ? { ...current, autoPlay: !current.autoPlay } : current
    );
  }

  function setReaderSpeed(speedMs: number) {
    updateReader((current) => (current ? { ...current, speedMs } : current));
  }

  function handlePetClick() {
    setOverrideState(pickTapReaction());
  }

  function handleContextMenu(event: React.MouseEvent) {
    event.preventDefault();
    window.bunnyPet.openContextMenu();
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    const uri = event.dataTransfer
      .getData("text/uri-list")
      .split("\n")
      .find((line) => line && !line.startsWith("#"));
    const plainText = event.dataTransfer.getData("text/plain").trim();
    const candidate = uri || plainText;

    if (isHttpUrl(candidate)) {
      void handleLoadUrl(candidate);
      return;
    }

    if (plainText.length > 20) {
      setManualDraft(plainText);
      setPromptMode("manual");
    }
  }

  return (
    <main
      className="petShell"
      onContextMenu={handleContextMenu}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <PetSprite
        manifest={manifest}
        state={activeAnimation}
        onClick={handlePetClick}
      />

      {reader ? (
        <ReaderBar
          reader={reader}
          onPrev={() => nudgeReader(-1)}
          onNext={() => nudgeReader(1)}
          onToggleAutoPlay={toggleAutoPlay}
          onSpeedChange={setReaderSpeed}
          onClose={closeReader}
        />
      ) : null}

      {promptMode === "url" ? (
        <UrlPrompt
          value={urlDraft}
          loading={loading}
          error={error}
          onChange={setUrlDraft}
          onSubmit={() => void handleLoadUrl(urlDraft)}
          onClose={() => setPromptMode(null)}
        />
      ) : null}

      {promptMode === "manual" ? (
        <ManualPrompt
          value={manualDraft}
          loading={loading}
          error={error}
          onChange={setManualDraft}
          onSubmit={() => void handleManualText(manualDraft)}
          onClose={() => setPromptMode(null)}
        />
      ) : null}

      {loading ? (
        <div className="loadingBadge" role="status">
          <Loader2 size={16} />
          <span>读取中</span>
        </div>
      ) : null}
    </main>
  );
}

interface PetSpriteProps {
  manifest: PetManifest | null;
  state: PetAnimationState;
  onClick: () => void;
}

function PetSprite({ manifest, state, onClick }: PetSpriteProps) {
  const definition = getAnimationDefinition(manifest, state);
  const [frameIndex, setFrameIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragSessionRef = useRef<PetDragSession | null>(null);
  const suppressClickRef = useRef(false);
  // Tracks the previous state so we can decide whether to preserve frameIndex.
  const prevStateRef = useRef<PetAnimationState>(state);

  useEffect(() => {
    const prevState = prevStateRef.current;
    prevStateRef.current = state;

    setImageFailed(false);

    const isWalkTransition = isMovementState(prevState) && isMovementState(state);

    if (!isWalkTransition) {
      setFrameIndex(0);
    }
  }, [state]);

  useEffect(() => {
    if (!definition || definition.frames.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        const lastFrame = definition.frames.length - 1;
        if (current >= lastFrame) {
          return definition.loop ? 0 : lastFrame;
        }

        return current + 1;
      });
    }, 1000 / definition.fps);

    return () => window.clearInterval(timer);
  }, [definition, state]);

  const src = useMemo(() => {
    if (!definition) {
      return "";
    }

    const frame = definition.frames[frameIndex] ?? definition.frames[0];
    const version = manifest?.assetVersion
      ? `?v=${encodeURIComponent(manifest.assetVersion)}`
      : "";
    return `${definition.framesPath}/${frame}${version}`;
  }, [definition, frameIndex, manifest?.assetVersion]);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragSessionRef.current = {
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      moved: false
    };
    suppressClickRef.current = false;
    window.bunnyPet.startDrag(event.screenX, event.screenY);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const dragSession = dragSessionRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return;
    }

    const movedDistance = Math.hypot(
      event.screenX - dragSession.startScreenX,
      event.screenY - dragSession.startScreenY
    );

    if (!dragSession.moved && movedDistance < DRAG_CLICK_TOLERANCE) {
      return;
    }

    dragSession.moved = true;
    suppressClickRef.current = true;
    setDragging(true);
    window.bunnyPet.dragTo(event.screenX, event.screenY);
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const dragSession = dragSessionRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragSessionRef.current = null;
    setDragging(false);
    window.bunnyPet.endDrag();
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    onClick();
  }

  const isWalking = isMovementState(state);

  return (
    <button
      className={[
        "petSprite",
        `petSprite--${state}`,
        isWalking ? "petSprite--walking" : "",
        dragging ? "isDragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      aria-label="兔女郎桌宠"
      onClick={handleClick}
      onPointerCancel={finishDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
    >
      {src && !imageFailed ? (
        <img
          className="petFrame"
          src={src}
          alt=""
          draggable={false}
          onLoad={() => setImageFailed(false)}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <FallbackBunny state={state} />
      )}
    </button>
  );
}

function FallbackBunny({ state }: { state: PetAnimationState }) {
  return (
    <div className={`fallbackBunny fallbackBunny--${state}`} aria-hidden="true">
      <div className="ear earLeft" />
      <div className="ear earRight" />
      <div className="head">
        <div className="eye eyeLeft" />
        <div className="eye eyeRight" />
        <div className="cheek cheekLeft" />
        <div className="cheek cheekRight" />
        <div className="mouth" />
      </div>
      <div className="bow" />
      <div className="body" />
      <div className="foot footLeft" />
      <div className="foot footRight" />
    </div>
  );
}

interface ReaderBarProps {
  reader: ReaderSnapshot;
  onPrev: () => void;
  onNext: () => void;
  onToggleAutoPlay: () => void;
  onSpeedChange: (speedMs: number) => void;
  onClose: () => void;
}

function ReaderBar({
  reader,
  onPrev,
  onNext,
  onToggleAutoPlay,
  onSpeedChange,
  onClose
}: ReaderBarProps) {
  return (
    <section className="readerBar" aria-label="阅读浮条">
      <button
        className="iconButton"
        type="button"
        title="上一句"
        onClick={onPrev}
        disabled={reader.index <= 0}
      >
        <ChevronLeft size={16} />
      </button>
      <div className="readerLine">
        <span className="readerTitle">{reader.title}</span>
        <span className="readerText">{reader.lines[reader.index] || ""}</span>
      </div>
      <button
        className="iconButton"
        type="button"
        title="下一句"
        onClick={onNext}
        disabled={reader.index >= reader.lines.length - 1}
      >
        <ChevronRight size={16} />
      </button>
      <button
        className="iconButton"
        type="button"
        title={reader.autoPlay ? "暂停自动翻行" : "继续自动翻行"}
        onClick={onToggleAutoPlay}
      >
        {reader.autoPlay ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <input
        className="speedSlider"
        aria-label="阅读速度"
        type="range"
        min={1800}
        max={8000}
        step={200}
        value={reader.speedMs}
        onChange={(event) => onSpeedChange(Number(event.target.value))}
      />
      <button
        className="iconButton"
        type="button"
        title="关闭阅读"
        onClick={onClose}
      >
        <X size={15} />
      </button>
    </section>
  );
}

interface UrlPromptProps {
  value: string;
  loading: boolean;
  error: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function UrlPrompt({
  value,
  loading,
  error,
  onChange,
  onSubmit,
  onClose
}: UrlPromptProps) {
  return (
    <form
      className="promptCard"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="promptRow">
        <BookOpen size={17} />
        <input
          autoFocus
          value={value}
          placeholder="https://..."
          onChange={(event) => onChange(event.target.value)}
        />
        <button className="iconButton" type="submit" title="读取" disabled={loading}>
          <ClipboardPaste size={15} />
        </button>
        <button className="iconButton" type="button" title="关闭" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      {error ? <p className="promptError">{error}</p> : null}
    </form>
  );
}

interface ManualPromptProps {
  value: string;
  loading: boolean;
  error: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function ManualPrompt({
  value,
  loading,
  error,
  onChange,
  onSubmit,
  onClose
}: ManualPromptProps) {
  return (
    <form
      className="manualCard"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        autoFocus
        value={value}
        placeholder="把小说正文粘贴到这里"
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="promptError">{error}</p> : null}
      <div className="manualActions">
        <button className="textButton" type="submit" disabled={loading}>
          开始阅读
        </button>
        <button className="iconButton" type="button" title="关闭" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
    </form>
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "读取失败，可以改用手动粘贴文本。";
}

function isMovementState(state: PetAnimationState): boolean {
  return state.startsWith("walk_") || state.startsWith("run_");
}
