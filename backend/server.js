const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 3000;
const DISCONNECT_GRACE_MS = 30000;

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

let rooms = {};
let games = {};
let disconnectTimers = {};

function roomCodeGenerator() {
  let randomCode;
  while (!randomCode || randomCode in rooms) {
    randomCode = String(Math.floor(Math.random() * 100));
  }
  return randomCode;
}

function getRoomIDForClient(client) {
  return Array.from(client.rooms).find(room => room !== client.id);
}

function getSessionIdForClient(client) {
  return client.data?.sessionId || null;
}

function findRoomBySessionId(sessionId) {
  return (
    Object.keys(rooms).find(roomID =>
      rooms[roomID].players.some(player => player.sessionId === sessionId)
    ) || null
  );
}

function getRoomPlayer(roomID, sessionId) {
  return rooms[roomID]?.players.find(player => player.sessionId === sessionId) || null;
}

function getGamePlayer(roomID, sessionId) {
  return games[roomID]?.players.find(player => player.sessionId === sessionId) || null;
}

function getPlayerNames(roomID) {
  return (rooms[roomID]?.players || []).map(player => player.name);
}

function updateHostIfNeeded(roomID) {
  if (!rooms[roomID]) {
    return;
  }

  const currentHostStillExists = rooms[roomID].players.some(
    player => player.sessionId === rooms[roomID].hostSessionId
  );

  if (!currentHostStillExists) {
    rooms[roomID].hostSessionId = rooms[roomID].players[0]?.sessionId || null;
  }
}

function emitPlayerList(roomID) {
  if (!rooms[roomID]) {
    return;
  }

  io.to(roomID).emit('player_list_update', {
    players: getPlayerNames(roomID),
    roomCode: roomID,
    hostSessionId: rooms[roomID].hostSessionId
  });
}

function clearDisconnectTimer(sessionId) {
  if (!disconnectTimers[sessionId]) {
    return;
  }

  clearTimeout(disconnectTimers[sessionId]);
  delete disconnectTimers[sessionId];
}

function cleanupRoomState(roomID) {
  if (!rooms[roomID]) {
    delete games[roomID];
    return;
  }

  if (rooms[roomID].players.length === 0) {
    delete rooms[roomID];
    delete games[roomID];
  }
}

function removePlayerFromRoom(roomID, sessionId) {
  if (!rooms[roomID]) {
    return;
  }

  const playerIndex = rooms[roomID].players.findIndex(
    player => player.sessionId === sessionId
  );
  if (playerIndex === -1) {
    return;
  }

  clearDisconnectTimer(sessionId);
  rooms[roomID].players.splice(playerIndex, 1);
  updateHostIfNeeded(roomID);

  if (games[roomID]) {
    delete games[roomID];
    io.to(roomID).emit('redirect_to_index', {
      clearSession: false
    });
  }

  cleanupRoomState(roomID);
  emitPlayerList(roomID);
}

function scheduleDisconnectCleanup(sessionId) {
  const roomID = findRoomBySessionId(sessionId);
  if (!roomID) {
    return;
  }

  clearDisconnectTimer(sessionId);
  disconnectTimers[sessionId] = setTimeout(() => {
    delete disconnectTimers[sessionId];
    removePlayerFromRoom(roomID, sessionId);
  }, DISCONNECT_GRACE_MS);
}

function syncSocketToPlayer(roomID, sessionId, socketId) {
  const roomPlayer = getRoomPlayer(roomID, sessionId);
  if (roomPlayer) {
    roomPlayer.socketId = socketId;
    roomPlayer.connected = true;
  }

  const gamePlayer = getGamePlayer(roomID, sessionId);
  if (gamePlayer) {
    gamePlayer.socketId = socketId;
    gamePlayer.connected = true;
  }
}

function markPlayerDisconnected(sessionId, socketId) {
  const roomID = findRoomBySessionId(sessionId);
  if (!roomID) {
    return;
  }

  const roomPlayer = getRoomPlayer(roomID, sessionId);
  if (roomPlayer && roomPlayer.socketId === socketId) {
    roomPlayer.socketId = null;
    roomPlayer.connected = false;
  }

  const gamePlayer = getGamePlayer(roomID, sessionId);
  if (gamePlayer && gamePlayer.socketId === socketId) {
    gamePlayer.socketId = null;
    gamePlayer.connected = false;
  }

  scheduleDisconnectCleanup(sessionId);
}

