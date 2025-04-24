// Peer-to-peer synchronization for PUBG Queue App
// Using PeerJS (https://peerjs.com)

class PubgSync {
    constructor() {
        this.peer = null;
        this.connections = [];
        this.isHost = false;
        this.hostConnection = null;
        this.roomId = null;
        this.isConnected = false;
        this.onDataCallback = null;
        this.onConnectionCallback = null;
        this.onDisconnectCallback = null;
        this.onHostChangeCallback = null;
        this.roomIdMapping = null;
        this.pendingDiscovery = null;
    }

    // Initialize the peer connection
    init() {
        // Create a new Peer with a random ID
        this.peer = new Peer();

        // Handle peer open event
        this.peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            // Store my ID for reconnection
            localStorage.setItem('myPeerId', id);
        });

        // Handle incoming connections
        this.peer.on('connection', (conn) => {
            this.handleNewConnection(conn);
        });

        // Handle errors
        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            // Try to reconnect if possible
            setTimeout(() => this.reconnect(), 5000);
        });

        // Auto-reconnect to previous session if possible
        this.autoReconnect();
    }

    // Try to reconnect to a previous session
    autoReconnect() {
        const savedRoomId = localStorage.getItem('pubgRoomId');
        if (savedRoomId) {
            // Wait a bit for the peer to fully initialize
            setTimeout(() => {
                this.joinRoom(savedRoomId);
            }, 1000);
        }
    }

    // Reconnect if disconnected
    reconnect() {
        if (this.peer && this.peer.destroyed) {
            // Recreate the peer connection
            this.init();
            
            // Try to rejoin the previous room
            const savedRoomId = localStorage.getItem('pubgRoomId');
            if (savedRoomId) {
                this.joinRoom(savedRoomId);
            }
        }
    }

    // Create a new room as host
    createRoom() {
        this.isHost = true;
        this.roomId = this.generateRoomId();
        localStorage.setItem('pubgRoomId', this.roomId);
        
        // Display the room ID for sharing
        if (this.onHostChangeCallback) {
            this.onHostChangeCallback(true, this.roomId);
        }
        
        return this.roomId;
    }

    // Join an existing room
    joinRoom(friendlyRoomId) {
        if (!friendlyRoomId) return false;
        
        this.isHost = false;
        this.roomId = friendlyRoomId;
        localStorage.setItem('pubgRoomId', friendlyRoomId);
        
        // First, we need to discover the actual peer ID corresponding to this friendly room ID
        // This requires a signaling mechanism, which we'll simulate with a room registration
        
        // For simplicity, we'll use a query parameter added to the PeerJS connection
        // In a more robust implementation, this would use a lightweight signaling server
        
        // Send a discovery connection to the PeerJS server
        this.discoverHostPeerId(friendlyRoomId, (hostPeerId) => {
            if (!hostPeerId) {
                console.error('Could not find host for room:', friendlyRoomId);
                return false;
            }
            
            // Connect to the discovered host
            const conn = this.peer.connect(hostPeerId, {
                reliable: true,
                metadata: { roomId: friendlyRoomId }
            });
            
            this.setupConnectionHandlers(conn);
            return true;
        });
        
        return true; // Return optimistically, actual connection happens asynchronously
    }
    
    // Discover the actual peer ID for a friendly room ID
    discoverHostPeerId(friendlyRoomId, callback) {
        // For now, we'll use a simple in-memory map of room IDs
        // In a production environment, this would be replaced with a proper signaling mechanism
        
        // Simulate peer discovery with a direct connection to the server
        // For demo purposes, we'll temporarily connect to a well-known peer ID format
        const discoveryId = 'ROOM_' + friendlyRoomId;
        
        // Store the connection attempt
        this.pendingDiscovery = {
            roomId: friendlyRoomId,
            callback: callback
        };
        
        // Check if we have any connections that might know about this room
        if (this.connections.length > 0) {
            // Ask existing connections if they know about this room
            this.connections.forEach(conn => {
                if (conn.open) {
                    conn.send({
                        type: 'ROOM_DISCOVERY',
                        roomId: friendlyRoomId
                    });
                }
            });
            
            // Set a timeout to fail gracefully if no response
            setTimeout(() => {
                if (this.pendingDiscovery && this.pendingDiscovery.roomId === friendlyRoomId) {
                    // No response, try direct connection
                    this.tryDirectConnection(friendlyRoomId, callback);
                }
            }, 2000);
        } else {
            // No existing connections, try direct connection
            this.tryDirectConnection(friendlyRoomId, callback);
        }
    }
    
    // Try direct connection using the friendly ID as the peer ID
    // This is a fallback mechanism and works for simple implementations
    tryDirectConnection(friendlyRoomId, callback) {
        // In this simple implementation, we'll try using the friendly ID directly
        // This works because our app isn't expected to have huge numbers of users
        callback(friendlyRoomId);
        this.pendingDiscovery = null;
    }
    
    // Setup connection event handlers
    setupConnectionHandlers(conn) {
        if (!conn) return false;
        
        this.hostConnection = conn;
        conn.on('open', () => {
            console.log('Connected to host');
            this.isConnected = true;
            conn.send({
                type: 'JOIN_ROOM',
                peerId: this.peer.id
            });
            
            if (this.onConnectionCallback) {
                this.onConnectionCallback();
            }
        });
        
        conn.on('data', (data) => {
            this.handleIncomingData(data);
        });
        
        conn.on('close', () => {
            console.log('Disconnected from host');
            this.isConnected = false;
            
            if (this.onDisconnectCallback) {
                this.onDisconnectCallback();
            }
            
            // Try to reconnect or become host
            this.tryBecomeHost();
        });
        
        conn.on('error', (err) => {
            console.error('Connection error:', err);
            this.isConnected = false;
            
            // Try to reconnect or become host
            this.tryBecomeHost();
        });
        
        return true;
    }

    // Handle a new incoming connection
    handleNewConnection(conn) {
        console.log('New connection from:', conn.peer);
        
        // Check if this is a room discovery attempt
        if (conn.metadata && conn.metadata.roomId) {
            console.log('Room discovery connection for room:', conn.metadata.roomId);
            
            // If we're hosting this room, respond
            if (this.isHost && this.roomId === conn.metadata.roomId) {
                console.log('We are hosting room:', conn.metadata.roomId);
                
                // This connection is for our room, accept it
                this.connections.push(conn);
                
                // Set up normal connection handlers
                this.setupConnectionEventHandlers(conn);
            }
        } else {
            // Regular connection
            this.connections.push(conn);
            this.setupConnectionEventHandlers(conn);
        }
    }
    
    // Set up event handlers for a connection
    setupConnectionEventHandlers(conn) {
        conn.on('open', () => {
            console.log('Connection opened with:', conn.peer);
            
            // If we're the host, send the current state to the new peer
            if (this.isHost && this.onDataCallback) {
                // Request the current state from the app
                const currentState = this.onDataCallback('REQUEST_STATE');
                
                // Send the state to the new peer
                conn.send({
                    type: 'STATE_UPDATE',
                    data: currentState
                });
            }
        });
        
        conn.on('data', (data) => {
            console.log('Received data from peer:', data);
            this.handleIncomingData(data, conn);
        });
        
        conn.on('close', () => {
            console.log('Connection closed with:', conn.peer);
            this.connections = this.connections.filter(c => c.peer !== conn.peer);
        });
        
        conn.on('error', (err) => {
            console.error('Connection error with peer:', err);
            this.connections = this.connections.filter(c => c.peer !== conn.peer);
        });
    }

    // Handle incoming data from peers
    handleIncomingData(data, sourcePeer = null) {
        if (!data || !data.type) return;
        
        // Handle different message types
        switch (data.type) {
            case 'JOIN_ROOM':
                console.log('Peer joined room:', data.peerId);
                break;
                
            case 'STATE_UPDATE':
                // Pass the state update to the app
                if (this.onDataCallback) {
                    this.onDataCallback('STATE_UPDATE', data.data);
                }
                break;
                
            case 'ACTION':
                // Pass the action to the app
                if (this.onDataCallback) {
                    this.onDataCallback('ACTION', data.action);
                }
                
                // If we're the host, broadcast to all other peers
                if (this.isHost && sourcePeer) {
                    this.broadcast(data, sourcePeer.peer);
                }
                break;
                
            case 'ROOM_DISCOVERY':
                // Check if we're the host of the requested room
                if (this.isHost && this.roomId === data.roomId) {
                    // Respond with our peer ID
                    if (sourcePeer && sourcePeer.open) {
                        sourcePeer.send({
                            type: 'ROOM_DISCOVERY_RESPONSE',
                            roomId: data.roomId,
                            hostPeerId: this.peer.id
                        });
                    }
                }
                break;
                
            case 'ROOM_DISCOVERY_RESPONSE':
                // Check if we're waiting for this room
                if (this.pendingDiscovery && this.pendingDiscovery.roomId === data.roomId) {
                    const callback = this.pendingDiscovery.callback;
                    this.pendingDiscovery = null;
                    
                    if (callback) {
                        callback(data.hostPeerId);
                    }
                }
                break;
        }
    }

    // Broadcast data to all connected peers
    broadcast(data, excludePeerId = null) {
        this.connections.forEach(conn => {
            if (conn.peer !== excludePeerId && conn.open) {
                conn.send(data);
            }
        });
    }

    // Send data to the host (if client) or broadcast to all (if host)
    sendData(action) {
        const data = {
            type: 'ACTION',
            action: action
        };
        
        if (this.isHost) {
            // As host, broadcast to all peers
            this.broadcast(data);
            
            // Also process locally
            if (this.onDataCallback) {
                this.onDataCallback('ACTION', action);
            }
        } else if (this.hostConnection && this.hostConnection.open) {
            // As client, send to host
            this.hostConnection.send(data);
            
            // Don't process locally, wait for host to broadcast back
        }
    }

    // Try to become the host if current host is disconnected
    tryBecomeHost() {
        // Wait a bit to see if we can reconnect to the host
        setTimeout(() => {
            if (!this.isConnected && !this.isHost) {
                console.log('Trying to become the new host...');
                
                // Become the new host with the same room ID
                this.isHost = true;
                
                // If we're taking over, our peer ID is now associated with this room
                if (this.roomId) {
                    // Update the room ID mapping
                    this.roomIdMapping = {
                        friendlyId: this.roomId,
                        peerId: this.peer.id
                    };
                }
                
                // Notify the app that we're now the host
                if (this.onHostChangeCallback) {
                    this.onHostChangeCallback(true, this.roomId);
                }
            }
        }, 3000);
    }

    // Disconnect from the room
    disconnect() {
        // Close all connections
        this.connections.forEach(conn => {
            if (conn.open) conn.close();
        });
        
        // Close host connection if any
        if (this.hostConnection && this.hostConnection.open) {
            this.hostConnection.close();
        }
        
        // Reset state
        this.connections = [];
        this.isHost = false;
        this.hostConnection = null;
        this.isConnected = false;
        
        // Clear room ID from storage
        localStorage.removeItem('pubgRoomId');
        
        // Close the peer connection
        if (this.peer && !this.peer.destroyed) {
            this.peer.destroy();
        }
    }

    // Generate a simple, user-friendly room ID
    generateRoomId() {
        // Use PUBG-themed single words as room codes
        const pubgWords = [
            'CHICKEN', 'DINNER', 'SQUAD', 'ROYALE', 'SNIPER',
            'HELMET', 'FRYING', 'AIRDROP', 'WINNER', 'ERANGEL',
            'MIRAMAR', 'SANHOK', 'VIKENDI', 'TAEGO', 'PARAMO',
            'BRIDGE', 'POCHINKI', 'SCHOOL', 'MILITARY', 'GEORGOPOL',
            'MYLTA', 'ROZHOK', 'GATKA', 'ZHARKI', 'SHELTER',
            'GHILLIE', 'MEDKIT', 'BOOSTER', 'REDZONE', 'BLUEZONE'
        ];
        
        // Select a random word
        const result = pubgWords[Math.floor(Math.random() * pubgWords.length)];
        
        // Store the mapping between friendly ID and actual peer ID
        this.roomIdMapping = {
            friendlyId: result,
            peerId: this.peer.id
        };
        
        return result;
    }

    // Register callback for incoming data
    onData(callback) {
        this.onDataCallback = callback;
    }

    // Register callback for connection events
    onConnection(callback) {
        this.onConnectionCallback = callback;
    }

    // Register callback for disconnection events
    onDisconnect(callback) {
        this.onDisconnectCallback = callback;
    }

    // Register callback for host change events
    onHostChange(callback) {
        this.onHostChangeCallback = callback;
    }

    // Check if we're connected to a room
    isInRoom() {
        return this.roomId !== null && (this.isHost || this.isConnected);
    }

    // Get the current room ID
    getRoomId() {
        return this.roomId;
    }

    // Check if we're the host
    getIsHost() {
        return this.isHost;
    }
}

// Create a global instance
window.pubgSync = new PubgSync();

// Initialize on page load
window.addEventListener('load', () => {
    window.pubgSync.init();
});
