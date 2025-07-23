// Game Variables
let canvas, ctx;
let gameState = 'title'; // title, playing, paused, gameOver
let gameLoopId = null;
let score = 0;
let lives = 3;
let level = 1;
let combo = 1;
let bricksDestroyed = 0;

// Game Objects
let paddle, balls = [], bricks = [], particles = [], powerups = [];
let keys = {};

// Game Settings
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const BALL_RADIUS = 8;
const BRICK_WIDTH = 75;
const BRICK_HEIGHT = 25;
const BRICK_ROWS = 8;
const BRICK_COLS = 10;
const PARTICLE_COUNT = 30;

// Now these can use the constants defined above
let paddleOriginalWidth = PADDLE_WIDTH;
let slowBallTimer = 0;
let shrinkPaddleTimer = 0;
let expandPaddleTimer = 0;
let comboTimer = 0;
const COMBO_TIMEOUT = 180; // 3 seconds at 60fps

// Colors
const COLORS = {
    paddle: '#00ffff',
    ball: '#ff0096',
    brickTypes: {
        normal: '#8a2be2',
        strong: '#ff0096',
        teleport: '#00ffff',
        split: '#ffff00',
        magnetic: '#ff6600',
        explosive: '#ff0000'
    },
    particles: ['#ff0096', '#00ffff', '#8a2be2', '#ffff00', '#ff6600'],
    powerups: {
        slowBall: '#00ff00',
        extraLife: '#ffffff',
        shrinkPaddle: '#ff4444',
        expandPaddle: '#44ff44'
    }
};

// Audio
let audioContext;
let bgMusic, paddleHitSound, brickHitSound, explosionSound, teleportSound, powerupSound, gameOverSound, levelUpSound, magneticSound, splitSound;

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Initialize audio
    initAudio();
    
    // Event listeners
    setupEventListeners();
    
    // Initialize UI with default values
    score = 0;
    lives = 3;
    level = 1;
    combo = 1;
    updateUI();
    
    // Start title screen animation
    startTitleAnimation();
}

function initAudio() {
    bgMusic = document.getElementById('bgMusic');
    paddleHitSound = document.getElementById('paddleHitSound');
    brickHitSound = document.getElementById('brickHitSound');
    explosionSound = document.getElementById('explosionSound');
    teleportSound = document.getElementById('teleportSound');
    powerupSound = document.getElementById('powerupSound');
    gameOverSound = document.getElementById('gameOverSound');
    levelUpSound = document.getElementById('levelUpSound');
    magneticSound = document.getElementById('magneticSound');
    splitSound = document.getElementById('splitSound');
    
    // Set volume levels
    bgMusic.volume = 0.3;
    [paddleHitSound, brickHitSound, explosionSound, teleportSound, powerupSound, gameOverSound, levelUpSound, magneticSound, splitSound].forEach(sound => {
        sound.volume = 0.5;
    });
}

function setupEventListeners() {
    // Keyboard events
    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        
        if (e.key === 'Escape') {
            if (gameState === 'playing') {
                pauseGame();
            } else if (gameState === 'paused') {
                resumeGame();
            }
        }
        
        if (e.key === ' ') {
    e.preventDefault(); // Prevent default space behavior
    if (gameState === 'playing') {
        launchBall();
    }
}
    });
    
    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });
    
    // Button events
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('menuBtn').addEventListener('click', showMenu);
    document.getElementById('resumeBtn').addEventListener('click', resumeGame);
}

function startTitleAnimation() {
    console.log('startTitleAnimation called');
    const loadingFill = document.querySelector('.loading-fill');
    const loadingText = document.querySelector('.loading-text');
    const startBtn = document.getElementById('startBtn');
    
    console.log('loadingFill:', loadingFill);
    console.log('loadingText:', loadingText);
    console.log('startBtn:', startBtn);
    
    if (!loadingFill || !loadingText || !startBtn) {
        console.error('Missing HTML elements!');
        console.error('loadingFill found:', !!loadingFill);
        console.error('loadingText found:', !!loadingText);
        console.error('startBtn found:', !!startBtn);
        return;
    }
    let progress = 0;
    const loadingInterval = setInterval(() => {
        progress += 2;
        loadingFill.style.width = progress + '%';
        
        if (progress >= 100) {
            clearInterval(loadingInterval);
            loadingText.textContent = 'READY';
            setTimeout(() => {
                startBtn.classList.remove('hidden');
            }, 500);
        }
    }, 50);
}

