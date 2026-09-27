(() => {
    const soundEnabledKey = 'unoArenaSoundEnabled';
    const audioRoot = '/audio/card-game-sounds/cockatrice/';
    const audioFiles = {
        button: `${audioRoot}tap.wav`,
        card: `${audioRoot}playcard.wav`,
        draw: `${audioRoot}draw.wav`,
        shuffle: `${audioRoot}shuffle.wav`,
        color: `${audioRoot}stagechangeoldnotification.wav`,
        pass: `${audioRoot}Passturn.wav`,
        start: `${audioRoot}cuckoo.wav`
    };

    let soundEnabled = localStorage.getItem(soundEnabledKey) !== 'false';
    let previousState = null;

    const music = new Audio('/audio/happy-loop.mp3');
    music.loop = true;
    music.volume = 0.16;
    music.preload = 'auto';

    function playSound(name, volume = 0.45) {
        if (!soundEnabled || !audioFiles[name]) {
            return;
        }

        const sound = new Audio(audioFiles[name]);
        sound.volume = volume;
        sound.play().catch(() => {});
    }

    function startMusic() {
        if (soundEnabled && music.paused) {
            music.play().catch(() => {});
        }
    }

    function updateSoundButton(button) {
        const isMuted = !soundEnabled;
        button.textContent = isMuted ? '🔇' : '🔊';
        button.title = isMuted ? 'Turn sound on' : 'Turn sound off';
        button.setAttribute('aria-label', isMuted ? 'Turn sound on' : 'Turn sound off');
        button.setAttribute('aria-pressed', String(soundEnabled));
        button.style.opacity = isMuted ? '0.65' : '1';
    }

    const soundButton = document.createElement('button');
    soundButton.type = 'button';
    soundButton.id = 'soundToggle';
    soundButton.style.position = 'fixed';
    soundButton.style.top = '14px';
    soundButton.style.right = '14px';
    soundButton.style.zIndex = '1000';
    soundButton.style.width = '42px';
    soundButton.style.height = '42px';
    soundButton.style.minWidth = '0';
    soundButton.style.padding = '0';
    soundButton.style.border = '1px solid rgba(255,255,255,.24)';
    soundButton.style.background = 'rgba(7,24,34,.9)';
    soundButton.style.backdropFilter = 'blur(10px)';
    soundButton.style.fontSize = '1.15rem';
    soundButton.style.lineHeight = '1';
    soundButton.style.boxShadow = '0 8px 22px rgba(0,0,0,.28)';
    soundButton.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem(soundEnabledKey, String(soundEnabled));

        if (soundEnabled) {
            startMusic();
            playSound('button', 0.25);
        } else {
            music.pause();
        }

        updateSoundButton(soundButton);
    });
    updateSoundButton(soundButton);
    document.body.appendChild(soundButton);

    document.addEventListener('pointerdown', startMusic, { once: true });
    document.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            startMusic();
        }
    });

    document.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || button === soundButton || button.matches('.hand-card')) {
            return;
        }

        playSound(button.id === 'passButton' ? 'pass' : 'button', 0.28);
    });

    function observeGameState(state) {
        if (!state?.players) {
            return;
        }

        if (previousState) {
            const cardWasPlayed = state.players.some((player, index) =>
                player.count < (previousState.players[index]?.count ?? player.count)
            );
            const cardsWereDrawn = state.players.some((player, index) =>
                player.count > (previousState.players[index]?.count ?? player.count)
            );

            if (cardWasPlayed) {
                playSound('card', 0.5);
            } else if (cardsWereDrawn) {
                playSound('draw', 0.42);
            }

            if (state.currentColor && previousState.currentColor &&
                (previousState.currentCard === 'W' || previousState.currentCard === 'D4W') &&
                state.currentColor !== previousState.currentColor) {
                playSound('color', 0.48);
            }
        }

        previousState = {
            players: state.players.map(player => ({ count: player.count })),
            currentColor: state.currentColor,
            currentCard: state.currentCard
        };
    }

    if (!window.socket) {
        return;
    }

    window.socket.on('gameStarted', state => {
        previousState = {
            players: state.players.map(player => ({ count: player.count })),
            currentColor: state.lastPlayedCard?.slice(-1),
            currentCard: state.lastPlayedCard
        };
        startMusic();
        playSound('shuffle', 0.55);
        playSound('start', 0.36);
    });

    window.socket.on('game_state', observeGameState);
    window.socket.on('drawn_state', observeGameState);
    window.socket.on('uno_called', () => playSound('start', 0.42));
    window.socket.on('uno_penalty', () => playSound('draw', 0.48));
    window.socket.on('game_over', () => playSound('start', 0.62));
})();
