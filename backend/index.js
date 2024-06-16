const express = require("express");
const app = express();

const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['polling', 'websocket']
});

let waitingPlayers = [];
let playingGames = [];

app.use(express.static('public'));

io.on("connection", (socket) => {
    console.log("Nowy użytkownik połączony", socket.id);

    socket.on("find", (e) => {
        console.log("Otrzymano żądanie znalezienia gracza: ", e);
        if (e.name != null) {
            waitingPlayers.push({ name: e.name, id: socket.id });
            console.log("Aktualna lista graczy czekających: ", waitingPlayers);
            if (waitingPlayers.length >= 2) {
                let p1 = waitingPlayers.shift();
                let p2 = waitingPlayers.shift();

                let game = {
                    players: [
                        { name: p1.name, id: p1.id, symbol: "X", move: "" },
                        { name: p2.name, id: p2.id, symbol: "O", move: "" }
                    ],
                    sum: 1
                };

                playingGames.push(game);
                console.log("Utworzono mecz: ", game);

                io.to(p1.id).emit("gameFound", { opponent: p2.name, symbol: "X" });
                io.to(p2.id).emit("gameFound", { opponent: p1.name, symbol: "O" });
            }
        }
    });

    socket.on("playing", (e) => {
        console.log("Otrzymano ruch od gracza: ", e);
        let game = playingGames.find(g => g.players.some(p => p.name === e.name));

        if (!game) return;

        let player = game.players.find(p => p.name === e.name);
        let opponent = game.players.find(p => p.name !== e.name);

        if (player.symbol === e.value) {
            player.move = e.id;
            game.sum++;
            let currentPlayerTurn = game.sum % 2 === 0 ? "O" : "X";
            console.log("Zaktualizowano stan gry: ", game);

            io.to(player.id).emit("playing", { allPlayers: game.players, currentPlayerTurn });
            io.to(opponent.id).emit("playing", { allPlayers: game.players, currentPlayerTurn });
            console.log("Emitowano ruch do wszystkich graczy.");
        }
    });

    socket.on("gameOver", (e) => {
        playingGames = playingGames.filter(game => !game.players.some(p => p.name === e.name));
    });

    socket.on("disconnect", () => {
        console.log("Użytkownik rozłączony", socket.id);
        waitingPlayers = waitingPlayers.filter(p => p.id !== socket.id);
        let game = playingGames.find(game => game.players.some(p => p.id === socket.id));
        if (game) {
            let opponent = game.players.find(p => p.id !== socket.id);
            io.to(opponent.id).emit("gameOver", { message: "Your opponent has disconnected." });
            playingGames = playingGames.filter(g => g !== game);
        }
    });
});

// Proxy endpoint to frontend server
app.use('/frontend', createProxyMiddleware({
    target: 'http://localhost:8080', // zmień na URL twojego serwera frontendowego
    changeOrigin: true,
    pathRewrite: {
        '^/frontend': '/', // może być potrzebne, aby znormalizować ścieżkę
    },
}));

app.get("/", (req, res) => {
    console.log("Ktoś zażądał strony głównej.");
    res.redirect('/frontend'); // Redirect to frontend server
});

server.listen(3000, () => {
    console.log("Serwer uruchomiony na porcie 3000");
});