function startGame() {
    // Stop any existing game loop
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
    
    gameState = 'playing';
    score = 0;
    lives = 3;
    level = 1;
    combo = 1;
    bricksDestroyed = 0;
    
    // Initialize game objects
    initPaddle();
    initBalls();
    initBricks();
    
    // Switch screens
    document.getElementById('titleScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    
    // Update UI immediately
    updateUI();
    
    // Start background music
    bgMusic.play().catch(e => console.log('Audio play failed:', e));
    
    // Start game loop
    gameLoop();
}

function initPaddle() {
    paddle = {
        x: canvas.width / 2 - PADDLE_WIDTH / 2,
        y: canvas.height - 40,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
        speed: 8,
        magnetic: false,
        magneticTimer: 0
    };
}

function initBalls() {
    balls = [{
        x: canvas.width / 2,
        y: canvas.height - 60,
        dx: 0,
        dy: 0,
        radius: BALL_RADIUS,
        speed: 6,
        launched: false,
        trail: []
    }];
}

function initBricks() {
    bricks = [];
    const offsetX = (canvas.width - (BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * 5)) / 2;
    const offsetY = 100;
    
    for (let row = 0; row < BRICK_ROWS; row++) {
        for (let col = 0; col < BRICK_COLS; col++) {
            let type = 'normal';
            let hits = 1;
            
            // Determine brick type based on level and position
            if (Math.random() < 0.1 + (level * 0.02)) {
                const types = ['strong', 'teleport', 'split', 'magnetic', 'explosive'];
                type = types[Math.floor(Math.random() * types.length)];
                if (type === 'strong') hits = 2;
                if (type === 'explosive') hits = 1;
            }
            
            bricks.push({
            x: offsetX + col * (BRICK_WIDTH + 5),
            y: offsetY + row * (BRICK_HEIGHT + 5),
            width: BRICK_WIDTH,
            height: BRICK_HEIGHT,
            type: type,
            hits: hits,
            maxHits: hits,
            destroyed: false,
            glowIntensity: 0,
            crumbling: false,
            crumbleTimer: 0,
            crumbleAlpha: 1,
            justHit: false
        });
        }
    }
}

function gameLoop() {
    if (gameState !== 'playing') {
        if (gameLoopId) {
            cancelAnimationFrame(gameLoopId);
            gameLoopId = null;
        }
        return;
    }
    
    update();
    render();
    gameLoopId = requestAnimationFrame(gameLoop);
}

function update() {
    // Update paddle
    updatePaddle();
    
    // Update balls
    updateBalls();
    
    // Update particles
    updateParticles();
    
    // Update powerups
    updatePowerups();
    
    // Update powerup timers
    updatePowerupTimers();
    // Update combo timer
    updateComboTimer();
    
    // Update brick animations
    updateBrickAnimations();
    
    // Check for level completion
    checkLevelCompletion();
    
    // Update UI
    updateUI();
}

function updatePaddle() {
    // Move paddle
    if (keys['a'] || keys['arrowleft']) {
        paddle.x -= paddle.speed;
    }
    if (keys['d'] || keys['arrowright']) {
        paddle.x += paddle.speed;
    }
    
    // Keep paddle in bounds
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));
    
    // Update magnetic effect
    if (paddle.magnetic) {
        paddle.magneticTimer--;
        if (paddle.magneticTimer <= 0) {
            paddle.magnetic = false;
        }
    }
}

