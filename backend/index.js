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

let arr = [];
let playingArray = [];

app.use(express.static('public'));

io.on("connection", (socket) => {
    console.log("Nowy użytkownik połączony", socket.id);

    socket.on("find", (e) => {
        console.log("Otrzymano żądanie znalezienia gracza: ", e);
        if (e.name != null) {
            arr.push(e.name);
            console.log("Aktualna lista graczy czekających: ", arr);
            if (arr.length >= 2) {
                let p1obj = {
                    p1name: arr[0],
                    p1value: "X",
                    p1move: ""
                };
                let p2obj = {
                    p2name: arr[1],
                    p2value: "O",
                    p2move: ""
                };

                let obj = {
                    p1: p1obj,
                    p2: p2obj,
                    sum: 1
                };

                playingArray.push(obj);
                console.log("Utworzono mecz: ", obj);

                arr.splice(0, 2); //delete two names

                io.emit("find", { allPlayersArray: playingArray });
                console.log("Emitowano aktualizację graczy: ", playingArray);
            }
        }
    });

    socket.on("playing", (e) => {
        console.log("Otrzymano ruch od gracza: ", e);
        let objToChange = playingArray.find(obj => (obj.p1.p1name === e.name) || (obj.p2.p2name === e.name));

        if (e.value == "X") {
            objToChange.p1.p1move = e.id;
        } else if (e.value == "O") {
            objToChange.p2.p2move = e.id;
        }
        objToChange.sum++;
        let currentPlayerTurn = objToChange.sum % 2 === 0 ? "O" : "X";
        console.log("Zaktualizowano stan gry: ", objToChange);

        io.emit("playing", { allPlayers: playingArray, currentPlayerTurn });
        console.log("Emitowano ruch do wszystkich graczy.");
    });

    socket.on("gameOver", (e) => {
        playingArray = playingArray.filter(obj => obj.p1.p1name !== e.name)
    })
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
