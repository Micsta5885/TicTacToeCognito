const express = require("express");
const AWS = require('aws-sdk');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
const bodyParser = require('body-parser');
const app = express();
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

app.use(cors());
app.use(bodyParser.json());
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

function checkGameOver(game) {
    const p1 = game.p1;
    const p2 = game.p2;

    const board = Array(9).fill(null);
    if (p1.p1move) {
        board[parseInt(p1.p1move.replace('btn', '')) - 1] = 'X';
    }
    if (p2.p2move) {
        board[parseInt(p2.p2move.replace('btn', '')) - 1] = 'O';
    }

    const winningCombinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    for (let combination of winningCombinations) {
        const [a, b, c] = combination;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a] };
        }
    }

    if (board.every(cell => cell)) {
        return { winner: 'Draw' };
    }

    return null;
}

io.on("connection", (socket) => {
    console.log("Nowy użytkownik połączony", socket.id);

    socket.on("find", (e) => {
        console.log("Otrzymano żądanie znalezienia gracza: ", e);
        if (e.name != null) {
            arr.push({ name: e.name, id: socket.id });
            console.log("Aktualna lista graczy czekających: ", arr.map(player => player.name));
            if (arr.length >= 2) {
                let p1 = arr.shift();
                let p2 = arr.shift();

                let game = {
                    p1: { p1name: p1.name, p1id: p1.id, p1value: "X", p1move: "" },
                    p2: { p2name: p2.name, p2id: p2.id, p2value: "O", p2move: "" },
                    sum: 1
                };

                playingArray.push(game);
                console.log("Utworzono mecz: ", game);

                io.to(p1.id).emit("gameFound", { opponent: p2.name, symbol: "X" });
                io.to(p2.id).emit("gameFound", { opponent: p1.name, symbol: "O" });
            }
        }
    });

    socket.on("playing", (e) => {
        console.log("Otrzymano ruch od gracza: ", e);
        let game = playingArray.find(g => g.p1.p1name === e.name || g.p2.p2name === e.name);

        if (!game) return;

        if (game.p1.p1name === e.name && game.p1.p1value === e.value) {
            game.p1.p1move = e.id;
        } else if (game.p2.p2name === e.name && game.p2.p2value === e.value) {
            game.p2.p2move = e.id;
        } else {
            console.error("Invalid move");
            return;
        }

        game.sum++;
        let currentPlayerTurn = game.sum % 2 === 0 ? "O" : "X";
        console.log("Zaktualizowano stan gry: ", game);

        io.to(game.p1.p1id).emit("playing", { allPlayers: [game.p1, game.p2], currentPlayerTurn });
        io.to(game.p2.p2id).emit("playing", { allPlayers: [game.p1, game.p2], currentPlayerTurn });
        console.log("Emitowano ruch do wszystkich graczy.");

        let result = checkGameOver(game);
        console.log("Wynik sprawdzania końca gry:", result);
        if (result) {
            if (result.winner === 'Draw') {
                io.to(game.p1.p1id).emit("gameOver", { message: "Draw!" });
                io.to(game.p2.p2id).emit("gameOver", { message: "Draw!" });
            } else {
                io.to(game.p1.p1id).emit("gameOver", { message: `${result.winner} WON !!` });
                io.to(game.p2.p2id).emit("gameOver", { message: `${result.winner} WON !!` });
            }
            playingArray = playingArray.filter(g => g !== game);
        }
    });

    socket.on("gameOver", (e) => {
        playingArray = playingArray.filter(game => game.p1.p1name !== e.name && game.p2.p2name !== e.name);
    });

    socket.on("disconnect", () => {
        console.log("Użytkownik rozłączony", socket.id);
        arr = arr.filter(p => p.id !== socket.id);
        let game = playingArray.find(game => game.p1.p1id === socket.id || game.p2.p2id === socket.id);
        if (game) {
            let opponent = game.p1.p1id === socket.id ? game.p2 : game.p1;
            if (opponent) {
                io.to(opponent.p2id || opponent.p1id).emit("gameOver", { message: "Your opponent has disconnected." });
            }
            playingArray = playingArray.filter(g => g !== game);
        }
    });
});

// Auth routes
app.post('/register', (req, res) => {
    const { email, password } = req.body;

    const poolData = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        ClientId: process.env.COGNITO_CLIENT_ID
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    const attributeList = [];
    attributeList.push(new AmazonCognitoIdentity.CognitoUserAttribute({ Name: "email", Value: email }));

    userPool.signUp(email, password, attributeList, null, (err, result) => {
        if (err) {
            res.status(400).send(err.message);
        } else {
            res.send('Registration successful! Please check your email for verification code.');
        }
    });
});

app.post('/confirm', (req, res) => {
    const { email, code } = req.body;

    const poolData = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        ClientId: process.env.COGNITO_CLIENT_ID
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    const userData = {
        Username: email,
        Pool: userPool
    };

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
            res.status(400).send(err.message);
        } else {
            res.send('Verification successful! You can now log in.');
        }
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const poolData = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        ClientId: process.env.COGNITO_CLIENT_ID
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: email,
        Password: password
    });

    const userData = {
        Username: email,
        Pool: userPool
    };

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
            const accessToken = result.getAccessToken().getJwtToken();
            res.json({ accessToken });
        },
        onFailure: (err) => {
            res.status(400).send(err.message);
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