function getNextPlayerIndex(game, steps = 1) {
  const totalPlayers = game.players.length;
  return (
    game.currentPlayerIndex +
    game.direction * steps +
    totalPlayers * steps
  ) % totalPlayers;
}

function cardMatchesColor(card, color) {
  if (!card || !color || card === 'W' || card === 'D4W') {
    return false;
  }

  return card.endsWith(color);
}

function buildDeck() {
  const deck = [];
  const colors = ['R', 'Y', 'G', 'B'];
  const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const actionCards = ['skip', '_', 'D2'];
  const wildCards = ['W', 'D4W'];

  colors.forEach(color => {
    numbers.forEach((number, index) => {
      deck.push(`${number}${color}`);
      if (index !== 0) {
        deck.push(`${number}${color}`);
      }
    });

    actionCards.forEach(action => {
      deck.push(`${action}${color}`);
      deck.push(`${action}${color}`);
    });
  });

  wildCards.forEach(wild => {
    for (let i = 0; i < 4; i++) {
      deck.push(wild);
    }
  });

  return deck;
}

function drawFromDeck(deck) {
  if (deck.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * deck.length);
  return deck.splice(randomIndex, 1)[0];
}

function distributeCards(deck, numPlayers) {
  const players = Array.from({ length: numPlayers }, () => []);

  for (let i = 0; i < numPlayers; i++) {
    for (let j = 0; j < 7; j++) {
      const card = drawFromDeck(deck);
      if (card) {
        players[i].push(card);
      }
    }
  }

  return players;
}

function drawInitialCard(game) {
  if (game.deck.length === 0) {
    return null;
  }

  let initialCard = drawFromDeck(game.deck);
  while (
    initialCard &&
    (initialCard.startsWith('_') ||
      initialCard.startsWith('D2') ||
      initialCard === 'D4W' ||
      initialCard === 'W' ||
      initialCard.startsWith('skip'))
  ) {
    game.deck.push(initialCard);
    initialCard = drawFromDeck(game.deck);
  }

  return initialCard;
}

function recycleDiscardIntoDeck(game) {
  if (game.deck.length > 0 || game.discardPile.length <= 1) {
    return;
  }

  const recyclableCards = game.discardPile.splice(0, game.discardPile.length - 1);
  game.deck.push(...recyclableCards);
}

function drawRandomCard(game) {
  recycleDiscardIntoDeck(game);
  return drawFromDeck(game.deck);
}

function drawCardsForPlayer(game, player, count) {
  for (let i = 0; i < count; i++) {
    const drawnCard = drawRandomCard(game);
    if (drawnCard) {
      player.cards.push(drawnCard);
    }
  }
}

function getUnoPendingPlayer(game) {
  if (!game?.unoPendingPlayerId) {
    return null;
  }

  return (
    game.players.find(player => player.sessionId === game.unoPendingPlayerId) || null
  );
}

function markUnoPending(game, player) {
  if (player.cards.length !== 1) {
    game.unoPendingPlayerId = null;
    game.unoDeclaredPlayerId = null;
    return;
  }

  if (game.unoDeclaredPlayerId === player.sessionId) {
    game.unoPendingPlayerId = null;
    game.unoDeclaredPlayerId = null;
    return;
  }

  game.unoPendingPlayerId = player.sessionId;
}

function clearUnoPending(game, sessionId = null) {
  if (!game) {
    return;
  }

  if (!sessionId || game.unoPendingPlayerId === sessionId) {
    game.unoPendingPlayerId = null;
  }

  if (!sessionId || game.unoDeclaredPlayerId === sessionId) {
    game.unoDeclaredPlayerId = null;
  }
}

function clearUnoWindowAfterAction(game, actingPlayerId) {
  if (!game?.unoPendingPlayerId) {
    if (game?.unoDeclaredPlayerId && game.unoDeclaredPlayerId !== actingPlayerId) {
      game.unoDeclaredPlayerId = null;
    }
    return;
  }

  if (game.unoPendingPlayerId !== actingPlayerId) {
    game.unoPendingPlayerId = null;
    game.unoDeclaredPlayerId = null;
  }
}

