import { useEffect, useRef, useState } from "react";
import { generateGame } from "../api/game";
import Spinner from "./Spinner";
import TouchButton from "./TouchButton";

// A Castlevania-style side-scrolling platformer, built from the SAME
// AI-generated { checkpoints, enemies } shape as game.jsx — just laid
// out along a scrolling x-axis with gravity/jump instead of top-down
// walking. All sprites are original canvas-drawn shapes (no copyrighted
// art), and the quiz-battle screen is reused.
export default function Platformer({ career, topic, notes = "", onClose }) {
  const [gameData, setGameData] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const controlsRef = useRef({});

  const newGame = () => setRetryKey((k) => k + 1);

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

  useEffect(() => {
    if (!gameData || !canvasRef.current || !rootRef.current) return;
    const cleanup = runPlatformerEngine(
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1" data-el="hpRow"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] tracking-widest text-yellow-500">
                🔫 AMMO
              </span>
              <span data-el="bulletsText" className="text-sm">
                0
              </span>
            </div>
          </div>

          <div className="relative border-[6px] border-neutral-800 rounded shadow-lg bg-[#14141c] overflow-hidden">
            <canvas
              ref={canvasRef}
              width={900}
              height={420}
              style={{ display: "block", width: "100%", height: "auto" }}
            />

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

            {/* Battle screen (reused) — two panels: YOU vs the enemy, plus a
                per-question countdown so it plays like a timed quiz duel. */}
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
                width={140}
                height={100}
                style={{ width: 100, height: "auto" }}
              ></canvas>

              <div className="w-full max-w-sm mt-2 shrink-0 flex gap-3">
                <div className="flex-1 border border-green-700/60 rounded p-1.5">
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
                    className="text-xs text-neutral-300"
                  ></div>
                </div>
                <div className="flex-1 border border-red-700/60 rounded p-1.5">
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
                    className="text-xs text-neutral-300"
                  ></div>
                </div>
              </div>

              <div className="w-full max-w-sm mt-2">
                <div className="h-1.5 bg-neutral-700 rounded overflow-hidden">
                  <div
                    data-el="battleTimerBar"
                    className="h-full bg-yellow-400"
                    style={{ width: "100%" }}
                  ></div>
                </div>
              </div>

              <div
                data-el="battleQ"
                className="text-sm mt-2 mb-2 text-center w-full max-w-sm text-neutral-100 font-medium"
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
          <div className="flex items-center justify-between gap-4 mt-3 select-none">
            <div className="grid grid-cols-2 gap-2">
              <TouchButton
                label="◀"
                aria="Move left"
                onPress={() => controlsRef.current.press?.("ArrowLeft")}
                onRelease={() => controlsRef.current.release?.("ArrowLeft")}
              />
              <TouchButton
                label="▶"
                aria="Move right"
                onPress={() => controlsRef.current.press?.("ArrowRight")}
                onRelease={() => controlsRef.current.release?.("ArrowRight")}
              />
            </div>
            <div className="flex gap-2">
              <TouchButton
                label="⤒"
                aria="Jump"
                wide
                onPress={() => controlsRef.current.press?.("ArrowUp")}
                onRelease={() => controlsRef.current.release?.("ArrowUp")}
              />
              <TouchButton
                label="🔫"
                aria="Fire"
                wide
                onPress={() => controlsRef.current.press?.("f")}
                onRelease={() => controlsRef.current.release?.("f")}
              />
            </div>
          </div>

          <div className="text-xs text-muted dark:text-muted-dark mt-2">
            Arrow keys / A D to run, Space / W to jump, F to shoot — or use the
            on-screen buttons above on a phone. Answer checkpoint questions
            correctly to earn ammo. Jump clean over a patrolling villain to
            dodge its questions — get caught on the ground and you'll have to
            answer, timer running.
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Engine: side-scrolling platformer built from checkpoints (laid out
// left-to-right as flags along the ground) and enemies (ground-patrolling).
// ---------------------------------------------------------------------
function runPlatformerEngine(gameData, canvas, root, onWinNewGame, controls) {
  const $ = (name) => root.querySelector(`[data-el="${name}"]`);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const GROUND_Y = 360;
  const GRAVITY = 0.6;
  const JUMP_V = -11;
  const SPEED = 3.2;
  const SPACING = 420; // horizontal distance between checkpoints
  const WORLD_WIDTH = gameData.checkpoints.length * SPACING + 300;

  // Enemy AI tuning: they patrol on their own, notice the player when
  // close enough and give chase (hopping like a soldier as they go),
  // then fall back to patrolling if they lose the trail.
  const CHASE_RANGE = 240;
  const PATROL_SPEED = 1.1;
  const CHASE_SPEED = 2.15;
  const ENEMY_JUMP_V = -9.5;
  const BULLET_SPEED = 9;
  const BULLET_DAMAGE = 26;
  const BATTLE_TIME_MS = 9000;

  // Lay checkpoints out left-to-right as flags on the ground.
  const checkpoints = gameData.checkpoints.map((cp, i) => ({
    ...cp,
    wx: 220 + i * SPACING,
    wy: GROUND_Y,
  }));

  // Floating platforms scattered between checkpoints so jumping has a
  // purpose beyond clearing enemies — small ledges you can land on.
  const PLATFORM_W = 90,
    PLATFORM_H = 16;
  let platforms = [];
  for (let i = 0; i < checkpoints.length - 1; i++) {
    const startX = checkpoints[i].wx + 100;
    const endX = checkpoints[i + 1].wx - 100;
    const span = endX - startX;
    if (span < 120) continue;
    const count = span > 260 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      platforms.push({
        x: startX + (span * (k + 1)) / (count + 1) - PLATFORM_W / 2,
        y: GROUND_Y - 70 - (k % 2 === 0 ? 0 : 40),
        w: PLATFORM_W,
        h: PLATFORM_H,
      });
    }
  }

  const enemyData = gameData.enemies || [];
  let enemies = enemyData.map((e, i) => {
    const baseX = 220 + (e.after ?? 0) * SPACING + SPACING * 0.5;
    return {
      ...e,
      x: baseX,
      spawnX: baseX,
      y: GROUND_Y,
      vy: 0,
      onGround: true,
      dir: 1,
      hp: 100,
      maxHp: 100,
      defeated: false,
      jumpTimer: 60 + Math.floor(Math.random() * 60),
      state: "patrol", // "patrol" | "chase"
    };
  });

  const player = {
    x: 60,
    y: GROUND_Y,
    vy: 0,
    onGround: true,
    facing: 1,
    moving: false,
    hp: 100,
    maxHp: 100,
    flash: 0,
    bullets: 0,
  };

  let bullets = []; // { x, y, dir }

  let particles = [];
  let shake = 0;
  let camX = 0;
  let currentIndex = 0;
  let score = 0;
  let frame = 0;
  let inDialogue = false;
  let inBattle = false;
  let activeEnemy = null;
  let battleQIndex = 0;
  let enemyWobble = 0;
  let lastSafeX = 60;
  let running = true;
  let rafId;

  const currentCheckpoint = () => checkpoints[currentIndex];

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 1,
        life: 20 + Math.random() * 10,
        color,
      });
    }
  }

  function updateParticles() {
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life--;
    });
    particles = particles.filter((p) => p.life > 0);
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / 30);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - camX - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
  }

  function drawBackground() {
    // sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#0d0d1a");
    grad.addColorStop(1, "#1c1c30");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // moon
    ctx.beginPath();
    ctx.arc(canvas.width - 100, 70, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#e8e4c9";
    ctx.fill();

    // far silhouette layer (slowest parallax)
    ctx.fillStyle = "#141428";
    for (let i = -1; i < 8; i++) {
      const hx = i * 260 - ((camX * 0.15) % 260);
      ctx.beginPath();
      ctx.moveTo(hx, GROUND_Y + 20);
      ctx.lineTo(hx + 60, GROUND_Y - 90);
      ctx.lineTo(hx + 130, GROUND_Y - 40);
      ctx.lineTo(hx + 200, GROUND_Y + 20);
      ctx.closePath();
      ctx.fill();
    }

    // mid hill layer (medium parallax)
    ctx.fillStyle = "#22223f";
    for (let i = -1; i < 8; i++) {
      const hx = i * 220 - ((camX * 0.35) % 220);
      ctx.beginPath();
      ctx.arc(hx, GROUND_Y + 40, 130, Math.PI, 0);
      ctx.fill();
    }

    // ground
    ctx.fillStyle = "#2c2118";
    ctx.fillRect(0, GROUND_Y + 20, canvas.width, canvas.height - GROUND_Y - 20);
    ctx.fillStyle = "#4a3520";
    ctx.fillRect(0, GROUND_Y + 20, canvas.width, 6);
    // ground texture lines
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    for (let i = 0; i < canvas.width; i += 24) {
      const gx = (i - camX * 0.9) % canvas.width;
      ctx.beginPath();
      ctx.moveTo(gx, GROUND_Y + 26);
      ctx.lineTo(gx, canvas.height);
      ctx.stroke();
    }
  }

  function drawPlatforms() {
    platforms.forEach((p) => {
      const sx = p.x - camX;
      if (sx < -p.w || sx > canvas.width + p.w) return;
      ctx.fillStyle = "#5a3f28";
      ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = "#7a5a38";
      ctx.fillRect(sx, p.y, p.w, 4);
      ctx.strokeStyle = "#2a1c10";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, p.y, p.w, p.h);
    });
  }

  function drawFlags() {
    checkpoints.forEach((cp, i) => {
      const sx = cp.wx - camX;
      if (sx < -60 || sx > canvas.width + 60) return;
      const visited = i < currentIndex;
      const isCurrent = i === currentIndex;
      ctx.strokeStyle = "#8a8a8a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, GROUND_Y + 20);
      ctx.lineTo(sx, GROUND_Y - 60);
      ctx.stroke();
      ctx.fillStyle = visited ? "#2f8a55" : isCurrent ? "#ffb337" : "#555";
      ctx.beginPath();
      ctx.moveTo(sx, GROUND_Y - 60);
      ctx.lineTo(sx + 26, GROUND_Y - 48);
      ctx.lineTo(sx, GROUND_Y - 36);
      ctx.closePath();
      ctx.fill();
      if (visited || isCurrent) {
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(cp.name, sx, GROUND_Y + 40);
        ctx.textAlign = "left";
      }
    });
  }

  function drawSprite(
    ctx2,
    cx,
    cy,
    color,
    wobble,
    scale = 1,
    running = false,
    jumping = false,
  ) {
    ctx2.save();
    ctx2.translate(cx, cy + Math.sin(wobble) * 3);
    ctx2.scale(scale, scale);

    const legSwing = running ? Math.sin(wobble * 3) * 8 : 0;
    const armSwing = running
      ? Math.sin(wobble * 3 + Math.PI) * 8
      : jumping
        ? -14
        : 0;

    // legs
    ctx2.strokeStyle = "#000";
    ctx2.lineWidth = 4;
    ctx2.lineCap = "round";
    ctx2.beginPath();
    ctx2.moveTo(-4, 10);
    ctx2.lineTo(-4 + legSwing * 0.3, 22);
    ctx2.moveTo(4, 10);
    ctx2.lineTo(4 - legSwing * 0.3, 22);
    ctx2.stroke();
    ctx2.strokeStyle = color;
    ctx2.lineWidth = 3;
    ctx2.beginPath();
    ctx2.moveTo(-4, 10);
    ctx2.lineTo(-4 + legSwing * 0.3, 22);
    ctx2.moveTo(4, 10);
    ctx2.lineTo(4 - legSwing * 0.3, 22);
    ctx2.stroke();

    // arms (behind body)
    ctx2.strokeStyle = color;
    ctx2.lineWidth = 3;
    ctx2.beginPath();
    ctx2.moveTo(-8, 2);
    ctx2.lineTo(-12, 2 + armSwing * 0.5);
    ctx2.moveTo(8, 2);
    ctx2.lineTo(12, 2 - armSwing * 0.5);
    ctx2.stroke();

    // body
    ctx2.beginPath();
    ctx2.arc(0, 0, 15, 0, Math.PI * 2);
    ctx2.fillStyle = color;
    ctx2.fill();
    ctx2.lineWidth = 2.5;
    ctx2.strokeStyle = "#000";
    ctx2.stroke();

    // eyes
    ctx2.fillStyle = "#fff";
    ctx2.beginPath();
    ctx2.arc(-5, -3, 4, 0, Math.PI * 2);
    ctx2.arc(5, -3, 4, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = "#000";
    ctx2.beginPath();
    ctx2.arc(-4, -2, 1.8, 0, Math.PI * 2);
    ctx2.arc(6, -2, 1.8, 0, Math.PI * 2);
    ctx2.fill();

    ctx2.restore();
  }

  function drawEnemies() {
    enemies.forEach((e) => {
      if (e.defeated || (e.after ?? 0) > currentIndex) return;
      const sx = e.x - camX;
      if (sx < -60 || sx > canvas.width + 60) return;
      drawSprite(ctx, sx, e.y - 16, e.color, frame * 0.08, 1, true, false);
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(e.name, sx, e.y - 46);
      ctx.textAlign = "left";
    });
  }

  function updateEnemies() {
    enemies.forEach((e) => {
      if (e.defeated || (e.after ?? 0) > currentIndex) return;

      const dist = player.x - e.x;
      const sameLevel = Math.abs(player.y - e.y) < 70;
      e.state = Math.abs(dist) < CHASE_RANGE && sameLevel ? "chase" : "patrol";

      if (e.state === "chase") {
        e.dir = dist > 0 ? 1 : -1;
        e.x += e.dir * CHASE_SPEED;
        // hop periodically while on the hunt, like a soldier closing in
        e.jumpTimer--;
        if (e.jumpTimer <= 0 && e.onGround) {
          e.vy = ENEMY_JUMP_V;
          e.onGround = false;
          e.jumpTimer = 45 + Math.floor(Math.random() * 30);
        }
      } else {
        // patrol back and forth around the spawn point
        e.x += e.dir * PATROL_SPEED;
        if (e.x > e.spawnX + (e.range || 60)) e.dir = -1;
        if (e.x < e.spawnX - (e.range || 60)) e.dir = 1;
        // occasional patrol hop, like a soldier on watch
        e.jumpTimer--;
        if (e.jumpTimer <= 0 && e.onGround) {
          e.vy = ENEMY_JUMP_V * 0.8;
          e.onGround = false;
          e.jumpTimer = 90 + Math.floor(Math.random() * 90);
        }
      }

      e.vy += GRAVITY;
      e.y += e.vy;
      if (e.y >= GROUND_Y) {
        e.y = GROUND_Y;
        e.vy = 0;
        e.onGround = true;
      } else {
        e.onGround = false;
      }
    });
  }

  function fireBullet() {
    if (inDialogue || inBattle) return;
    if (player.bullets <= 0) return;
    player.bullets--;
    renderBulletsHud();
    bullets.push({
      x: player.x + player.facing * 18,
      y: player.y - 20,
      dir: player.facing,
    });
    spawnParticles(player.x + player.facing * 18, player.y - 20, "#ffe27a", 4);
  }

  function updateBullets() {
    bullets.forEach((b) => {
      b.x += b.dir * BULLET_SPEED;
    });
    bullets = bullets.filter((b) => {
      if (b.x < camX - 40 || b.x > camX + canvas.width + 40) return false;
      for (const e of enemies) {
        if (e.defeated || (e.after ?? 0) > currentIndex) continue;
        if (inBattle && activeEnemy === e) continue;
        if (Math.abs(b.x - e.x) < 20 && Math.abs(b.y - (e.y - 16)) < 26) {
          e.hp = Math.max(0, e.hp - BULLET_DAMAGE);
          spawnParticles(e.x, e.y - 16, e.color, 8);
          shake = Math.min(6, shake + 3);
          if (e.hp <= 0 && !e.defeated) {
            e.defeated = true;
            score += 25;
            $("scoreText").textContent = String(score).padStart(3, "0");
          }
          return false; // bullet consumed
        }
      }
      return true;
    });
  }

  function drawBullets() {
    bullets.forEach((b) => {
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.arc(b.x - camX, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function renderBulletsHud() {
    const el = $("bulletsText");
    if (el) el.textContent = String(player.bullets);
  }

  function drawPlayer() {
    const sx = player.x - camX;
    ctx.save();
    ctx.translate(sx, 0);
    ctx.scale(player.facing, 1);
    if (player.flash > 0) {
      ctx.globalCompositeOperation = "lighter";
    }
    ctx.translate(-sx, 0);
    drawSprite(
      ctx,
      sx,
      player.y - 16,
      player.flash > 0 ? "#ff8080" : "#2a4fbf",
      frame * 0.08,
      1,
      player.moving && player.onGround,
      !player.onGround,
    );
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(sx, GROUND_Y + 14, 12, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    if (player.flash > 0) player.flash--;
  }

  function render() {
    ctx.save();
    if (shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake,
      );
      shake *= 0.85;
      if (shake < 0.5) shake = 0;
    }
    drawBackground();
    drawFlags();
    drawPlatforms();
    drawParticles();
    drawBullets();
    drawEnemies();
    drawPlayer();
    ctx.restore();
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

  const keys = {};
  function onKeyDown(e) {
    const k = e.key;
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", " ", "a", "d", "w"].includes(k)
    ) {
      keys[k] = true;
      e.preventDefault();
    }
    if ((k === "f" || k === "F") && !keys._fireHeld) {
      keys._fireHeld = true;
      fireBullet();
    }
  }
  function onKeyUp(e) {
    keys[e.key] = false;
    if (e.key === "f" || e.key === "F") keys._fireHeld = false;
  }
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // Let the on-screen touch controls drive the exact same `keys` state
  // as the keyboard, so phones/tablets can play without a keyboard.
  if (controls) {
    controls.press = (k) => {
      keys[k] = true;
      if (k === "f") {
        if (!keys._fireHeld) {
          keys._fireHeld = true;
          fireBullet();
        }
      }
    };
    controls.release = (k) => {
      keys[k] = false;
      if (k === "f") keys._fireHeld = false;
    };
  }

  function checkEnemyCollision() {
    for (const e of enemies) {
      if (e.defeated || (e.after ?? 0) > currentIndex) continue;
      if (Math.abs(player.x - e.x) < 26) {
        // Clear a jump over the enemy's head and you dodge the fight
        // entirely — only a landed hit (feet near the enemy's feet)
        // triggers the quiz battle.
        const playerAirborneAbove = !player.onGround && player.y < e.y - 18;
        if (playerAirborneAbove) continue;
        startBattle(e);
        return true;
      }
    }
    return false;
  }

  function platformUnder(x) {
    return platforms.find((p) => x >= p.x && x <= p.x + p.w);
  }

  function movePlayer() {
    if (inDialogue || inBattle) {
      player.moving = false;
      return;
    }
    let dx = 0;
    if (keys["ArrowLeft"] || keys["a"]) dx -= 1;
    if (keys["ArrowRight"] || keys["d"]) dx += 1;
    player.moving = dx !== 0;
    if (dx !== 0) player.facing = dx > 0 ? 1 : -1;
    player.x += dx * SPEED;
    player.x = Math.max(20, Math.min(WORLD_WIDTH - 20, player.x));

    const wasOnGround = player.onGround;
    if ((keys["ArrowUp"] || keys[" "] || keys["w"]) && player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
      spawnParticles(player.x, player.y, "#8a8a8a", 5);
    }

    player.vy += GRAVITY;
    player.y += player.vy;

    // land on ground or on a platform, whichever is higher (smaller y)
    const plat = platformUnder(player.x);
    let floorY = GROUND_Y;
    if (plat && player.y >= plat.y && player.y - player.vy <= plat.y + 2) {
      floorY = plat.y;
    }
    if (player.y >= floorY) {
      if (!wasOnGround && player.vy > 4) {
        spawnParticles(player.x, floorY, "#8a8a8a", 6);
        shake = Math.min(6, player.vy * 0.4);
      }
      player.y = floorY;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // camera follows player, clamped to world bounds
    camX = Math.max(
      0,
      Math.min(WORLD_WIDTH - canvas.width, player.x - canvas.width * 0.35),
    );
    updateParticles();

    if (checkEnemyCollision()) return;
    const cp = currentCheckpoint();
    if (cp && Math.abs(player.x - cp.wx) < 30 && player.onGround)
      openDialogue(cp);
  }

  function gameLoop() {
    if (!running) return;
    frame++;
    movePlayer();
    if (!inDialogue && !inBattle) {
      updateEnemies();
      updateBullets();
    }
    render();
    rafId = requestAnimationFrame(gameLoop);
  }

  function openDialogue(cp) {
    lastSafeX = cp.wx - 40;
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
          "text-left text-sm px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600";
        btn.textContent = opt;
        btn.onclick = () => {
          const buttons = optsWrap.querySelectorAll("button");
          buttons.forEach((b) => (b.disabled = true));
          if (i === cp.challenge.answer) {
            btn.classList.add("bg-green-700", "border-green-400");
            score += 20;
            player.bullets += 2;
            renderBulletsHud();
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
      "1-" + Math.min(currentIndex + 1, checkpoints.length);
    if (currentIndex >= checkpoints.length) {
      $("winText").textContent =
        `You reached the end of the level. Final score: ${score}.`;
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
    drawSprite(ectx, 110, 100, activeEnemy.color, enemyWobble, 2.4);
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

  let battleTimerRaf = null;
  let battleDeadline = 0;
  let battleAnswered = false;

  function stopBattleTimer() {
    if (battleTimerRaf) cancelAnimationFrame(battleTimerRaf);
    battleTimerRaf = null;
  }

  function startBattleTimer() {
    stopBattleTimer();
    battleDeadline = Date.now() + BATTLE_TIME_MS;
    const tick = () => {
      if (!inBattle || battleAnswered) return;
      const remaining = Math.max(0, battleDeadline - Date.now());
      const pct = (remaining / BATTLE_TIME_MS) * 100;
      const bar = $("battleTimerBar");
      if (bar) bar.style.width = pct + "%";
      if (remaining <= 0) {
        handleBattleTimeout();
        return;
      }
      battleTimerRaf = requestAnimationFrame(tick);
    };
    battleTimerRaf = requestAnimationFrame(tick);
  }

  function handleBattleTimeout() {
    if (battleAnswered) return;
    battleAnswered = true;
    const opts = $("battleOpts");
    const q = activeEnemy.questions[battleQueue[battleQIndex]];
    opts.querySelectorAll("button").forEach((b) => (b.disabled = true));
    const correctBtn = opts.querySelectorAll("button")[q.answer];
    if (correctBtn)
      correctBtn.classList.add("bg-green-700", "border-green-400");
    player.hp = Math.max(0, player.hp - 18);
    player.flash = 20;
    $("battleFact").textContent = "⏰ Time's up! " + q.wrongFact;
    $("scoreText").textContent = String(score).padStart(3, "0");
    updateBattleBars();
    $("battleContinue").classList.remove("hidden");
  }

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
    if (battleQIndex >= battleQueue.length) {
      battleQueue = shuffledIndices(activeEnemy.questions.length);
      battleQIndex = 0;
    }
    battleAnswered = false;
    const q = activeEnemy.questions[battleQueue[battleQIndex]];
    $("battleQ").textContent = q.q;
    const opts = $("battleOpts");
    opts.innerHTML = "";
    $("battleContinue").classList.add("hidden");
    $("battleFact").textContent = "";
    const bar = $("battleTimerBar");
    if (bar) bar.style.width = "100%";
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className =
        "text-left text-sm px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-100";
      btn.textContent = opt;
      btn.onclick = () => {
        if (battleAnswered) return;
        battleAnswered = true;
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
          player.flash = 20;
          $("battleFact").textContent = "✖ " + q.wrongFact;
        }
        $("scoreText").textContent = String(score).padStart(3, "0");
        updateBattleBars();
        $("battleContinue").classList.remove("hidden");
      };
      opts.appendChild(btn);
    });
    startBattleTimer();
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
      player.x = lastSafeX;
      endBattle("That took a toll — you regroup at full health.");
      return;
    }
    battleQIndex++;
    askBattleQuestion();
  }
  $("battleContinue").addEventListener("click", onBattleContinue);

  function endBattle(message) {
    stopBattleTimer();
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

  function onWinNewGameClick() {
    if (onWinNewGame) onWinNewGame();
  }
  $("winNewGameBtn").addEventListener("click", onWinNewGameClick);

  // init
  renderHpHud();
  renderBulletsHud();
  $("missionText").textContent = "Head toward the " + currentCheckpoint().name;
  $("scoreText").textContent = "000";
  gameLoop();

  let battleRaf;
  (function battleStageLoop() {
    if (!running) return;
    if (inBattle) drawEnemyStage();
    battleRaf = requestAnimationFrame(battleStageLoop);
  })();

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
    cancelAnimationFrame(battleRaf);
    stopBattleTimer();
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    if (controls) {
      controls.press = () => {};
      controls.release = () => {};
    }
    $("winNewGameBtn")?.removeEventListener("click", onWinNewGameClick);
  };
}
