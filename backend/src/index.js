const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const { signUp, signIn, confirmSignUp } = require('./authService');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
let groups = 1;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        await signUp(email, password);
        res.status(200).send('Registration successful! Please confirm your email.');
    } catch (err) {
        res.status(400).send(err.message);
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const authResult = await signIn(email, password);
        res.status(200).json(authResult);
    } catch (err) {
        res.status(400).send(err.message);
    }
});

app.post('/verify', async (req, res) => {
    const { email, code } = req.body;
    try {
        await confirmSignUp(email, code);
        res.status(200).send('Verification successful! You can now log in.');
    } catch (err) {
        res.status(400).send(err.message);
    }
});

io.on('connection', function (socket) {
    socket.on('startGame', function (data) {
        socket.join(groups);
        socket.emit('new', { name: data.name, group: groups });
        groups++;
    });

    socket.on('joinGame', function (data) {
        const room = io.sockets.adapter.rooms[data.group];
        const numClients = room ? room.length : 0;

        if (numClients == 1) {
            socket.join(data.group);
            socket.broadcast.to(data.group).emit('player1', {});
            socket.emit('player2', { name: data.name, group: data.group });
        } else if (numClients > 1) {
            socket.emit('err', { message: 'Room is full, please start a new game' });
        } else {
            socket.emit('err', { message: 'Invalid ID!' });
        }
    });

    socket.on('nextTurn', function (data) {
        socket.broadcast.to(data.group).emit('toNext', {
            box: data.box,
            group: data.group,
        });
    });

    socket.on('gameOver', function (data) {
        if (data.winner) {
            socket.emit('endGame', { winner: data.winner, message: 'You win!' });
            socket.to(data.group).emit('endGame', { winner: data.winner, message: 'You lose!' });
        } else {
            io.in(data.group).emit('endGame', { message: data.message });
        }
    });

    socket.on('reset', function (data) {
        io.in(data.group).emit('resetGame');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`listening on ${PORT}`);
});