function validityAndType(card, game) {
  const currentCardColor = card[card.length - 1];
  const lastCardColor = game.currentColor;

  if (card === 'W') return { valid: true, type: 'colorChange' };
  if (card === 'D4W') return { valid: true, type: 'wild' };

  if (card.startsWith('skip')) {
    const valid = game.currentCard.startsWith('skip') || currentCardColor === lastCardColor;
    return { valid, type: valid ? 'skip' : 'none' };
  }

  if (card.startsWith('_')) {
    const valid = game.currentCard.startsWith('_') || currentCardColor === lastCardColor;
    return { valid, type: valid ? 'reverse' : 'none' };
  }

  if (card.startsWith('D2')) {
    const valid = game.currentCard.startsWith('D2') || currentCardColor === lastCardColor;
    return { valid, type: valid ? 'drawTwo' : 'none' };
  }

  if (card[0] === game.currentCard[0] || currentCardColor === lastCardColor) {
    return { valid: true, type: 'numberCard' };
  }

  return { valid: false, type: 'none' };
}

function buildGamePayload(roomID, game, player, index) {
  const unoPendingPlayer = getUnoPendingPlayer(game);

  return {
    roomCode: roomID,
    yourCards: player.cards,
    players: game.players.map(currentPlayer => ({
      name: currentPlayer.name,
      count: currentPlayer.cards.length
    })),
    yourIndex: index,
    currentCard: game.currentCard,
    currentColor: game.currentColor,
    currentTurn: game.currentPlayerIndex,
    suitch: game.suitch,
    canCallUno:
      game.unoPendingPlayerId === player.sessionId ||
      (game.players[game.currentPlayerIndex]?.sessionId === player.sessionId &&
        player.cards.length === 2 &&
        game.unoDeclaredPlayerId !== player.sessionId),
    canCatchUno: !!unoPendingPlayer && unoPendingPlayer.sessionId !== player.sessionId,
    unoPendingPlayerName: unoPendingPlayer ? unoPendingPlayer.name : null
  };
}

function emitPendingPrompts(roomID) {
  const game = games[roomID];
  if (!game) {
    return;
  }

  if (game.pendingColorChoice) {
    const pendingPlayer = getGamePlayer(roomID, game.pendingColorChoice.playerSessionId);
    if (pendingPlayer?.socketId) {
      io.to(pendingPlayer.socketId).emit('chooseColor');
    }
  }

  if (game.pendingDrawFour) {
    const challenger = getGamePlayer(roomID, game.pendingDrawFour.challengerSessionId);
    if (challenger?.socketId) {
      io.to(challenger.socketId).emit('draw_four_pending', {
        offenderName: game.pendingDrawFour.offenderName
      });
    }
  }
}

function sendGameState(roomID) {
  const game = games[roomID];
  if (!game) {
    return;
  }

  game.players.forEach((player, index) => {
    if (!player.socketId) {
      return;
    }

    io.to(player.socketId).emit('game_state', buildGamePayload(roomID, game, player, index));
  });

  emitPendingPrompts(roomID);
}

function sendDrawnState(roomID, socketId) {
  const game = games[roomID];
  if (!game) {
    return;
  }

  game.players.forEach((player, index) => {
    if (!player.socketId) {
      return;
    }

    const eventName = player.socketId === socketId ? 'drawn_state' : 'game_state';
    io.to(player.socketId).emit(eventName, buildGamePayload(roomID, game, player, index));
  });

  emitPendingPrompts(roomID);
}

function sendResumeState(roomID, sessionId) {
  const game = games[roomID];
  if (!game) {
    return;
  }

  if (
    !game.pendingColorChoice &&
    game.players[game.currentPlayerIndex]?.sessionId === sessionId &&
    !game.suitch
  ) {
    const reconnectingPlayer = getGamePlayer(roomID, sessionId);
    if (reconnectingPlayer?.socketId) {
      sendDrawnState(roomID, reconnectingPlayer.socketId);
      return;
    }
  }

  sendGameState(roomID);
}

function handleWin(roomID, player) {
  if (player.cards.length !== 0) {
    return false;
  }

  io.to(roomID).emit('game_over', {
    winner: player.name
  });
  delete games[roomID];
  return true;
}

