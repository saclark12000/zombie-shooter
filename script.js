const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Global to store selected emoji for player.
let playerEmoji = null;

// NEW: Wait for emoji selection before loading bonus config and starting game.
document.addEventListener('DOMContentLoaded', () => {
    const emojiBtns = document.querySelectorAll('.emojiBtn');
    const startButton = document.getElementById('startButton');
    emojiBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove selected class from all
            emojiBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            playerEmoji = btn.textContent;
            startButton.disabled = false;
        });
    });
    startButton.addEventListener('click', () => {
        document.getElementById('emojiSelectScreen').style.display = 'none';
        Promise.all([loadBonusConfig(), loadLevelConfig()])
            .then(() => { init(); })
            .catch(e => { console.error(e); alert(e.message); });
    });
});

// NEW: Load bonus configuration from bonusConfig.json and validate it.
let bonusConfig;
async function loadBonusConfig() {
    try {
        const response = await fetch('config/bonusConfig.json');
        if (!response.ok) {
            throw new Error('Failed to load bonus config.');
        }
        const data = await response.json();
        if (!data.basic) {
            throw new Error('Invalid bonus config: missing "basic" property.');
        }
        bonusConfig = data;
        bonusHierarchy = Object.entries(bonusConfig.basic)
            .map(([key, conf]) => ({
                key,
                order: conf.order,
                threshold: conf.threshold,
                reward: conf.reward,
                display: conf.display
            }))
            .sort((a, b) => a.order - b.order);
        currentTierIndex = 0;
        bonusCounters = {};
        bonusActive = {};
        bonusHierarchy.forEach(item => {
            bonusCounters[item.key] = 0;
            bonusActive[item.key] = null;
        });
        return bonusConfig;
    } catch (e) {
        console.error(e);
        alert(e.message);
    }
}

// NEW: Level configuration variables.
let levelConfigData;
let currentGameLevel = 0;
let levelKills = 0;

// NEW: Load level configuration.
async function loadLevelConfig() {
    const response = await fetch('config/levelConfig.json');
    if (!response.ok) {
        throw new Error('Failed to load level config.');
    }
    levelConfigData = await response.json();
    return levelConfigData;
}

const player = { 
    x: canvas.width / 2, 
    y: canvas.height / 2, 
    radius: 20, 
    life: 3, 
    bullets: 10,
    // Render as chosen emoji; will be set on start.
    emoji: null
};
let zombies = [];
let gameOver = false;
let spawnInterval;

// NEW dynamic bonus globals
let bonusHierarchy = [];    // Array of bonus items sorted by order.
let currentTierIndex = 0;   // Index into bonusHierarchy.
let bonusCounters = {};     // Object: key -> count.
let bonusActive = {};       // Object: key -> active bonus instance.

// NEW: Global variable to track game start time.
let startTime;

// NEW: Global kill count.
let killCount = 0;

// NEW: Define base stats for zombies.
const ZOMBIE_BASE = {
    speed: 0.35,      // Base speed (perfect value)
    radius: 15,       // Base radius (perfect size)
    health: 1,        // Base health
    reduction: 0.025  // Speed reduction per progression factor (half of 0.05)
};

// Modify spawnZombie: remove random speed; use progression factors.
function spawnZombie() {
    let x, y;
    let side = Math.floor(Math.random() * 4);
    if (side === 0) {           
        x = Math.random() * canvas.width;
        y = -20;
    } else if (side === 1) {    
        x = canvas.width + 20;
        y = Math.random() * canvas.height;
    } else if (side === 2) {    
        x = Math.random() * canvas.width;
        y = canvas.height + 20;
    } else {                    
        x = -20;
        y = Math.random() * canvas.height;
    }
    const factor = currentGameLevel;
    let speed = Math.max(ZOMBIE_BASE.speed, ZOMBIE_BASE.speed - factor * ZOMBIE_BASE.reduction);
    const baseGrowth = 2;
    const currentLevelConfig = levelConfigData.levels[currentGameLevel];
    let spawnModifier = null;
    if (currentLevelConfig.typeObjectives[0].hasSpawnConfig) {
        spawnModifier = currentLevelConfig.typeObjectives[0].spawnConfig[0];
        if (spawnModifier.killAll) {
            zombies = [];
        }
    }
    const usedSpeedMultiplier = spawnModifier ? spawnModifier.speedMultiplier : currentLevelConfig.speedMultiplier;
    const usedRadiusIncrement = spawnModifier ? spawnModifier.radiusIncrement : currentLevelConfig.radiusIncrement;
    const usedHealthIncrement = spawnModifier ? spawnModifier.healthIncrement : currentLevelConfig.healthIncrement;
    let radius = ZOMBIE_BASE.radius + factor * (baseGrowth + usedRadiusIncrement);
    radius = radius * (1 + 0.25 * usedRadiusIncrement);
    let health = ZOMBIE_BASE.health + usedHealthIncrement;
    speed = speed * (1 + usedSpeedMultiplier);
    // NEW: Assign a random zombie emoji.
    const zombieEmojis = ["🧟", "🧟‍♂️", "🧟‍♀️"];
    const emoji = zombieEmojis[Math.floor(Math.random() * zombieEmojis.length)];
    zombies.push({ x, y, speed, radius, health, emoji, type: spawnModifier ? spawnModifier.name : "zombie" });
}