function updateBalls() {
    for (let i = balls.length - 1; i >= 0; i--) {
        let ball = balls[i];
        
        if (!ball.launched) {
            ball.x = paddle.x + paddle.width / 2;
            continue;
        }
        
        // Add to trail
        ball.trail.push({x: ball.x, y: ball.y});
        if (ball.trail.length > 10) ball.trail.shift();
        
        // Move ball
        ball.x += ball.dx;
        ball.y += ball.dy;
        
        // Wall collisions
        if (ball.x <= ball.radius || ball.x >= canvas.width - ball.radius) {
            ball.dx = -ball.dx;
            ball.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, ball.x));
        }
        
        if (ball.y <= ball.radius) {
            ball.dy = -ball.dy;
            ball.y = ball.radius;
        }
        
       // Paddle collision - more precise detection
        if (ball.y + ball.radius >= paddle.y && 
        ball.y + ball.radius <= paddle.y + paddle.height + 5 && // More strict vertical bounds
        ball.x + ball.radius >= paddle.x && 
        ball.x - ball.radius <= paddle.x + paddle.width &&
        ball.dy > 0) {
    
    // Only bounce if ball is actually hitting the top of the paddle
    if (ball.y + ball.radius >= paddle.y && ball.y + ball.radius <= paddle.y + paddle.height) {
        ball.dy = -Math.abs(ball.dy); // Ensure upward direction
        ball.y = paddle.y - ball.radius; // Position ball exactly on paddle surface
        
        // Add spin based on hit position
        let hitPos = (ball.x - paddle.x) / paddle.width;
        ball.dx = (hitPos - 0.5) * 10;
        
        // Magnetic effect
        if (paddle.magnetic) {
            ball.dx *= 0.5;
        }
        
        playSound(paddleHitSound);
    }
}
        
        // Brick collisions
        checkBrickCollisions(ball);
        
        // Remove ball if it goes off screen
        if (ball.y > canvas.height + 100) {
            balls.splice(i, 1);
            if (balls.length === 0) {
                loseLife();
            }
        }
    }
}

function checkBrickCollisions(ball) {
    for (let brick of bricks) {
        if (brick.destroyed || brick.crumbling) continue;
        
        if (ball.x + ball.radius >= brick.x &&
            ball.x - ball.radius <= brick.x + brick.width &&
            ball.y + ball.radius >= brick.y &&
            ball.y - ball.radius <= brick.y + brick.height) {
            
            // Determine collision side and move ball away from brick
            let overlapX = Math.min(ball.x + ball.radius - brick.x, brick.x + brick.width - (ball.x - ball.radius));
            let overlapY = Math.min(ball.y + ball.radius - brick.y, brick.y + brick.height - (ball.y - ball.radius));
            
            if (overlapX < overlapY) {
                ball.dx = -ball.dx;
                // Move ball out of brick
                if (ball.x < brick.x + brick.width / 2) {
                    ball.x = brick.x - ball.radius;
                } else {
                    ball.x = brick.x + brick.width + ball.radius;
                }
            } else {
                ball.dy = -ball.dy;
                // Move ball out of brick
                if (ball.y < brick.y + brick.height / 2) {
                    ball.y = brick.y - ball.radius;
                } else {
                    ball.y = brick.y + brick.height + ball.radius;
                }
            }
            
            // Handle brick hit
            hitBrick(brick, ball);
            return;
        }
    }
}

function hitBrick(brick, ball) {
    // Prevent multiple hits on the same brick in rapid succession
    if (brick.justHit) return;
    
    brick.hits--;
    brick.glowIntensity = 1;
    brick.justHit = true; // Mark brick as recently hit
    
    // Reset the justHit flag after a short delay
    setTimeout(() => {
        brick.justHit = false;
    }, 50);
    
    if (brick.hits <= 0 && !brick.destroyed && !brick.crumbling) {
        // Start crumble animation instead of immediate destruction
        brick.crumbling = true;
        brick.crumbleTimer = 30; // 0.5 seconds at 60fps
        bricksDestroyed++;
        
        // Calculate score with combo
        let baseScore = 100;
        if (brick.type === 'strong') baseScore = 200;
        if (brick.type === 'explosive') baseScore = 300;
        
        score += baseScore * combo;
        combo++;
        comboTimer = COMBO_TIMEOUT; // Reset combo timer
        
        // Create particles
        createParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, COLORS.brickTypes[brick.type]);
        
        // Chance to drop powerup
        if (Math.random() < 0.15) { // 15% chance
            createPowerup(brick.x + brick.width / 2, brick.y + brick.height / 2);
        }
        
        // Handle special brick effects
        handleSpecialBrick(brick, ball);
        
        playSound(brickHitSound);
    } else {
        // Just play hit sound for damaged but not destroyed bricks
        playSound(brickHitSound);
    }
}

function handleSpecialBrick(brick, ball) {
    switch (brick.type) {
        case 'teleport':
            teleportBall(ball);
            playSound(teleportSound);
            break;
        case 'split':
            splitBall(ball);
            playSound(splitSound);
            break;
        case 'magnetic':
            activateMagneticPaddle();
            playSound(magneticSound);
            break;
        case 'explosive':
            explodeBrick(brick);
            playSound(explosionSound);
            break;
    }
}