function finalizeTurnAfterPendingDrawFour(roomID) {
  const game = games[roomID];
  if (!game || !game.pendingDrawFour) {
    return;
  }

  const { offenderSessionId, offenderWentOut } = game.pendingDrawFour;
  game.pendingDrawFour = null;

  if (offenderWentOut) {
    const offender = game.players.find(
      player => player.sessionId === offenderSessionId
    );
    if (offender) {
      handleWin(roomID, offender);
      return;
    }
  }

  sendGameState(roomID);
}

io.on('connection', client => {
  client.emit('connected', { data: 'New Player Connected' });

  client.on('createRoom', data => {
    if (!data?.host || !data?.sessionId) {
      client.emit('room_error', {
        message: 'A player name is required to create a room.'
      });
      return;
    }

    const roomCode = roomCodeGenerator();
    client.join(roomCode);
    client.data.sessionId = data.sessionId;

    rooms[roomCode] = {
      hostSessionId: data.sessionId,
      players: [
        {
          name: data.host,
          sessionId: data.sessionId,
          socketId: client.id,
          connected: true
        }
      ]
    };

    client.emit('createRoom', {
      roomPlayers: getPlayerNames(roomCode),
      roomCode,
      hostSessionId: rooms[roomCode].hostSessionId
    });
  });

  client.on('joinRoom', data => {
    if (!data?.player || !data?.code || !data?.sessionId) {
      client.emit('room_error', {
        message: 'Room code and player name are required.'
      });
      return;
    }

    if (!rooms[data.code]) {
      client.emit('room_error', {
        message: 'That room was not found.'
      });
      return;
    }

    if (games[data.code]) {
      client.emit('room_error', {
        message: 'That room is already in a live match.'
      });
      return;
    }

    client.join(data.code);
    client.data.sessionId = data.sessionId;
    rooms[data.code].players.push({
      name: data.player,
      sessionId: data.sessionId,
      socketId: client.id,
      connected: true
    });

    emitPlayerList(data.code);
  });

  client.on('resumeSession', data => {
    if (!data?.roomCode || !data?.sessionId) {
      client.emit('session_expired');
      return;
    }

    const room = rooms[data.roomCode];
    const roomPlayer = getRoomPlayer(data.roomCode, data.sessionId);

    if (!room || !roomPlayer) {
      client.emit('session_expired');
      return;
    }

    clearDisconnectTimer(data.sessionId);
    client.join(data.roomCode);
    client.data.sessionId = data.sessionId;
    syncSocketToPlayer(data.roomCode, data.sessionId, client.id);
    emitPlayerList(data.roomCode);

    if (games[data.roomCode]) {
      sendResumeState(data.roomCode, data.sessionId);
    }
  });

  client.on('leaveRoom', () => {
    const sessionId = getSessionIdForClient(client);
    const roomID = getRoomIDForClient(client) || findRoomBySessionId(sessionId);
    if (!roomID || !sessionId) {
      return;
    }

    client.emit('redirect_to_index', {
      clearSession: true
    });
    client.leave(roomID);
    removePlayerFromRoom(roomID, sessionId);
  });

  client.on('disconnect', () => {
    const sessionId = getSessionIdForClient(client);
    if (!sessionId) {
      return;
    }

    console.log('User disconnected:', client.id);
    markPlayerDisconnected(sessionId, client.id);
  });

  client.on('startGame', () => {
    const roomID = getRoomIDForClient(client);
    const sessionId = getSessionIdForClient(client);

    if (!roomID || !rooms[roomID] || rooms[roomID].hostSessionId !== sessionId) {
      return;
    }

    const roomPlayers = rooms[roomID].players;
    if (roomPlayers.length < 2) {
      return;
    }

    const deck = buildDeck();
    const distributed = distributeCards(deck, roomPlayers.length);
    const players = roomPlayers.map((player, index) => ({
      sessionId: player.sessionId,
      socketId: player.socketId,
      connected: player.connected,
      name: player.name,
      cards: distributed[index]
    }));

    games[roomID] = {
      players,
      deck,
      discardPile: [],
      currentPlayerIndex: 0,
      direction: 1,
      currentColor: null,
      currentCard: null,
      suitch: true,
      pendingColorChoice: null,
      pendingDrawFour: null,
      unoPendingPlayerId: null,
      unoDeclaredPlayerId: null
    };

    const lastPlayedCard = drawInitialCard(games[roomID]);
    if (!lastPlayedCard) {
      delete games[roomID];
      return;
    }

    games[roomID].currentCard = lastPlayedCard;
    games[roomID].currentColor = lastPlayedCard[lastPlayedCard.length - 1];
    games[roomID].discardPile.push(lastPlayedCard);

    players.forEach((player, index) => {
      if (!player.socketId) {
        return;
      }

      io.to(player.socketId).emit('gameStarted', {
        roomCode: roomID,
        yourCards: distributed[index],
        players: players.map(currentPlayer => ({
          name: currentPlayer.name,
          count: currentPlayer.cards.length
        })),
        yourIndex: index,
        lastPlayedCard,
        turn: 0,
        suitch: games[roomID].suitch
      });
    });
  });

  client.on('playedCard', data => {
    const roomID = getRoomIDForClient(client);
    const game = games[roomID];
    if (!game || !data?.card) {
      return;
    }
    if (game.pendingDrawFour || game.pendingColorChoice) {
      return;
    }

    const player = game.players[game.currentPlayerIndex];
    const card = data.card;
    const sessionId = getSessionIdForClient(client);

    if (!player || player.sessionId !== sessionId) return;
    if (!player.cards.includes(card)) return;

    const { valid, type } = validityAndType(card, game);
    if (!valid) return;

    game.suitch = true;

    const finishPlay = nextPlayerSteps => {
      game.discardPile.push(card);
      player.cards.splice(player.cards.indexOf(card), 1);
      markUnoPending(game, player);

      if (handleWin(roomID, player)) {
        return;
      }

      game.currentPlayerIndex = getNextPlayerIndex(game, nextPlayerSteps);
      sendGameState(roomID);
    };

    if (type === 'colorChange' || type === 'wild') {
      const previousColor = game.currentColor;

      game.currentCard = card;
      game.discardPile.push(card);
      player.cards.splice(player.cards.indexOf(card), 1);
      markUnoPending(game, player);
      game.pendingColorChoice = {
        playerSessionId: player.sessionId,
        type,
        previousColor,
        offenderWentOut: player.cards.length === 0
      };
      game.suitch = false;
      sendGameState(roomID);
      return;
    }

    game.currentCard = card;
    game.currentColor = card[card.length - 1];

    if (type === 'skip') {
      finishPlay(2);
      return;
    }

    if (type === 'reverse') {
      game.direction *= -1;
      finishPlay(game.players.length === 2 ? 2 : 1);
      return;
    }

    if (type === 'drawTwo') {
      const nextPlayer = game.players[getNextPlayerIndex(game)];
      drawCardsForPlayer(game, nextPlayer, 2);
      finishPlay(2);
      return;
    }

    finishPlay(1);
  });

  client.on('colorChosen', color => {
    const roomID = getRoomIDForClient(client);
    const game = games[roomID];
    const sessionId = getSessionIdForClient(client);

    if (!game || !game.pendingColorChoice || !color) {
      return;
    }

    const pendingChoice = game.pendingColorChoice;
    const player = game.players[game.currentPlayerIndex];

    if (!player || pendingChoice.playerSessionId !== sessionId || player.sessionId !== sessionId) {
      return;
    }

    game.currentColor = color;
    game.pendingColorChoice = null;
    game.suitch = true;

    if (pendingChoice.type === 'wild') {
      const nextPlayerIndex = getNextPlayerIndex(game);
      const nextPlayer = game.players[nextPlayerIndex];

      game.pendingDrawFour = {
        challengerSessionId: nextPlayer.sessionId,
        challengerName: nextPlayer.name,
        offenderSessionId: player.sessionId,
        offenderName: player.name,
        offenderWentOut: pendingChoice.offenderWentOut,
        legal: !player.cards.some(currentCard =>
          cardMatchesColor(currentCard, pendingChoice.previousColor)
        )
      };
      game.currentPlayerIndex = nextPlayerIndex;
      sendGameState(roomID);
      return;
    }

    if (pendingChoice.offenderWentOut) {
      handleWin(roomID, player);
      return;
    }

    game.currentPlayerIndex = getNextPlayerIndex(game);
    sendGameState(roomID);
  });

  client.on('drawCard', () => {
    const roomID = getRoomIDForClient(client);
    const game = games[roomID];
    if (!game) {
      return;
    }
    if (game.pendingDrawFour || game.pendingColorChoice) {
      return;
    }

    const player = game.players[game.currentPlayerIndex];
    const sessionId = getSessionIdForClient(client);

    if (!player || player.sessionId !== sessionId) return;
    if (!game.suitch) return;

    const drawnCard = drawRandomCard(game);
    if (!drawnCard) {
      return;
    }

    player.cards.push(drawnCard);
    game.suitch = false;
    clearUnoWindowAfterAction(game, sessionId);
    sendDrawnState(roomID, client.id);
  });

  client.on('passTurn', () => {
    const roomID = getRoomIDForClient(client);
    const game = games[roomID];
    if (!game) {
      return;
    }
    if (game.pendingDrawFour || game.pendingColorChoice) {
      return;
    }

    const player = game.players[game.currentPlayerIndex];
    const sessionId = getSessionIdForClient(client);

    if (!player || player.sessionId !== sessionId) return;
    if (game.suitch) return;

    game.currentPlayerIndex = getNextPlayerIndex(game);
    game.suitch = true;
    clearUnoWindowAfterAction(game, sessionId);
    sendGameState(roomID);
  });

  client.on('drawFourDecision', data => {
    const roomID = getRoomIDForClient(client);
    const game = games[roomID];
    const sessionId = getSessionIdForClient(client);
    if (!game || !game.pendingDrawFour) {
      return;
    }

    const pending = game.pendingDrawFour;
    if (pending.challengerSessionId !== sessionId) {
      return;
    }

    const challenger = game.players.find(
      player => player.sessionId === pending.challengerSessionId
    );
    const offender = game.players.find(
      player => player.sessionId === pending.offenderSessionId
    );
    if (!challenger || !offender) {
      game.pendingDrawFour = null;
      sendGameState(roomID);
      return;
    }

    if (data.challenge) {
      if (pending.legal) {
        drawCardsForPlayer(game, challenger, 6);
        game.currentPlayerIndex = getNextPlayerIndex(game);
        io.to(roomID).emit('draw_four_result', {
          message: `${challenger.name} challenged ${offender.name}. Challenge failed, so ${challenger.name} draws 6 cards.`
        });
      } else {
        drawCardsForPlayer(game, offender, 4);
        game.currentPlayerIndex = game.players.findIndex(
          player => player.sessionId === challenger.sessionId
        );
        io.to(roomID).emit('draw_four_result', {
          message: `${challenger.name} challenged ${offender.name}. Challenge succeeded, so ${offender.name} draws 4 cards.`
        });
      }
    } else {
      drawCardsForPlayer(game, challenger, 4);
      game.currentPlayerIndex = getNextPlayerIndex(game);
      io.to(roomID).emit('draw_four_result', {
        message: `${challenger.name} accepted the Wild Draw Four and drew 4 cards.`
      });
    }

    game.suitch = true;
    clearUnoWindowAfterAction(game, sessionId);
    finalizeTurnAfterPendingDrawFour(roomID);
  });

  client.on('callUno', () => {
    const roomID = getRoomIDForClient(client);
    const game = games[roomID];
    const sessionId = getSessionIdForClient(client);
    if (!game || !sessionId) {
      return;
    }

    const player = game.players.find(
      currentPlayer => currentPlayer.sessionId === sessionId
    );
    if (!player) {
      return;
    }

    const isPendingUnoCall = game.unoPendingPlayerId === sessionId;
    const canPredeclareUno =
      game.players[game.currentPlayerIndex]?.sessionId === sessionId &&
      player.cards.length === 2;

    if (!isPendingUnoCall && !canPredeclareUno) {
      return;
    }

    if (canPredeclareUno) {
      game.unoDeclaredPlayerId = sessionId;
    } else {
      clearUnoPending(game, sessionId);
    }

    io.to(roomID).emit('uno_called', {
      playerName: player.name
    });
    sendGameState(roomID);
  });

  client.on('catchUno', () => {
    const roomID = getRoomIDForClient(client);
    const game = games[roomID];
    const pendingPlayer = getUnoPendingPlayer(game);
    const sessionId = getSessionIdForClient(client);

    if (!game || !pendingPlayer || pendingPlayer.sessionId === sessionId) {
      return;
    }

    drawCardsForPlayer(game, pendingPlayer, 2);
    clearUnoPending(game, pendingPlayer.sessionId);
    io.to(roomID).emit('uno_penalty', {
      callerName: pendingPlayer.name
    });
    sendGameState(roomID);
  });
});
