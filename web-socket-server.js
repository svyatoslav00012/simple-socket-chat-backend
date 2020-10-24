const WebSocketServer = require('websocket').server;
const http = require('http');
const PORT = 5000

//CONSTANTS
const ServerSocketMessageTypes = {
    AUTH_RESPONSE: 'AUTH_RESPONSE',
    LEAVE_RESPONSE: 'LEAVE_RESPONSE',
    MEMBERS: 'MEMBERS',
    MESSAGE: 'MESSAGE'
}

const ClientSocketMessageTypes = {
    JOIN: 'JOIN',
    MESSAGE: 'MESSAGE',
    LEAVE: 'LEAVE'
}

//SETUP HTTP SERVER
const server = http.createServer(function (request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(PORT, function () {
    console.log((new Date()) + ' Server is listening on port 8080');
});

wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

//CONNECTIONS LOGIC
const connections = []

const getByConnection = c => connections.find(cn => cn.connection === c)

const getByAuthor = author => connections.find(c => c.author === author)

const removeAndClose = c => {
    const ind = connections.findIndex(cn => cn === c)
    if(ind >= 0)
        connections.splice(ind, 1)
    c.connection.close()
}

const getMembers = () => connections.map(_ => _.author)

//HANDLING NEW CONNECTIONS
wsServer.on('request', function (request) {
    const connection = setupConnection(request)
    connections.push({connection, author: ''})
});



const setupConnection = request => {
    const connection = request.accept('echo-protocol', request.origin);
    console.log((new Date()) + ' Connection accepted.');
    connection.on('message', handleMessage(connection));
    connection.on('close', (reas, descr) => {
        const c = getByConnection(connection)
        if(c)
            removeAndClose(c)
        sendMembers()
        console.log(`${new Date()} Peer ${connection.remoteAddress} disconnected.`)
    });
    return connection
}

//HANDLING MESSAGES
const handleMessage = connection => msg => {
    const message = msg.utf8Data
    const msgParsed = JSON.parse(message)

    let cur = null
    switch (msgParsed.type){
        case ClientSocketMessageTypes.JOIN:
            let byAuthor = getByAuthor(msgParsed.author)
            if(byAuthor)
                removeAndClose(byAuthor)
            cur = getByConnection(connection)
            cur.author = msgParsed.author
            connection.sendUTF(JSON.stringify({
                type: ServerSocketMessageTypes.AUTH_RESPONSE,
                authorized: true
            }));
            console.log('new member ' + msgParsed.author)
            console.log('Members: ' + getMembers().join(', '))
            sendMembers()
            break;

        case ClientSocketMessageTypes.LEAVE:
            cur = getByConnection(connection)
            if(cur)
                removeAndClose(cur)
            connection.sendUTF(JSON.stringify({
                type: ServerSocketMessageTypes.LEAVE_RESPONSE,
                left: !!cur
            }))
            console.log('member exited ' + cur.author)
            console.log('Members: ' + getMembers().join(', '))
            sendMembers()
            break;

        case ClientSocketMessageTypes.MESSAGE:
            sendMessage(msgParsed.msgObj, connection)
            break;
    }
}


//HELPER FUNCTIONS
const sendMembers = () => sendJsonToAll({
    type: ServerSocketMessageTypes.MEMBERS,
    members: getMembers()
})

const sendMessage = (msgObj, connFrom) => sendJsonToAll({
    type: ServerSocketMessageTypes.MESSAGE,
    message: msgObj
}, connFrom)

const sendJsonToAll = (json, from) => sendToAll(JSON.stringify(json), from)

const sendToAll = (message, from) => {
    connections.forEach(c => {
        if (c.connection !== from)
            c.connection.sendUTF(message)
    })
}