function createPowerup(x, y) {
    const powerupTypes = ['slowBall', 'extraLife', 'shrinkPaddle', 'expandPaddle'];
    const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    
    powerups.push({
        x: x - 15,
        y: y,
        width: 30,
        height: 15,
        speed: 2,
        type: type,
        color: COLORS.powerups[type]
    });
}

function teleportBall(ball) {
    ball.x = Math.random() * (canvas.width - ball.radius * 2) + ball.radius;
    ball.y = Math.random() * (canvas.height / 2) + canvas.height / 4;
    
    // Create teleport effect
    createParticles(ball.x, ball.y, COLORS.brickTypes.teleport);
}

function splitBall(ball) {
    if (balls.length < 5) { // Limit max balls
        let newBall = {
            x: ball.x,
            y: ball.y,
            dx: -ball.dx * 0.8,
            dy: ball.dy * 0.8,
            radius: ball.radius,
            speed: ball.speed,
            launched: true,
            trail: []
        };
        balls.push(newBall);
    }
}

function activateMagneticPaddle() {
    paddle.magnetic = true;
    paddle.magneticTimer = 300; // 5 seconds at 60fps
}

function explodeBrick(brick) {
    // Destroy nearby bricks
    for (let other of bricks) {
        if (other.destroyed) continue;
        
        let dx = other.x + other.width / 2 - (brick.x + brick.width / 2);
        let dy = other.y + other.height / 2 - (brick.y + brick.height / 2);
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 100) {
            other.destroyed = true;
            bricksDestroyed++;
            score += 50 * combo;
            createParticles(other.x + other.width / 2, other.y + other.height / 2, COLORS.brickTypes[other.type]);
        }
    }
    
    // Create explosion effect
    createExplosion(brick.x + brick.width / 2, brick.y + brick.height / 2);
}

function createParticles(x, y, color) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: x,
            y: y,
            dx: (Math.random() - 0.5) * 10,
            dy: (Math.random() - 0.5) * 10,
            color: color,
            life: 1,
            decay: 0.02
        });
    }
}

function createExplosion(x, y) {
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: x,
            y: y,
            dx: (Math.random() - 0.5) * 15,
            dy: (Math.random() - 0.5) * 15,
            color: COLORS.brickTypes.explosive,
            life: 1,
            decay: 0.015,
            size: Math.random() * 5 + 2
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let particle = particles[i];
        
        particle.x += particle.dx;
        particle.y += particle.dy;
        particle.life -= particle.decay;
        
        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function updatePowerups() {
    for (let i = powerups.length - 1; i >= 0; i--) {
        let powerup = powerups[i];
        
        powerup.y += powerup.speed;
        
        // Check collision with paddle
        if (powerup.y + powerup.height >= paddle.y &&
            powerup.x + powerup.width >= paddle.x &&
            powerup.x <= paddle.x + paddle.width) {
            
            // Activate powerup
            activatePowerup(powerup.type);
            powerups.splice(i, 1);
            playSound(powerupSound);
        }
        
        // Remove if off screen
        if (powerup.y > canvas.height) {
            powerups.splice(i, 1);
        }
    }
}

function updatePowerupTimers() {
    // Slow ball effect
if (slowBallTimer > 0) {
    slowBallTimer--;
    if (slowBallTimer === 599) { // Only apply on first frame
        balls.forEach(ball => {
            if (ball.launched) {
                ball.dx *= 0.5; // Reduce to 50% speed once
                ball.dy *= 0.5;
            }
        });
    }
} else if (slowBallTimer === 0) {
    // Reset ball speed when effect ends
    balls.forEach(ball => {
        if (ball.launched) {
            // Restore normal speed
            let currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
            if (currentSpeed < 3) { // If too slow, restore to normal
                let angle = Math.atan2(ball.dy, ball.dx);
                ball.dx = Math.cos(angle) * 6;
                ball.dy = Math.sin(angle) * 6;
            }
        }
    });
}
    
    // Shrink paddle effect
    if (shrinkPaddleTimer > 0) {
        shrinkPaddleTimer--;
        if (shrinkPaddleTimer === 449) { // First frame
            paddle.width = Math.max(paddle.width * 0.6, 40);
        }
    } else if (shrinkPaddleTimer === 0 && paddle.width < paddleOriginalWidth) {
        paddle.width = paddleOriginalWidth;
    }
    
    // Expand paddle effect
    if (expandPaddleTimer > 0) {
        expandPaddleTimer--;
        if (expandPaddleTimer === 449) { // First frame
            paddle.width = Math.min(paddle.width * 1.5, 200);
        }
    } else if (expandPaddleTimer === 0 && paddle.width > paddleOriginalWidth) {
        paddle.width = paddleOriginalWidth;
    }
}

function updateBrickAnimations() {
    for (let brick of bricks) {
        if (brick.crumbling) {
            brick.crumbleTimer--;
            brick.crumbleAlpha = brick.crumbleTimer / 30;
            
            if (brick.crumbleTimer <= 0) {
                brick.destroyed = true;
                brick.crumbling = false;
            }
        }
    }
}

function updateComboTimer() {
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0 && combo > 1) {
            combo = 1; // Reset combo
        }
    }
}