// Update positions of zombies and check for collision with the player
function update() {
    // Iterate backwards to safely remove zombies on collision
    for (let i = zombies.length - 1; i >= 0; i--) {
        let zombie = zombies[i];
        let dx = player.x - zombie.x;
        let dy = player.y - zombie.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        zombie.x += (dx / dist) * zombie.speed;
        zombie.y += (dy / dist) * zombie.speed;
        
        if (dist < player.radius + zombie.radius) {
            // Remove zombie and decrement life
            zombies.splice(i, 1);
            player.life--;
            if (player.life <= 0) {
                gameOver = true;
                clearInterval(spawnInterval);
                const duration = Math.floor((Date.now() - startTime) / 1000);
                document.querySelector('#restartScreen p').textContent = `Game Over! You lasted ${duration} seconds.`;
                document.getElementById('restartScreen').style.display = 'flex';
            }
        }
    }

    // Check for clearTarget type objectives
    const currentLevelConfig = levelConfigData.levels[currentGameLevel];
    if (currentLevelConfig.typeObjectives[0].config.type === "clearTarget") {
        const targetSpawnConfig = currentLevelConfig.typeObjectives[0].config.targetSpawnConfig;
        const targetCleared = zombies.every(zombie => zombie.type !== targetSpawnConfig);
        if (targetCleared) {
            // Apply rewards to the player
            const reward = currentLevelConfig.typeObjectives[0].config.reward;
            if (reward.bullets) {
                player.bullets += reward.bullets;
            }
            if (reward.life) {
                player.life += reward.life;
            }
            nextLevel();
        }
    }

    // Iterate over bonusHierarchy (in ascending order)
    bonusHierarchy.forEach((item, idx) => {
        const active = bonusActive[item.key];
        if (active) {
            let d = Math.hypot(player.x - active.x, player.y - active.y);
            if (d < player.radius + active.radius) {
                // Apply reward from config
                const reward = item.reward;
                if (reward.bullets) player.bullets += reward.bullets;
                if (reward.life) player.life += reward.life;
                // Remove this bonus
                bonusActive[item.key] = null;
                // Remove any bonuses in higher tiers and reset their counters
                bonusHierarchy.slice(idx + 1).forEach(higherItem => {
                    bonusActive[higherItem.key] = null;
                    bonusCounters[higherItem.key] = 0;
                });
                // Reset currentTierIndex to this bonus's tier (its index)
                currentTierIndex = idx;
                bonusCounters[item.key] = 0;
            }
        }
    });
}

