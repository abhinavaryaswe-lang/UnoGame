// const socket = window.socket;

function removeElementIfPresent(id) {
    const element = document.getElementById(id);
    if (element) {
        element.remove();
    }
}

function getControlRail() {
    return document.getElementById('controlRail');
}

function updateOrientationLock() {
    const orientationLock = document.getElementById('orientationLock');
    if (!orientationLock) {
        return;
    }

    const isMobileOrSmallScreen =
        window.innerWidth <= 700 ||
        (window.innerWidth <= 900 && window.matchMedia('(pointer: coarse)').matches);
    const isPortrait = window.innerHeight > window.innerWidth;
    const isGameActive = gameScreen.classList.contains('active');
    const shouldLock = isGameActive && isMobileOrSmallScreen && isPortrait;

    orientationLock.classList.toggle('active', shouldLock);
    gameScreen.classList.toggle('portrait-locked', shouldLock);
}

function setStatus(headline, roomText = 'LIVE TABLE') {
    const statusHeadline = document.getElementById('statusHeadline');
    const roomBadge = document.getElementById('roomBadge');

    if (statusHeadline) {
        statusHeadline.textContent = headline;
    }

    if (roomBadge) {
        roomBadge.textContent = roomText;
    }
}

function showGameScreen(roomCode = currentRoomCode) {
    preGameScreen.style.display = 'none';
    gameScreen.style.display = 'grid';
    gameScreen.classList.add('active');
    updateOrientationLock();

    if (roomCode) {
        currentRoomCode = roomCode;
    }

    if (typeof updateStoredSession === 'function') {
        updateStoredSession({
            roomCode: currentRoomCode || roomCode || '',
            phase: 'game'
        });
    }
}

function showToast(message, duration = 2600) {
    const toastStack = document.getElementById('toastStack');
    if (!toastStack) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastStack.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, duration);
}