function activatePowerup(type) {
    switch (type) {
        case 'extraLife':
            lives++;
            updateUI();
            break;
        case 'multiball':
            splitBall(balls[0]);
            break;
        case 'largePaddle':
            paddle.width = Math.min(paddle.width + 20, 150);
            break;
        case 'slowBall':
            slowBallTimer = 600; // 10 seconds at 60fps
            break;
        case 'shrinkPaddle':
            shrinkPaddleTimer = 450; // 7.5 seconds
            break;
        case 'expandPaddle':
            expandPaddleTimer = 450; // 7.5 seconds
            break;
    }
}

function launchBall() {
    let hasUnlaunchedBall = false;
    for (let ball of balls) {
        if (!ball.launched) {
            hasUnlaunchedBall = true;
            ball.launched = true;
            ball.dx = (Math.random() - 0.5) * 4;
            ball.dy = -ball.speed;
        }
    }
    // Only launch if there were unlaunched balls
    return hasUnlaunchedBall;
}

function loseLife() {
    lives--;
    combo = 1;
    
    // Update UI to show new lives count
    updateUI();
    
    // Add visual feedback for losing a life
    const livesElement = document.getElementById('lives');
    if (livesElement) {
        livesElement.classList.add('lives-lost');
        setTimeout(() => {
            livesElement.classList.remove('lives-lost');
        }, 500);
    }
    
    if (lives <= 0) {
        gameOver();
    } else {
        // Reset ball
        initBalls();
    }
}

function gameOver() {
    gameState = 'gameOver';
    bgMusic.pause();
    playSound(gameOverSound);
    
    // Switch screens
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.remove('hidden');
    
    // Update final score
    document.getElementById('finalScore').textContent = score;
    
    // Update bricks destroyed count
    const bricksDestroyedElement = document.getElementById('bricksDestroyed');
    if (bricksDestroyedElement) {
        bricksDestroyedElement.textContent = bricksDestroyed;
    }
}

function checkLevelCompletion() {
    let activeBricks = bricks.filter(brick => !brick.destroyed).length;
    
    if (activeBricks === 0) {
        level++;
        playSound(levelUpSound);
        
        // Bonus points for completing level
        score += 1000 * level;
        
        // Initialize new level
        initBricks();
        initBalls();
        
        // Increase difficulty
        balls.forEach(ball => {
            ball.speed += 0.5;
        });
        paddle.speed += 0.5;
    }
}

function updateUI() {
    // Update score
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = score.toString().padStart(6, '0');
    }
    
    // Update lives - handle visual life icons
    const livesElement = document.getElementById('lives');
    if (livesElement) {
        // Clear existing life icons
        livesElement.innerHTML = '';
        
        // Add life icons based on current lives count
        for (let i = 0; i < lives; i++) {
            const lifeIcon = document.createElement('span');
            lifeIcon.className = 'life-icon';
            lifeIcon.textContent = '◆';
            livesElement.appendChild(lifeIcon);
        }
    } else {
        console.error('Lives element not found! Check your HTML for id="lives"');
    }
    
    // Update level
    const levelElement = document.getElementById('level');
    if (levelElement) {
        levelElement.textContent = level.toString().padStart(2, '0');
    }
    
    // Update combo
    const comboElement = document.getElementById('combo');
    if (comboElement) {
        comboElement.textContent = 'x' + combo;
    }
}

function render() {
    // Clear canvas with fade effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Render particles
    renderParticles();
    
    // Render bricks
    renderBricks();
    
    // Render paddle
    renderPaddle();
    
    // Render balls
    renderBalls();
    
    // Render powerups
    renderPowerups();
}