// Draw the player, zombies, lifebar, and bullet count on the canvas
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw player as chosen emoji.
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.emoji, player.x, player.y);
    
    // Updated: Draw zombies as emojis with size proportional to their radius
    zombies.forEach(zombie => {
        const emojiSize = Math.max(30, zombie.radius * 1.5);
        let fillColor = 'white';
        if (zombie.flashExpiry && Date.now() < zombie.flashExpiry) {
            // Draw red flash circle underneath.
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(zombie.x, zombie.y, emojiSize / 2, 0, Math.PI * 2);
            ctx.fill();
            // Set zombie color to red.
            fillColor = 'red';
        }
        ctx.font = `${emojiSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = fillColor;
        ctx.fillText(zombie.emoji, zombie.x, zombie.y);
    });
    
    // Remove health bar drawing:
    // const maxLife = 3;
    // const barWidth = 150;
    // const barHeight = 20;
    // const lifeWidth = (player.life / maxLife) * barWidth;
    // ctx.fillStyle = 'red';
    // ctx.fillRect(20, 40, lifeWidth, barHeight);
    // ctx.strokeStyle = 'white';
    // ctx.strokeRect(20, 40, barWidth, barHeight);
    
    // Update status text with timer info, current level, and rename lives to health.
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    // NEW: Display current level from levelConfig.json (levels are 0-indexed; use .level property)
    const currentLevel = levelConfigData.levels[currentGameLevel].level;
    ctx.fillStyle = 'white';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Health: ' + player.life + ' | Bullets: ' + player.bullets + ' | Level: ' + currentLevel + ' | Time: ' + elapsed + ' sec | Kills: ' + killCount, 20, 30);
    
    // Draw dynamic bonus items from bonusActive using bonusHierarchy:
    bonusHierarchy.forEach(item => {
        const active = bonusActive[item.key];
        if (active) {
            ctx.fillStyle = item.display.color;
            ctx.beginPath();
            ctx.arc(active.x, active.y, active.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = item.display.textColor;
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.display.text, active.x, active.y);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
        }
    });
    
    // Draw explosions (💥) for a brief duration.
    const now = Date.now();
    explosions = explosions.filter(exp => now - exp.startTime < exp.duration);
    explosions.forEach(exp => {
        ctx.font = '40px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💥', exp.x, exp.y);
    });
    
    if (gameOver) {
        ctx.fillStyle = 'red';
        ctx.font = '48px sans-serif';
        ctx.fillText('Game Over', canvas.width / 2 - 100, canvas.height / 2);
    }
}

// Main game loop using requestAnimationFrame
function gameLoop() {
    if (!gameOver) {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    } else {
        draw();
    }
}

// Event listener: Shoot zombies on mouse click if within a zombie's radius
canvas.addEventListener('click', function(e) {
    shootBullet();
});

// Update player's position on mouse move.
canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    player.x = e.clientX - rect.left;
    player.y = e.clientY - rect.top;
});

// New function to shoot a bullet at the nearest zombie
function shootBullet() {
    if (player.bullets <= 0 || zombies.length === 0) return;
    // Find nearest zombie:
    let nearestZombie = zombies[0];
    let minDist = Math.hypot(player.x - nearestZombie.x, player.y - nearestZombie.y);
    zombies.forEach(zombie => {
        let dist = Math.hypot(player.x - zombie.x, player.y - zombie.y);
        if (dist < minDist) {
            minDist = dist;
            nearestZombie = zombie;
        }
    });
    // Decrement bullet count.
    player.bullets--;
    // NEW: Decrease zombie health and set flash expiry for the red flash effect.
    nearestZombie.health--;
    nearestZombie.flashExpiry = Date.now() + 100; // flash for 100ms
    if (nearestZombie.health <= 0) {
        // NEW: Add explosion effect (lasting 300ms)
        explosions.push({ x: nearestZombie.x, y: nearestZombie.y, startTime: Date.now(), duration: 300 });
        // Remove killed zombie and increment kill count.
        zombies = zombies.filter(zombie => zombie !== nearestZombie);
        killCount++;
        levelKills++;
        // Check level objective from levelConfig.
        const currentLevelGoal = levelConfigData.levels[currentGameLevel].typeObjectives[0].config.value;
        if (levelKills >= currentLevelGoal) {
            // NEW: If killAll parameter is set, remove all zombies.
            if (levelConfigData.levels[currentGameLevel].typeObjectives[0].config.reward.killAll) {
                zombies = [];
            }
            nextLevel();
        }
    }

    // Dynamically increment counter for the current bonus tier
    const currBonus = bonusHierarchy[currentTierIndex];
    bonusCounters[currBonus.key]++;
    if (!bonusActive[currBonus.key] && bonusCounters[currBonus.key] >= currBonus.threshold) {
        // Spawn bonus for current tier at the killed zombie's position
        bonusActive[currBonus.key] = { x: nearestZombie.x, y: nearestZombie.y, radius: 15 };
        // Advance tier if not at the highest index:
        if (currentTierIndex < bonusHierarchy.length - 1) {
            currentTierIndex++;
        }
        // Reset counters for tiers from currentTierIndex onward
        bonusHierarchy.slice(currentTierIndex).forEach(item => {
            bonusCounters[item.key] = 0;
        });
    }
}

// NEW: Advance to the next level or win the game.
function nextLevel() {
    clearInterval(spawnInterval);
    const currentLevelConfig = levelConfigData.levels[currentGameLevel];
    let spawnModifier = null;
    if (currentLevelConfig.typeObjectives[0].hasSpawnConfig) {
        spawnModifier = currentLevelConfig.typeObjectives[0].spawnConfig[0];
        if (spawnModifier.killAll) {
            zombies = [];
        }
    }
    if (currentLevelConfig.typeObjectives[0].config.reward.killAll) {
        zombies = [];
    }
    // Apply rewards to the player
    const reward = currentLevelConfig.typeObjectives[0].config.reward;
    if (reward.bullets) {
        player.bullets += reward.bullets;
    }
    if (reward.life) {
        player.life += reward.life;
    }
    if (currentGameLevel < levelConfigData.levels.length - 1) {
        currentGameLevel++;
        levelKills = 0;
        // Check next level's spawn configuration:
        const nextLevelConfig = levelConfigData.levels[currentGameLevel];
        let nextSpawnModifier = null;
        if (nextLevelConfig.typeObjectives[0].hasSpawnConfig) {
            nextSpawnModifier = nextLevelConfig.typeObjectives[0].spawnConfig[0];
        }
        if (nextSpawnModifier && nextSpawnModifier.spawnOthers === false) {
            const count = nextSpawnModifier.count || 1;
            for (let i = 0; i < count; i++) {
                spawnZombie();
            }
        } else {
            spawnInterval = setInterval(spawnZombie, 200);
        }
    } else {
        winGame();
    }
}

// NEW: Display win screen using restartScreen overlay.
function winGame() {
    clearInterval(spawnInterval);
    const duration = Math.floor((Date.now() - startTime) / 1000);
    document.querySelector('#restartScreen p').textContent = `You Win! You lasted ${duration} seconds.`;
    document.getElementById('restartScreen').style.display = 'flex';
    // Stop counters
    gameOver = true;
}

// Event listener: when the space key is pressed, shoot a bullet at nearest zombie
document.addEventListener('keydown', function(e) {
    // Check if space is pressed (key === " " or keyCode 32)
    if (e.key === ' ' || e.keyCode === 32) {
        shootBullet();
    }
});

// Remove old restartButton event listener:
// document.getElementById('restartButton').addEventListener('click', function() {
//     restartGame();
// });

// Add new restart button event listeners:
document.getElementById('restartCurrentButton').addEventListener('click', function() {
    restartGame(); // Restart with current emoji
});

document.getElementById('restartNewEmojiButton').addEventListener('click', function() {
    clearInterval(spawnInterval);
    gameOver = true;
    document.getElementById('restartScreen').style.display = 'none';
    document.getElementById('emojiSelectScreen').style.display = 'flex';
    playerEmoji = null;
    document.getElementById('startButton').disabled = true;
});

// NEW: Define restartGame to resolve the exception.
function restartGame() {
    init();
}

// Initialize game: hide loading screen, reset game state, then start game loop and spawner.
function init() {
    startTime = Date.now();
    // Set player's emoji from selection.
    player.emoji = playerEmoji;
    // Reset game state
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.life = 3;
    player.bullets = 10;
    zombies = [];
    gameOver = false;
    
    // Reset dynamic bonus globals
    currentTierIndex = 0;
    bonusHierarchy.forEach(item => {
        bonusCounters[item.key] = 0;
        bonusActive[item.key] = null;
    });
    currentGameLevel = 0;
    levelKills = 0;
    killCount = 0;  // NEW: Reset global kill count
    
    document.getElementById('restartScreen').style.display = 'none';
    
    const currentLevelConfig = levelConfigData.levels[currentGameLevel];
    let spawnModifier = null;
    if (currentLevelConfig.typeObjectives[0].hasSpawnConfig) {
        spawnModifier = currentLevelConfig.typeObjectives[0].spawnConfig[0];
    }
    if (spawnModifier && spawnModifier.spawnOthers === false) {
        const count = spawnModifier.count || 1;
        for (let i = 0; i < count; i++) {
            spawnZombie();
        }
    } else {
        for (let i = 0; i < 5; i++) {
            spawnZombie();
        }
        spawnInterval = setInterval(spawnZombie, 200);
    }
    gameLoop();
}

// Simulate loading delay then hide loading screen
setTimeout(() => {
    document.getElementById('loadingScreen').style.display = 'none';
    init();
}, 1000);

// Adjust canvas size on window resize
window.addEventListener('resize', function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
});

let explosions = [];  // NEW: Global array to track explosions