function showVictoryOverlay(winnerName) {
    const overlay = document.getElementById('victoryOverlay');
    const winnerLabel = document.getElementById('victoryName');
    const confettiLayer = document.getElementById('confettiLayer');
    if (!overlay || !winnerLabel || !confettiLayer) {
        return;
    }

    winnerLabel.textContent = winnerName;
    confettiLayer.innerHTML = '';
    overlay.classList.add('active');

    const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ffffff'];
    for (let i = 0; i < 90; i++) {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = colors[i % colors.length];
        piece.style.animationDuration = `${3 + Math.random() * 2.2}s`;
        piece.style.animationDelay = `${Math.random() * 0.8}s`;
        piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 220}px`);
        piece.style.transform = `rotate(${Math.random() * 360}deg)`;
        confettiLayer.appendChild(piece);
    }

    window.setTimeout(() => {
        overlay.classList.remove('active');
        confettiLayer.innerHTML = '';
        window.location.href = '/';
    }, 4500);
}

function getSeatOrder(playersInfo, yourIndex) {
    if (!playersInfo.length) {
        return [];
    }

    const rotatedPlayers = playersInfo.map((player, index) => {
        const relativeIndex = (index - yourIndex + playersInfo.length) % playersInfo.length;
        return {
            ...player,
            originalIndex: index,
            relativeIndex
        };
    });

    const seatPriority = [0, 1, 2, 3];

    return rotatedPlayers
        .sort((left, right) => left.relativeIndex - right.relativeIndex)
        .map((player, index) => ({
            ...player,
            seatIndex: seatPriority[index] ?? index
        }))
        .sort((left, right) => left.seatIndex - right.seatIndex);
}

function renderUnoControls(canCallUno, canCatchUno, unoPendingPlayerName) {
    removeElementIfPresent('unoButton');
    removeElementIfPresent('catchUnoButton');

    const gameBox = getControlRail();

    if (canCallUno) {
        const unoButton = document.createElement('button');
        unoButton.id = 'unoButton';
        unoButton.textContent = 'UNO!';
        unoButton.className = 'action-button warn';
        unoButton.addEventListener('click', () => {
            socket.emit('callUno');
            unoButton.remove();
        });
        gameBox.appendChild(unoButton);
    }

    if (canCatchUno) {
        const catchUnoButton = document.createElement('button');
        catchUnoButton.id = 'catchUnoButton';
        catchUnoButton.textContent = `Catch UNO: ${unoPendingPlayerName}`;
        catchUnoButton.className = 'action-button dark';
        catchUnoButton.addEventListener('click', () => {
            socket.emit('catchUno');
            catchUnoButton.remove();
        });
        gameBox.appendChild(catchUnoButton);
    }
}

socket.on('gameStarted', data => {
    showGameScreen(data.roomCode);
    setStatus('Your table is live. First turn is ready.', 'MATCH STARTED');

    displayCards(
        data.yourCards,
        data.players,
        data.yourIndex,
        data.turn,
        data.lastPlayedCard,
        data.suitch
    );
});

function displayCards(yourCards, playersInfo, yourIndex, turn, lastPlayedCard, suitch) {
    const playerContainers = [
        document.querySelector('.player1'),
        document.querySelector('.player2'),
        document.querySelector('.player3'),
        document.querySelector('.player4')
    ];
    const seatPlayers = getSeatOrder(playersInfo, yourIndex);
    const localTurn = playersInfo.length
        ? (turn - yourIndex + playersInfo.length) % playersInfo.length
        : 0;
    const activeSeatIndex = [0, 1, 2, 3][localTurn] ?? 0;

    playerContainers.forEach((container, index) => {
        if (!container) {
            return;
        }

        const hasPlayer = index < seatPlayers.length;
        container.classList.toggle('seat-empty', !hasPlayer);
        if (!hasPlayer) {
            container.innerHTML = '';
        }
    });

    seatPlayers.forEach((player, seatIndex) => {
        const container = playerContainers[seatIndex];
        if (!container) {
            return;
        }

        container.classList.toggle('current-turn', seatIndex === activeSeatIndex);
        container.innerHTML = '';

        const playername = document.createElement('h2');
        const name = document.createElement('span');
        name.textContent = seatIndex === 0 ? 'You' : player.name;
        const cardCount = document.createElement('span');
        cardCount.className = 'card-count';
        cardCount.textContent = `${player.count} ${player.count === 1 ? 'card' : 'cards'}`;
        playername.appendChild(name);
        playername.appendChild(cardCount);
        container.appendChild(playername);

        const cardsStrip = document.createElement('div');
        cardsStrip.className = seatIndex === 0
            ? 'cards-strip hand-cards'
            : `cards-strip opponent-cards ${seatIndex === 1 || seatIndex === 3 ? 'side-hand' : 'far-hand'}`;
        cardsStrip.setAttribute('aria-label', `${player.name}'s cards`);
        container.appendChild(cardsStrip);

        if (seatIndex === 0) {
            yourCards.forEach((card, cardIndex) => {
                const cardButton = document.createElement('button');
                cardButton.type = 'button';
                cardButton.className = 'hand-card';
                cardButton.setAttribute('aria-label', `Play ${card}`);
                cardButton.title = `Play ${card}`;
                cardButton.style.setProperty('--card-index', cardIndex);
                cardButton.style.setProperty('--card-count', yourCards.length);
                cardButton.style.setProperty(
                    '--card-angle',
                    `${(cardIndex - (yourCards.length - 1) / 2) * 2.2}deg`
                );
                cardButton.style.zIndex = String(cardIndex + 1);
                cardButton.disabled = seatIndex !== activeSeatIndex;

                const img = document.createElement('img');
                img.src = `CardsFront/${card}.png`;
                img.className = 'your-card';
                img.alt = card;

                cardButton.addEventListener('click', () => {
                    if (seatIndex !== activeSeatIndex) {
                        return;
                    }
                    onCardClick(card, seatIndex, activeSeatIndex);
                });

                cardButton.appendChild(img);
                cardsStrip.appendChild(cardButton);
            });
        } else {
            for (let i = 0; i < player.count; i++) {
                const img = document.createElement('img');
                img.src = 'card-back.png';
                img.className = 'opponent-card';
                img.alt = '';
                img.setAttribute('aria-hidden', 'true');
                cardsStrip.appendChild(img);
            }
        }
    });

    const cardSourceContainer = document.querySelector('.center-container .center-card:nth-child(2)');
    cardSourceContainer.innerHTML = '';

    const img = document.createElement('img');
    img.src = 'card-back.png';
    img.className = 'draw-pile-card';
    img.style.cursor = yourIndex === turn && suitch ? 'pointer' : 'default';
    img.style.opacity = yourIndex === turn && suitch ? '1' : '0.7';

    img.addEventListener('click', () => {
        if (yourIndex === turn && suitch) {
            onDrawCardClick();
        }
    });

    cardSourceContainer.appendChild(img);

    const cardsPlayedDiv = document.querySelector('.cards-played');
    cardsPlayedDiv.innerHTML = `
        <img src="CardsFront/${lastPlayedCard}.png" class="discard-card">
    `;

    if (activeSeatIndex === 0) {
        setStatus(suitch ? 'Your turn. Play a card or draw from the deck.' : 'You drew a card. Play it or pass the turn.', 'YOUR MOVE');
    } else {
        const activePlayer = playersInfo[turn];
        setStatus(`${activePlayer ? activePlayer.name : 'Another player'} is thinking. Watch the table.`, 'LIVE TABLE');
    }
}