function renderBricks() {
    for (let brick of bricks) {
        if (brick.destroyed) continue;
        
        ctx.save();
        
        // Glow effect
        if (brick.glowIntensity > 0) {
            ctx.shadowColor = COLORS.brickTypes[brick.type];
            ctx.shadowBlur = brick.glowIntensity * 20;
            brick.glowIntensity -= 0.05;
        }
        
        // Damage effect
        let alpha = brick.hits / brick.maxHits;
        if (brick.crumbling) {
            alpha *= brick.crumbleAlpha;
        }
        ctx.fillStyle = COLORS.brickTypes[brick.type] + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        
        // Draw brick
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        
        // Draw border
        ctx.strokeStyle = COLORS.brickTypes[brick.type];
        ctx.lineWidth = 2;
        ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
        
        ctx.restore();
    }
}

function renderPaddle() {
    ctx.save();
    
    // Magnetic effect
    if (paddle.magnetic) {
        ctx.shadowColor = COLORS.brickTypes.magnetic;
        ctx.shadowBlur = 20;
    }
    
    ctx.fillStyle = COLORS.paddle;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    
    // Draw border
    ctx.strokeStyle = COLORS.paddle;
    ctx.lineWidth = 2;
    ctx.strokeRect(paddle.x, paddle.y, paddle.width, paddle.height);
    
    ctx.restore();
}

function renderBalls() {
    for (let ball of balls) {
        // Render trail
        for (let i = 0; i < ball.trail.length; i++) {
            let pos = ball.trail[i];
            let alpha = i / ball.trail.length;
            
            ctx.save();
            ctx.globalAlpha = alpha * 0.5;
            ctx.fillStyle = COLORS.ball;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, ball.radius * alpha, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        // Render ball
        ctx.save();
        ctx.shadowColor = COLORS.ball;
        ctx.shadowBlur = 15;
        ctx.fillStyle = COLORS.ball;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function renderParticles() {
    for (let particle of particles) {
        ctx.save();
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        
        let size = particle.size || 3;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function renderPowerups() {
    for (let powerup of powerups) {
        ctx.save();
        ctx.fillStyle = powerup.color;
        ctx.fillRect(powerup.x, powerup.y, powerup.width, powerup.height);
        ctx.restore();
    }
}

function pauseGame() {
    gameState = 'paused';
    bgMusic.pause();
    
    document.getElementById('pauseScreen').classList.remove('hidden');
}

function resumeGame() {
    gameState = 'playing';
    bgMusic.play().catch(e => console.log('Audio play failed:', e));
    
    document.getElementById('pauseScreen').classList.add('hidden');
    
    // Only start game loop if not already running
    if (!gameLoopId) {
        gameLoop();
    }
}

function restartGame() {
    // Stop any existing game loop
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
    
    // Hide all screens
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    
    // Reset game state
    gameState = 'playing';
    score = 0;
    lives = 3;
    level = 1;
    combo = 1;
    bricksDestroyed = 0;

    // Reset powerup timers
    paddleOriginalWidth = PADDLE_WIDTH;
    slowBallTimer = 0;
    shrinkPaddleTimer = 0;
    expandPaddleTimer = 0;
    comboTimer = 0;
    
    // Clear arrays
    balls = [];
    bricks = [];
    particles = [];
    powerups = [];
    
    // Initialize game objects
    initPaddle();
    initBalls();
    initBricks();
    
    // Show game screen
    document.getElementById('gameScreen').classList.remove('hidden');
    
    // Update UI immediately
    updateUI();
    
    // Start music
    bgMusic.currentTime = 0;
    bgMusic.play().catch(e => console.log('Audio play failed:', e));
    
    // Start game loop
    gameLoop();
}

function showMenu() {
    // Hide all screens
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    
    // Show title screen
    document.getElementById('titleScreen').classList.remove('hidden');
    
    // Stop music
    bgMusic.pause();
    bgMusic.currentTime = 0;
    
    // Reset game state
    gameState = 'title';
    
    // Reset start button
    document.getElementById('startBtn').classList.remove('hidden');
}

function playSound(sound) {
    try {
        sound.currentTime = 0;
        sound.play().catch(e => console.log('Sound play failed:', e));
    } catch (e) {
        console.log('Sound error:', e);
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', init);