import { useEffect, useRef, useState } from "react";
import { generateGame } from "../api/game";
import Spinner from "./Spinner";
import TouchButton from "./TouchButton";

export default function Game({ career, topic, notes = "", onClose }) {
  const [gameData, setGameData] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const controlsRef = useRef({});

  const newGame = () => setRetryKey((k) => k + 1);

  // fetch the AI-generated level
  useEffect(() => {
    let cancelled = false;
    setGameData(null);
    setError(null);
    generateGame(career, topic, notes).then((data) => {
      if (cancelled) return;
      if (!data || !data.checkpoints || data.checkpoints.length === 0) {
        setError(
          "The AI didn't return a playable level. Try generating again.",
        );
        return;
      }
      setGameData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [career, topic, notes, retryKey]);

  // run the game engine once we have data + the canvas is mounted
  useEffect(() => {
    if (!gameData || !canvasRef.current || !rootRef.current) return;
    const cleanup = runGameEngine(
      gameData,
      canvasRef.current,
      rootRef.current,
      newGame,
      controlsRef.current,
    );
    return cleanup;
  }, [gameData]);

  return (
    <div ref={rootRef}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onClose}
          className="text-sm text-muted dark:text-muted-dark underline underline-offset-2"
        >
          ← Back to lesson
        </button>
        <button
          onClick={newGame}
          className="text-sm text-muted dark:text-muted-dark underline underline-offset-2"
        >
          🔁 New Game
        </button>
      </div>

      {error && (
        <div>
          <p style={{ color: "#c0392b" }}>{error}</p>
          <button
            onClick={newGame}
            className="mt-2 px-3 py-1.5 bg-ink dark:bg-ink-dark text-paper dark:text-paper-dark rounded text-sm"
          >
            Try again
          </button>
        </div>
      )}
      {!gameData && !error && <Spinner />}

      {gameData && (
        <div className="w-full max-w-[900px] mx-auto font-mono">
          {/* HUD */}
          <div className="flex justify-between items-center mb-2 px-1">
            <div>
              <div className="text-[10px] tracking-widest text-yellow-500">
                LEVEL
              </div>
              <div className="text-lg" data-el="levelText">
                1-1
              </div>
            </div>
            <div className="max-w-[45%]">
              <div className="text-[10px] tracking-widest text-yellow-500">
                MISSION
              </div>
              <div className="text-sm text-sky-400" data-el="missionText"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[10px] tracking-widest text-yellow-500">
                SCORE
              </div>
              <div data-el="scoreText">000</div>
            </div>
          </div>
          <div className="flex gap-1 mb-2" data-el="hpRow"></div>

          {/* Game canvas */}
          <div className="relative border-[6px] border-neutral-800 rounded shadow-lg bg-[#5c2030] overflow-hidden">
            <canvas
              ref={canvasRef}
              width={900}
              height={560}
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                cursor: "crosshair",
              }}
            />
            <div
              data-el="compass"
              className="absolute top-3 right-3 w-11 h-11 bg-neutral-900 border-[3px] border-yellow-400 flex items-center justify-center pointer-events-none"
            >
              <svg
                data-el="arrowSvg"
                viewBox="0 0 24 24"
                width="22"
                height="22"
                style={{ transition: "transform 0.15s linear" }}
              >
                <path d="M12 2 L18 14 L12 10.5 L6 14 Z" fill="#ffd94a" />
              </svg>
            </div>

            {/* Dialogue box */}
            <div
              data-el="dialogue"
              className="absolute left-2 right-2 bottom-2 bg-neutral-900 border-4 border-white p-4 transition-transform duration-300 text-neutral-100"
              style={{ transform: "translateY(140%)" }}
            >
              <div
                data-el="dlgSpeaker"
                className="text-xs text-yellow-400 uppercase tracking-wide mb-2"
              ></div>
              <div
                data-el="dlgBody"
                className="text-sm mb-3 text-neutral-100"
              ></div>
              <div data-el="quiz" className="hidden">
                <div
                  data-el="quizQ"
                  className="text-sm mb-2 text-sky-300"
                ></div>
                <div data-el="quizOpts" className="flex flex-col gap-2"></div>
              </div>
              <div
                data-el="dlgNext"
                className="text-xs text-neutral-400 mt-3"
              ></div>
              <button
                data-el="dlgContinue"
                className="mt-3 px-3 py-1.5 bg-yellow-500 text-black text-sm rounded"
              >
                Continue
              </button>
            </div>

            {/* Battle screen */}
            <div
              data-el="battleScreen"
              className="hidden absolute inset-0 bg-black/90 flex-col items-center p-3 overflow-y-auto text-neutral-100"
            >
              <div
                data-el="enemyNameLabel"
                className="text-base text-red-400 mt-1 mb-1"
              ></div>
              <canvas
                data-el="enemyCanvas"
                width={160}
                height={120}
                style={{ width: 120, height: "auto" }}
              ></canvas>
              <div className="w-full max-w-sm mt-2 shrink-0">
                <div className="text-[10px] tracking-widest text-red-400 mb-0.5">
                  ENEMY
                </div>
                <div className="h-2 bg-neutral-700 rounded overflow-hidden mb-1">
                  <div
                    data-el="enemyBar"
                    className="h-full bg-red-500"
                    style={{ width: "100%" }}
                  ></div>
                </div>
                <div
                  data-el="enemyHpLabel"
                  className="text-xs text-neutral-300 mb-2"
                ></div>
                <div className="text-[10px] tracking-widest text-green-400 mb-0.5">
                  YOU
                </div>
                <div className="h-2 bg-neutral-700 rounded overflow-hidden mb-1">
                  <div
                    data-el="playerBar"
                    className="h-full bg-green-500"
                    style={{ width: "100%" }}
                  ></div>
                </div>
                <div
                  data-el="playerHpLabel"
                  className="text-xs text-neutral-300 mb-2"
                ></div>
              </div>
              <div
                data-el="battleQ"
                className="text-sm mb-2 text-center w-full max-w-sm text-neutral-100 font-medium"
              ></div>
              <div
                data-el="battleOpts"
                className="flex flex-col gap-1.5 w-full max-w-sm"
              ></div>
              <div
                data-el="battleFact"
                className="text-xs mt-2 text-center max-w-sm text-neutral-200"
              ></div>
              <button
                data-el="battleContinue"
                className="hidden mt-2 mb-2 px-3 py-1.5 bg-yellow-500 text-black text-sm rounded shrink-0"
              >
                Continue
              </button>
            </div>

            {/* Win screen */}
            <div
              data-el="winScreen"
              className="hidden absolute inset-0 bg-black/90 flex-col items-center justify-center p-6 text-center"
            >
              <div className="text-xl text-yellow-400 mb-3">
                Level Complete!
              </div>
              <div data-el="winText" className="text-sm mb-4"></div>
              <button
                data-el="winNewGameBtn"
                className="px-3 py-1.5 bg-yellow-500 text-black text-sm rounded"
              >
                🔁 Play Another Game
              </button>
            </div>
          </div>

          {/* On-screen touch controls — lets phones/tablets play without
              a keyboard. Uses pointer events so it also works with mouse. */}
          <div className="flex items-center justify-center mt-3 select-none">
            <div className="grid grid-cols-3 grid-rows-3 gap-2 w-[168px]">
              <div />
              <TouchButton
                label="▲"
                aria="Move up"
                onPress={() => controlsRef.current.press?.("ArrowUp")}
                onRelease={() => controlsRef.current.release?.("ArrowUp")}
              />
              <div />
              <TouchButton
                label="◀"
                aria="Move left"
                onPress={() => controlsRef.current.press?.("ArrowLeft")}
                onRelease={() => controlsRef.current.release?.("ArrowLeft")}
              />
              <div />
              <TouchButton
                label="▶"
                aria="Move right"
                onPress={() => controlsRef.current.press?.("ArrowRight")}
                onRelease={() => controlsRef.current.release?.("ArrowRight")}
              />
              <div />
              <TouchButton
                label="▼"
                aria="Move down"
                onPress={() => controlsRef.current.press?.("ArrowDown")}
                onRelease={() => controlsRef.current.release?.("ArrowDown")}
              />
              <div />
            </div>
          </div>

          <div className="text-xs text-muted dark:text-muted-dark mt-2">
            Arrow keys / WASD to move, tap the canvas to jump-travel there, or
            use the on-screen D-pad above on a phone. Follow the compass. Bump a
            villain to battle it.
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Self-contained game engine. Scoped to `root` (a container element)
// instead of document.getElementById, so it doesn't leak outside this
// component and can be safely torn down on unmount.
// ---------------------------------------------------------------------
function runGameEngine(gameData, canvas, root, onWinNewGame, controls) {
  const $ = (name) => root.querySelector(`[data-el="${name}"]`);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const enemyData = gameData.enemies || [];
  let enemies = enemyData.map((e) => ({
    ...e,
    x: e.spawn.x,
    y: e.spawn.y,
    dir: 1,
    hp: 100,
    maxHp: 100,
    defeated: false,
  }));

  const player = {
    x: 60,
    y: 500,
    hp: 100,
    maxHp: 100,
    facing: 1,
    moving: false,
  };
  let currentIndex = 0;
  let score = 0;
  let frame = 0;
  let inDialogue = false;
  let inBattle = false;
  let activeEnemy = null;
  let battleQIndex = 0;
  let enemyWobble = 0;
  let lastSafeCheckpointPos = { x: 60, y: 500 };
  let running = true;
  let rafId;

  const currentCheckpoint = () => gameData.checkpoints[currentIndex];
  const distanceTo = (pos) => Math.hypot(player.x - pos.x, player.y - pos.y);

  function drawBackground() {
    ctx.fillStyle = "#4a1830";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
  }

  function drawCheckpoints() {
    gameData.checkpoints.forEach((cp, i) => {
      const visited = i < currentIndex;
      const isCurrent = i === currentIndex;
      const x = cp.position.x,
        y = cp.position.y;

      ctx.fillStyle = visited ? "#2f8a55" : isCurrent ? "#ffb337" : "#555";
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 3;
      ctx.fillRect(x - 20, y - 10, 40, 34);
      ctx.strokeRect(x - 20, y - 10, 40, 34);
      ctx.fillRect(x - 26, y - 20, 52, 14);
      ctx.strokeRect(x - 26, y - 20, 52, 14);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(i + 1, x, y + 10);

      if (visited || isCurrent) {
        ctx.strokeStyle = "#eee";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 20);
        ctx.lineTo(x, y - 56);
        ctx.stroke();
        ctx.fillStyle = visited ? "#2f8a55" : "#ffb337";
        ctx.beginPath();
        ctx.moveTo(x, y - 56);
        ctx.lineTo(x + 18, y - 49);
        ctx.lineTo(x, y - 42);
        ctx.closePath();
        ctx.fill();

        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "#fff";
        ctx.fillText(cp.name, x, y + 50);
      }
      ctx.textAlign = "left";
    });
  }

  function updateEnemies() {
    enemies.forEach((e) => {
      if (e.defeated || e.after > currentIndex) return;
      e.x += e.dir * 0.8;
      if (e.x > e.spawn.x + e.range) e.dir = -1;
      if (e.x < e.spawn.x - e.range) e.dir = 1;
    });
  }

  function drawEnemySprite(ctx2, e, cx, cy, scale, wobble) {
    ctx2.save();
    ctx2.translate(cx, cy + Math.sin(wobble) * 3);
    ctx2.scale(scale, scale);
    ctx2.beginPath();
    ctx2.arc(0, 0, 22, 0, Math.PI * 2);
    ctx2.fillStyle = e.color;
    ctx2.fill();
    ctx2.lineWidth = 3;
    ctx2.strokeStyle = "#000";
    ctx2.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + wobble * 0.3;
      ctx2.beginPath();
      ctx2.arc(Math.cos(a) * 18, Math.sin(a) * 18, 4, 0, Math.PI * 2);
      ctx2.fillStyle = "rgba(0,0,0,0.25)";
      ctx2.fill();
    }
    ctx2.fillStyle = "#fff";
    ctx2.beginPath();
    ctx2.arc(-7, -4, 5, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(7, -4, 5, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = "#000";
    ctx2.beginPath();
    ctx2.arc(-6, -3, 2.4, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(8, -3, 2.4, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.strokeStyle = "#000";
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.moveTo(-8, 8);
    ctx2.lineTo(8, 8);
    ctx2.stroke();
    ctx2.restore();
  }

  function drawEnemies() {
    enemies.forEach((e) => {
      if (e.defeated || e.after > currentIndex) return;
      drawEnemySprite(ctx, e, e.x, e.y, 0.7, frame * 0.08);
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(e.name, e.x, e.y - 28);
      ctx.textAlign = "left";
    });
  }

  function checkEnemyCollision() {
    for (const e of enemies) {
      if (e.defeated || e.after > currentIndex) continue;
      if (distanceTo({ x: e.x, y: e.y }) < 24) {
        startBattle(e);
        return true;
      }
    }
    return false;
  }

  function drawPlayer() {
    const bob = player.moving ? Math.sin(frame * 0.3) * 2 : 0;
    const legPhase = Math.sin(frame * 0.35) > 0;
    const px = Math.round(player.x),
      py = Math.round(player.y + bob);

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(player.facing, 1);

    ctx.fillStyle = "#2a4fbf";
    if (player.moving) {
      ctx.fillRect(legPhase ? -7 : -3, 9, 4, 8);
      ctx.fillRect(legPhase ? 3 : 7, 9, 4, 8);
    } else {
      ctx.fillRect(-6, 9, 4, 7);
      ctx.fillRect(2, 9, 4, 7);
    }

    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#e23b3b";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#7a1414";
    ctx.stroke();

    ctx.fillStyle = "#2a4fbf";
    ctx.beginPath();
    ctx.arc(0, 3, 9, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(4, -3, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(5, -3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d8342a";
    ctx.beginPath();
    ctx.arc(0, -9, 7, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-1, -16, 10, 4);

    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(px, py + 15, 10, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
  }

  function render() {
    drawBackground();
    drawCheckpoints();
    drawEnemies();
    drawPlayer();
    updateCompass();
  }

  function renderHpHud() {
    const wrap = $("hpRow");
    wrap.innerHTML = "";
    const hearts = 5;
    const filled = Math.round((player.hp / player.maxHp) * hearts);
    for (let i = 0; i < hearts; i++) {
      const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("viewBox", "0 0 24 24");
      s.setAttribute("width", "16");
      s.setAttribute("height", "16");
      s.innerHTML = `<path d="M12 21s-7.5-4.6-10-9C.5 8.5 2 4 6 4c2 0 3.5 1.2 4 2.5C10.5 5.2 12 4 14 4c4 0 5.5 4.5 4 8-2.5 4.4-10 9-10 9z" fill="${i < filled ? "#e23b3b" : "#3a1a1a"}" stroke="#1a1a1a" stroke-width="1"/>`;
      wrap.appendChild(s);
    }
  }

  function updateCompass() {
    const cp = currentCheckpoint();
    const compass = $("compass");
    if (!cp) {
      compass.style.opacity = 0;
      return;
    }
    compass.style.opacity = 1;
    const dx = cp.position.x - player.x;
    const dy = cp.position.y - player.y;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    $("arrowSvg").style.transform = `rotate(${angle}deg)`;
  }

  const keys = {};
  function onKeyDown(e) {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "w",
        "a",
        "s",
        "d",
      ].includes(e.key)
    ) {
      keys[e.key] = true;
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys[e.key] = false;
  }
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // Let the on-screen touch controls drive the exact same `keys` state
  // as the keyboard, so phones/tablets can play without a keyboard.
  if (controls) {
    controls.press = (k) => {
      keys[k] = true;
    };
    controls.release = (k) => {
      keys[k] = false;
    };
  }

  const SPEED = 4;
  function movePlayer() {
    if (inDialogue || inBattle) {
      player.moving = false;
      return;
    }
    let dx = 0,
      dy = 0;
    if (keys["ArrowUp"] || keys["w"]) dy -= 1;
    if (keys["ArrowDown"] || keys["s"]) dy += 1;
    if (keys["ArrowLeft"] || keys["a"]) dx -= 1;
    if (keys["ArrowRight"] || keys["d"]) dx += 1;

    player.moving = dx !== 0 || dy !== 0;
    if (dx !== 0) player.facing = dx > 0 ? 1 : -1;

    if (player.moving) {
      const len = Math.hypot(dx, dy);
      player.x += (dx / len) * SPEED;
      player.y += (dy / len) * SPEED;
      player.x = Math.max(14, Math.min(canvas.width - 14, player.x));
      player.y = Math.max(14, Math.min(canvas.height - 14, player.y));

      if (checkEnemyCollision()) return;
      const cp = currentCheckpoint();
      if (cp && distanceTo(cp.position) < 28) openDialogue(cp);
    }
  }

  function gameLoop() {
    if (!running) return;
    frame++;
    movePlayer();
    if (!inBattle) updateEnemies();
    render();
    rafId = requestAnimationFrame(gameLoop);
  }

  function onCanvasClick(e) {
    if (inDialogue) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    if (x > player.x) player.facing = 1;
    else if (x < player.x) player.facing = -1;
    player.x = x;
    player.y = y;
    const cp = currentCheckpoint();
    if (cp && distanceTo(cp.position) < 28) openDialogue(cp);
  }
  canvas.addEventListener("click", onCanvasClick);

  function openDialogue(cp) {
    lastSafeCheckpointPos = { x: cp.position.x, y: cp.position.y - 40 };
    inDialogue = true;
    $("dlgSpeaker").textContent = cp.speaker;
    $("dlgBody").textContent = cp.arrivalDialogue;
    $("dlgNext").textContent = cp.nextObjective
      ? "Next: " + cp.nextObjective
      : "This was the final checkpoint.";

    const quiz = $("quiz");
    const continueBtn = $("dlgContinue");

    if (cp.challenge && cp.challenge.type === "quiz") {
      quiz.classList.remove("hidden");
      continueBtn.classList.add("hidden");
      $("quizQ").textContent = cp.challenge.question;
      const optsWrap = $("quizOpts");
      optsWrap.innerHTML = "";
      cp.challenge.options.forEach((opt, i) => {
        const btn = document.createElement("button");
        btn.className =
          "text-left text-sm px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-100";
        btn.textContent = opt;
        btn.onclick = () => {
          const buttons = optsWrap.querySelectorAll("button");
          buttons.forEach((b) => (b.disabled = true));
          if (i === cp.challenge.answer) {
            btn.classList.add("bg-green-700", "border-green-400");
            score += 20;
          } else {
            btn.classList.add("bg-red-800", "border-red-400");
            buttons[cp.challenge.answer].classList.add(
              "bg-green-700",
              "border-green-400",
            );
          }
          $("scoreText").textContent = String(score).padStart(3, "0");
          continueBtn.classList.remove("hidden");
        };
        optsWrap.appendChild(btn);
      });
    } else {
      quiz.classList.add("hidden");
      continueBtn.classList.remove("hidden");
    }

    $("dialogue").style.transform = "translateY(0)";
  }

  function onDlgContinue() {
    $("dialogue").style.transform = "translateY(140%)";
    $("quiz").classList.add("hidden");
    inDialogue = false;

    const cp = currentCheckpoint();
    if (cp.nextObjective) $("missionText").textContent = cp.nextObjective;
    currentIndex++;
    $("levelText").textContent =
      "1-" + Math.min(currentIndex + 1, gameData.checkpoints.length);

    if (currentIndex >= gameData.checkpoints.length) {
      $("winText").textContent =
        `You completed all ${gameData.checkpoints.length} checkpoints. Final score: ${score}.`;
      $("winScreen").classList.remove("hidden");
      $("winScreen").classList.add("flex");
      $("missionText").textContent = "Complete!";
    }
    render();
  }
  $("dlgContinue").addEventListener("click", onDlgContinue);

  function updateBattleBars() {
    $("playerBar").style.width =
      Math.max(0, (player.hp / player.maxHp) * 100) + "%";
    $("playerHpLabel").textContent =
      `HP ${Math.max(0, player.hp)}/${player.maxHp}`;
    $("enemyBar").style.width =
      Math.max(0, (activeEnemy.hp / activeEnemy.maxHp) * 100) + "%";
    $("enemyHpLabel").textContent =
      `HP ${Math.max(0, activeEnemy.hp)}/${activeEnemy.maxHp}`;
    renderHpHud();
  }

  function drawEnemyStage() {
    const ec = $("enemyCanvas");
    if (!ec) return;
    const ectx = ec.getContext("2d");
    ectx.clearRect(0, 0, ec.width, ec.height);
    enemyWobble += 0.06;
    drawEnemySprite(ectx, activeEnemy, 110, 90, 2.2, enemyWobble);
  }

  function shuffledIndices(n) {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  let battleQueue = [];

  function startBattle(e) {
    inBattle = true;
    activeEnemy = e;
    battleQIndex = 0;
    battleQueue = shuffledIndices(e.questions.length);
    $("enemyNameLabel").textContent = e.name;
    $("battleFact").textContent = e.intro;
    updateBattleBars();
    drawEnemyStage();
    $("battleScreen").classList.remove("hidden");
    $("battleScreen").classList.add("flex");
    askBattleQuestion();
  }

  function askBattleQuestion() {
    // Once every question has been used, reshuffle for a fresh pass
    // instead of cycling back to question #1 in the same order.
    if (battleQIndex >= battleQueue.length) {
      battleQueue = shuffledIndices(activeEnemy.questions.length);
      battleQIndex = 0;
    }
    const q = activeEnemy.questions[battleQueue[battleQIndex]];
    $("battleQ").textContent = q.q;
    const opts = $("battleOpts");
    opts.innerHTML = "";
    $("battleContinue").classList.add("hidden");
    $("battleFact").textContent = "";
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className =
        "text-left text-sm px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-100";
      btn.textContent = opt;
      btn.onclick = () => {
        opts.querySelectorAll("button").forEach((b) => (b.disabled = true));
        if (i === q.answer) {
          btn.classList.add("bg-green-700", "border-green-400");
          activeEnemy.hp = Math.max(0, activeEnemy.hp - 34);
          score += 15;
          $("battleFact").textContent = "✔ " + q.rightFact;
        } else {
          btn.classList.add("bg-red-800", "border-red-400");
          opts
            .querySelectorAll("button")
            [q.answer].classList.add("bg-green-700", "border-green-400");
          player.hp = Math.max(0, player.hp - 18);
          $("battleFact").textContent = "✖ " + q.wrongFact;
        }
        $("scoreText").textContent = String(score).padStart(3, "0");
        updateBattleBars();
        $("battleContinue").classList.remove("hidden");
      };
      opts.appendChild(btn);
    });
  }

  function onBattleContinue() {
    if (activeEnemy.hp <= 0) {
      activeEnemy.defeated = true;
      score += 25;
      $("scoreText").textContent = String(score).padStart(3, "0");
      endBattle(activeEnemy.victory);
      return;
    }
    if (player.hp <= 0) {
      player.hp = player.maxHp;
      player.x = lastSafeCheckpointPos.x;
      player.y = lastSafeCheckpointPos.y;
      endBattle("That took a toll — your cell regroups at full health.");
      return;
    }
    battleQIndex++;
    askBattleQuestion();
  }
  $("battleContinue").addEventListener("click", onBattleContinue);

  function onWinNewGameClick() {
    if (onWinNewGame) onWinNewGame();
  }
  $("winNewGameBtn").addEventListener("click", onWinNewGameClick);

  function endBattle(message) {
    $("battleFact").textContent = message;
    $("battleQ").textContent = "";
    $("battleOpts").innerHTML = "";
    $("battleContinue").classList.add("hidden");
    setTimeout(() => {
      $("battleScreen").classList.remove("flex");
      $("battleScreen").classList.add("hidden");
      inBattle = false;
      activeEnemy = null;
    }, 2200);
  }

  // init
  renderHpHud();
  $("missionText").textContent = "Head toward the " + currentCheckpoint().name;
  $("scoreText").textContent = "000";
  gameLoop();

  let battleRaf;
  (function battleStageLoop() {
    if (!running) return;
    if (inBattle) drawEnemyStage();
    battleRaf = requestAnimationFrame(battleStageLoop);
  })();

  // cleanup on unmount
  return () => {
    running = false;
    cancelAnimationFrame(rafId);
    cancelAnimationFrame(battleRaf);
    document.removeEventListener("keydown", onKeyDown);
    $("winNewGameBtn").removeEventListener("click", onWinNewGameClick);
    document.removeEventListener("keyup", onKeyUp);
    canvas.removeEventListener("click", onCanvasClick);
    if (controls) {
      controls.press = () => {};
      controls.release = () => {};
    }
  };
}