function onCardClick(card, index) {
    socket.emit('playedCard', { card: card, index: index });
}

socket.on('game_state', data => {
    removeElementIfPresent('passButton');
    removeElementIfPresent('drawFourDecision');
    showGameScreen(data.roomCode);

    displayCards(
        data.yourCards,
        data.players,
        data.yourIndex,
        data.currentTurn,
        data.currentCard,
        data.suitch
    );
    renderUnoControls(data.canCallUno, data.canCatchUno, data.unoPendingPlayerName);
});

function onDrawCardClick() {
    socket.emit('drawCard');
}

socket.on('drawn_state', data => {
    showGameScreen(data.roomCode);
    displayCards(
        data.yourCards,
        data.players,
        data.yourIndex,
        data.currentTurn,
        data.currentCard,
        data.suitch
    );

    removeElementIfPresent('passButton');
    removeElementIfPresent('drawFourDecision');
    renderUnoControls(data.canCallUno, data.canCatchUno, data.unoPendingPlayerName);

    const gameBox = getControlRail();
    const pass = document.createElement('button');
    pass.id = 'passButton';
    pass.textContent = 'Pass';
    pass.className = 'action-button dark';

    gameBox.appendChild(pass);

    pass.addEventListener('click', () => {
        socket.emit('passTurn');
        pass.remove();
    });
});

socket.on('chooseColor', () => {
    removeElementIfPresent('colorOptions');

    const colors = ['R', 'G', 'B', 'Y'];
    const colorOptionsDiv = document.createElement('div');
    colorOptionsDiv.id = 'colorOptions';
    colorOptionsDiv.className = 'game-modal';

    const title = document.createElement('p');
    title.textContent = 'Choose the next color';
    colorOptionsDiv.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    colors.forEach(color => {
        const colorBtn = document.createElement('button');
        colorBtn.textContent = color;
        colorBtn.className = 'action-button';

        colorBtn.addEventListener('click', () => {
            socket.emit('colorChosen', color);
            colorOptionsDiv.remove();
        });

        actions.appendChild(colorBtn);
    });

    colorOptionsDiv.appendChild(actions);
    document.body.appendChild(colorOptionsDiv);
});

socket.on('draw_four_pending', data => {
    removeElementIfPresent('passButton');
    removeElementIfPresent('drawFourDecision');

    const decisionBox = document.createElement('div');
    decisionBox.id = 'drawFourDecision';
    decisionBox.className = 'game-modal';

    const text = document.createElement('p');
    text.textContent = `${data.offenderName} played Draw Four. Challenge?`;
    decisionBox.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const challengeButton = document.createElement('button');
    challengeButton.textContent = 'Challenge';
    challengeButton.className = 'action-button cool';
    challengeButton.addEventListener('click', () => {
        socket.emit('drawFourDecision', { challenge: true });
        decisionBox.remove();
    });

    const acceptButton = document.createElement('button');
    acceptButton.textContent = 'Accept +4';
    acceptButton.className = 'action-button warn';
    acceptButton.addEventListener('click', () => {
        socket.emit('drawFourDecision', { challenge: false });
        decisionBox.remove();
    });

    actions.appendChild(challengeButton);
    actions.appendChild(acceptButton);
    decisionBox.appendChild(actions);
    document.body.appendChild(decisionBox);
});

socket.on('draw_four_result', data => {
    removeElementIfPresent('drawFourDecision');
    showToast(data.message, 3200);
});

socket.on('uno_called', data => {
    showToast(`${data.playerName} called UNO!`);
});

socket.on('uno_penalty', data => {
    showToast(`${data.callerName} did not call UNO and draws 2 cards.`, 3200);
});

socket.on('game_over', data => {
    removeElementIfPresent('passButton');
    removeElementIfPresent('colorOptions');
    removeElementIfPresent('drawFourDecision');
    removeElementIfPresent('unoButton');
    removeElementIfPresent('catchUnoButton');
    gameScreen.classList.remove('active');
    updateOrientationLock();
    if (typeof updateStoredSession === 'function') {
        updateStoredSession({
            phase: 'lobby'
        });
    }
    showVictoryOverlay(data.winner);
});

window.addEventListener('resize', updateOrientationLock);
window.addEventListener('orientationchange', updateOrientationLock);
