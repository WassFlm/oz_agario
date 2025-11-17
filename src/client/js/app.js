var io = require('socket.io-client');
var render = require('./render');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');

var playerNameInput = document.getElementById('playerNameInput');
var socket;

// DEFAULT SKIN
global.player_skin = "./img/dude.jpeg";

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

function startGame(type) {
    document.getElementById('backgroundImg').style.display = 'none';
    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    if (!socket) {
        socket = io({
            query: {
                type: type,
                player_skin: global.player_skin
            }
        });
        setupSocket(socket);
    }

    if (!global.animLoopHandle)
        animloop();

    socket.emit('respawn');
    window.chat.socket = socket;
    window.chat.registerFunctions();
    window.canvas.socket = socket;
    global.socket = socket;
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function () {

    var btn           = document.getElementById('startButton'),
        nickErrorText = document.querySelector('#startMenu .input-error'),
        skinsButton   = document.getElementById("skinsButton"),
        contractButton = document.getElementById("contractButton"),
        skinsContainer = document.getElementById("skinsMenu"),
        selectButtons  = document.getElementsByClassName('skin-select');

    // ===========================
    // Skin selection logic
    // ===========================
    const skinToast = document.getElementById('skinSelectedToast');

    for (const button of selectButtons) {
        button.onclick = () => {
            let card = button.parentElement;
            let img = card.querySelector(".skin-image img");

            if (img && img.src) {
                global.player_skin = img.src;
            } else {
                global.player_skin = "./img/solana.webp";
            }

            const allItems = document.querySelectorAll("#skinsMenu .skin-item");
            allItems.forEach(item => item.classList.remove("selected"));
            card.classList.add("selected");

            if (skinToast) {
                skinToast.textContent = "Skin selected!";
                skinToast.classList.add("visible");
                setTimeout(() => {
                    skinToast.classList.remove("visible");
                }, 1200);
            }

            skinsContainer.style.display = "none";
        };
    }

    skinsButton.onclick = () => {
        skinsContainer.style.display = "flex";
    };

        // ===========================
    // Airdrop wheel logic
    // ===========================
    const wheelCanvas     = document.getElementById('wheelCanvas');
    const spinWheelButton = document.getElementById('spinWheelButton');
    const wheelResult     = document.getElementById('wheelResult');

    // Modal elements
    const airdropModal    = document.getElementById('airdropModal');
    const airdropHashBox  = document.getElementById('airdropHash');
    const closeAirdropBtn = document.getElementById('closeAirdropModal');

    if (wheelCanvas && spinWheelButton && wheelResult) {
        const ctx         = wheelCanvas.getContext('2d');
        const FULL_ANGLE  = Math.PI * 2;
        const SLICE_COUNT = 20;           // 3 slices total
        const SLICE_ANGLE = FULL_ANGLE / SLICE_COUNT;
        const AIRDROP_INDEX = 1;         // winning slice index (0,1,2)
        const radius      = wheelCanvas.width / 2;

        let currentRotation = 0;
        let isSpinning      = false;

        const sliceLabels = [];
        for (let i = 0; i < SLICE_COUNT; i++) {
            sliceLabels.push(i === AIRDROP_INDEX ? 'AIRDROP' : '');
        }

        function drawWheel() {
            ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

            ctx.save();
            ctx.translate(radius, radius);
            ctx.rotate(currentRotation);

            for (let i = 0; i < SLICE_COUNT; i++) {
                const startAngle = i * SLICE_ANGLE;
                const endAngle   = startAngle + SLICE_ANGLE;

                const isAirdrop = (i === AIRDROP_INDEX);
                const baseColor = isAirdrop ? '#1abc9c' : '#111111';
                const edgeColor = isAirdrop ? '#16a085' : '#222222';

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, radius - 6, startAngle, endAngle);
                ctx.closePath();

                const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, radius - 6);
                grad.addColorStop(0, '#000000');
                grad.addColorStop(1, baseColor);
                ctx.fillStyle = grad;
                ctx.fill();

                ctx.strokeStyle = edgeColor;
                ctx.lineWidth   = 2;
                ctx.stroke();

                const label = sliceLabels[i];
                if (label) {
                    ctx.save();
                    const mid = startAngle + SLICE_ANGLE / 2;
                    ctx.rotate(mid);
                    ctx.translate(radius * 0.6, 0);
                    ctx.rotate(Math.PI / 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(label, 0, 0);
                    ctx.restore();
                }
            }

            ctx.restore();
        }

        // Initial draw
        drawWheel();

        function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        // Generate 0x + 64 hex chars
        function generateHash() {
            if (window.crypto && window.crypto.getRandomValues) {
                const bytes = new Uint8Array(32);
                window.crypto.getRandomValues(bytes);

                let hex = '0x';
                for (let b of bytes) {
                    hex += b.toString(16).padStart(2, '0');
                }
                return hex;
            }

            // fallback
            let fallback = '0x';
            for (let i = 0; i < 64; i++) {
                fallback += Math.floor(Math.random() * 16).toString(16);
            }
            return fallback;
        }

        function showAirdropModal(hash) {
            if (!airdropModal || !airdropHashBox) return;
            airdropHashBox.textContent = hash;
            airdropModal.style.display = 'flex';
        }

        if (closeAirdropBtn && airdropModal) {
            closeAirdropBtn.addEventListener('click', () => {
                airdropModal.style.display = 'none';
            });

            airdropModal.addEventListener('click', (e) => {
                if (e.target === airdropModal) {
                    airdropModal.style.display = 'none';
                }
            });
        }

        function spinWheel() {
            if (isSpinning) return;
            isSpinning = true;

            wheelResult.textContent = '';
            wheelResult.classList.remove('win', 'lose');
            spinWheelButton.classList.add('spinning');

            const duration = 3000;
            const start    = performance.now();

            // Just choose a random offset angle in [0, 2π)
            const randomOffset = Math.random() * FULL_ANGLE;
            const extraTurns   = 3 + Math.random() * 3;

            // This is the total additional rotation we will add
            const targetRotation = extraTurns * FULL_ANGLE + randomOffset;

            const initialRotation = currentRotation;

            function animate(now) {
                const elapsed = now - start;
                const t       = Math.min(elapsed / duration, 1);
                const eased   = easeOutCubic(t);

                currentRotation = initialRotation + targetRotation * eased;
                drawWheel();

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    finishSpin();
                }
            }

            requestAnimationFrame(animate);
        }

        function finishSpin() {
            isSpinning = false;
            spinWheelButton.classList.remove('spinning');

            // Normalize rotation to [0, 2π)
            let normalized = currentRotation % FULL_ANGLE;
            if (normalized < 0) normalized += FULL_ANGLE;

            // Pointer is at the TOP of the wheel → angle = -π/2 in canvas coordinates.
            // A slice center at angle θ (in wheel space) is drawn at θ + normalized.
            // We want θ + normalized ≡ -π/2  (mod 2π)
            // => θ ≡ -π/2 - normalized.
            let pointerAngle = -Math.PI / 2 - normalized;
            pointerAngle %= FULL_ANGLE;
            if (pointerAngle < 0) pointerAngle += FULL_ANGLE;

            const landedIndex = Math.floor(pointerAngle / SLICE_ANGLE);

            if (landedIndex === AIRDROP_INDEX) {
                const hash = generateHash();
                wheelResult.textContent = 'You won an AIRDROP!';
                wheelResult.classList.add('win');
                showAirdropModal(hash);
            } else {
                wheelResult.textContent = 'Nothing this time...';
                wheelResult.classList.add('lose');
            }
        }

        // Spin on button click
        spinWheelButton.addEventListener('click', spinWheel);

        // Spin when clicking the wheel itself
        wheelCanvas.addEventListener('click', spinWheel);

        // Optional: also spin via contract button
        if (contractButton) {
            contractButton.addEventListener('click', (e) => {
                e.preventDefault();
                spinWheel();
            });
        }
    }


    // Start game button
    btn.onclick = function () {
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame('player');
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;
        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// =========================================
// Game + socket logic
// =========================================

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screen.width / 2,
    y: global.screen.height / 2,
    screenWidth: global.screen.width,
    screenHeight: global.screen.height,
    target: { x: global.screen.width / 2, y: global.screen.height / 2 }
};
global.player = player;

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = { x: player.x, y: player.y };
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

var c = window.canvas.cv;
var graph = c.getContext('2d');

$("#feed").click(function () {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    socket.emit('2');
    window.canvas.reenviar = false;
});

function handleDisconnect() {
    socket.close();
    if (!global.kicked) {
        render.drawErrorMessage('Disconnected!', graph, global.screen);
    }
}

function setupSocket(socket) {
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    socket.on('connect_error', handleDisconnect);
    socket.on('disconnect', handleDisconnect);

    socket.on('welcome', function (playerSettings, gameSizes) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screen.width;
        player.screenHeight = global.screen.height;
        player.target = window.canvas.target;

        player.skin = player.skin || global.player_skin || "./img/solana.webp";
        global.player = player;
        window.chat.player = player;

        socket.emit('gotit', player);

        global.gameStart = true;
        window.chat.addSystemLine('Connected to the game!');
        window.chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        if (global.mobile) {
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
        c.focus();
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
    });

    socket.on('playerDied', (data) => {
        const pname = isUnnamedCell(data.playerEatenName) ? 'An unnamed cell' : data.playerEatenName;
        window.chat.addSystemLine('{GAME} - <b>' + pname + '</b> was eaten');
    });

    socket.on('playerDisconnect', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' +
            (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) +
            '</b> disconnected.');
    });

    socket.on('playerJoin', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' +
            (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) +
            '</b> joined.');
    });

    socket.on('leaderboard', (data) => {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id == player.id) {
                if (leaderboard[i].name.length !== 0)
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + "</span>";
                else
                    status += '<span class="me">' + (i + 1) + ". An unnamed cell</span>";
            } else {
                if (leaderboard[i].name.length !== 0)
                    status += (i + 1) + '. ' + leaderboard[i].name;
                else
                    status += (i + 1) + '. An unnamed cell';
            }
        }
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList, massList, virusList) {
        if (global.playerType == 'player') {
            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
            player.skin = playerData.skin || global.player_skin || "./img/solana.webp";
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
    });

    socket.on('RIP', function () {
        global.gameStart = false;
        render.drawErrorMessage('You died!', graph, global.screen);
        window.setTimeout(() => {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
            if (global.animLoopHandle) {
                window.cancelAnimationFrame(global.animLoopHandle);
                global.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('kick', function (reason) {
        global.gameStart = false;
        global.kicked = true;
        if (reason !== '') {
            render.drawErrorMessage('You were kicked for: ' + reason, graph, global.screen);
        } else {
            render.drawErrorMessage('You were kicked!', graph, global.screen);
        }
        socket.close();
    });
}

const isUnnamedCell = (name) => name.length < 1;

const getPosition = (entity, player, screen) => {
    return {
        x: entity.x - player.x + screen.width / 2,
        y: entity.y - player.y + screen.height / 2
    };
};

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

window.cancelAnimFrame = (function (handle) {
    return window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    if (global.gameStart) {
        graph.fillStyle = global.backgroundColor;
        graph.fillRect(0, 0, global.screen.width, global.screen.height);

        render.drawGrid(global, player, global.screen, graph);

        foods.forEach(food => {
            let position = getPosition(food, player, global.screen);
            render.drawFood(position, food, graph);
        });

        fireFood.forEach(fireFood => {
            let position = getPosition(fireFood, player, global.screen);
            render.drawFireFood(position, fireFood, playerConfig, graph);
        });

        viruses.forEach(virus => {
            let position = getPosition(virus, player, global.screen);
            render.drawVirus(position, virus, graph);
        });

        let borders = {
            left: global.screen.width / 2 - player.x,
            right: global.screen.width / 2 + global.game.width - player.x,
            top: global.screen.height / 2 - player.y,
            bottom: global.screen.height / 2 + global.game.height - player.y
        };

        if (global.borderDraw) {
            render.drawBorder(borders, graph);
        }

        var cellsToDraw = [];
        for (var i = 0; i < users.length; i++) {
            let color = 'hsl(' + users[i].hue + ', 100%, 50%)';
            let borderColor = 'hsl(' + users[i].hue + ', 100%, 45%)';

            for (var j = 0; j < users[i].cells.length; j++) {
                cellsToDraw.push({
                    color: color,
                    borderColor: borderColor,
                    mass: users[i].cells[j].mass,
                    name: users[i].name,
                    radius: users[i].cells[j].radius,
                    x: users[i].cells[j].x - player.x + global.screen.width / 2,
                    y: users[i].cells[j].y - player.y + global.screen.height / 2,
                    skin: users[i].skin
                });
            }
        }

        cellsToDraw.sort(function (obj1, obj2) {
            return obj1.mass - obj2.mass;
        });

        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph);

        socket.emit('0', window.canvas.target); // Heartbeat.
    }
}

window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;

    player.screenWidth = c.width = global.screen.width =
        global.playerType == 'player' ? window.innerWidth : global.game.width;
    player.screenHeight = c.height = global.screen.height =
        global.playerType == 'player' ? window.innerHeight : global.game.height;

    if (global.playerType == 'spectator') {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    socket.emit('windowResized', {
        screenWidth: global.screen.width,
        screenHeight: global.screen.height
    });
}
