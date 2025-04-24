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
        // Use the default PeerJS cloud service with a simple, predictable ID format
        // The ID format will be pubg_ + roomId - making connection much easier
        
        // We don't initialize the peer until a room is created or joined
        // This avoids unnecessary connections and errors
        
        // Handle incoming connections when peer is created
        this.setupPeerHandlers = () => {
            if (!this.peer) return;
            
            // Handle incoming connections
            this.peer.on('connection', (conn) => {
                this.handleNewConnection(conn);
            });
    
            // Handle errors
            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
            });
            
            // Handle disconnection from the signaling server
            this.peer.on('disconnected', () => {
                console.log('Disconnected from signaling server, attempting to reconnect...');
                this.peer.reconnect();
            });
        };
    }

    // We've disabled auto-reconnect for simplicity
    
    // Clean up existing connection if there is one
    cleanupExistingConnection() {
        // Clear any intervals
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        // Close connection to host if we have one
        if (this.hostConnection && this.hostConnection.open) {
            try {
                this.hostConnection.close();
            } catch (e) {
                console.error('Error closing host connection:', e);
            }
        }
        
        // Close all peer connections
        if (this.connections && this.connections.length > 0) {
            this.connections.forEach(conn => {
                if (conn && conn.open) {
                    try {
                        conn.close();
                    } catch (e) {
                        console.error('Error closing connection:', e);
                    }
                }
            });
        }
        
        // Destroy the peer object
        if (this.peer && !this.peer.destroyed) {
            try {
                this.peer.destroy();
            } catch (e) {
                console.error('Error destroying peer:', e);
            }
        }
        
        // Reset state
        this.peer = null;
        this.connections = [];
        this.isConnected = false;
        this.hostConnection = null;
        this.pingInterval = null;
    }

    // Create a new room as host
    createRoom() {
        // Clean up any existing connection
        this.cleanupExistingConnection();
        
        this.isHost = true;
        this.roomId = this.generateRoomId();
        localStorage.setItem('pubgRoomId', this.roomId);
        
        // Create a predictable peer ID based on the room code
        // This is the key to making it simple!
        const peerId = 'pubg_' + this.roomId.toLowerCase();
        
        // Create the peer with this specific ID
        this.peer = new Peer(peerId, {
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });
        
        // Set up the peer event handlers
        this.setupPeerHandlers();
        
        // When peer is successfully connected to the server
        this.peer.on('open', (id) => {
            console.log('Created room', this.roomId, 'with host peer ID:', id);
            
            // Display the room ID for sharing
            if (this.onHostChangeCallback) {
                this.onHostChangeCallback(true, this.roomId);
            }
        });
        
        // Handle peer error (ID already taken, etc)
        this.peer.on('error', (err) => {
            if (err.type === 'unavailable-id') {
                // The room ID is already in use, generate a new one
                console.error('Room ID already in use. Try again.');
                alert('This room name is already in use. Please try again with a different name.');
                this.cleanupExistingConnection();
                
                // Notify UI
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback('room_exists');
                }
            }
        });
        
        return this.roomId;
    }

    // Join an existing room
    joinRoom(friendlyRoomId) {
        if (!friendlyRoomId) return false;
        
        // Clean up any existing connection
        this.cleanupExistingConnection();
        
        // Standardize the room ID format
        friendlyRoomId = friendlyRoomId.trim();
        
        this.isHost = false;
        this.roomId = friendlyRoomId;
        localStorage.setItem('pubgRoomId', friendlyRoomId);
        
        // Display connecting indicator in UI
        if (this.onConnectionCallback) {
            this.onConnectionCallback('connecting');
        }
        
        // Create our peer
        this.peer = new Peer(null, {  // Random ID for client
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });
        
        // Set up handlers
        this.setupPeerHandlers();
        
        // When peer is open, connect to host using the predictable ID format
        this.peer.on('open', (id) => {
            console.log('My client peer ID:', id);
            
            // The host peer ID is predictable - it's pubg_ + roomId.toLowerCase()
            const hostPeerId = 'pubg_' + friendlyRoomId.toLowerCase();
            
            console.log('Connecting to host:', hostPeerId);
            
            // Connect to the host
            const conn = this.peer.connect(hostPeerId, {
                reliable: true,
                metadata: { roomId: friendlyRoomId }
            });
            
            if (!conn) {
                console.error('Failed to create connection to host');
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback('connection_failed');
                }
                return false;
            }
            
            this.setupConnectionHandlers(conn);
        });
        
        // Handle connection errors
        this.peer.on('error', (err) => {
            console.error('Peer error when joining room:', err);
            
            if (err.type === 'peer-unavailable') {
                // The host peer ID doesn't exist
                console.error('Room not found or host offline');
                alert('Room "' + friendlyRoomId + '" not found. The host may be offline or the room ID is incorrect.');
                
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback('room_not_found');
                }
            } else {
                // Other errors
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback('error');
                }
            }
        });
        
        return true;
    }
    
    // We no longer need discovery methods - the connection is direct
    // based on a predictable peer ID format
    
    // Setup connection event handlers
    setupConnectionHandlers(conn) {
        if (!conn) return false;
        
        this.hostConnection = conn;
        
        // Set a longer timeout for connection establishment
        let connectionTimeout = setTimeout(() => {
            console.error('Connection timed out');
            
            // Only disconnect if we're still not connected
            if (!this.isConnected) {
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback('timeout');
                }
                
                // Clean up the failed connection
                if (this.hostConnection) {
                    try {
                        this.hostConnection.close();
                    } catch (e) {
                        console.error('Error closing connection:', e);
                    }
                    this.hostConnection = null;
                }
            }
        }, 15000); // Increased to 15 seconds for very slow networks
        
        // Track if this specific connection is open
        let isThisConnectionOpen = false;
        
        conn.on('open', () => {
            console.log('Connected to host successfully');
            this.isConnected = true;
            isThisConnectionOpen = true;
            clearTimeout(connectionTimeout);
            
            // Send join message to the host
            try {
                conn.send({
                    type: 'JOIN_ROOM',
                    peerId: this.peer.id
                });
                
                // Let the app know we're connected
                if (this.onConnectionCallback) {
                    this.onConnectionCallback('success');
                }
                
                // Set up a ping interval to keep the connection alive
                this.pingInterval = setInterval(() => {
                    if (conn.open) {
                        try {
                            conn.send({ type: 'PING' });
                        } catch (e) {
                            console.error('Error sending ping:', e);
                        }
                    } else {
                        clearInterval(this.pingInterval);
                    }
                }, 30000); // Send a ping every 30 seconds
            } catch (e) {
                console.error('Error in connection open handler:', e);
            }
        });
        
        conn.on('data', (data) => {
            try {
                // Ignore pings in the console
                if (data && data.type !== 'PING') {
                    this.handleIncomingData(data);
                }
            } catch (e) {
                console.error('Error handling incoming data:', e);
            }
        });
        
        conn.on('close', () => {
            console.log('Disconnected from host');
            
            // Only process if this connection was actually open
            if (isThisConnectionOpen) {
                this.isConnected = false;
                clearInterval(this.pingInterval);
                
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback('closed');
                }
                
                // Try to reconnect or become host
                this.tryBecomeHost();
            }
        });
        
        conn.on('error', (err) => {
            console.error('Connection error:', err);
            
            // Only process if this connection was actually open
            if (isThisConnectionOpen) {
                this.isConnected = false;
                clearInterval(this.pingInterval);
                
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback('error');
                }
                
                // Try to reconnect or become host
                this.tryBecomeHost();
            }
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
                
            case 'PING':
                // Silently ignore ping messages, they're just to keep the connection alive
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
                    this.onDataCallback('ACTION', data);  // Pass the entire data object
                }
                
                // If we're the host, broadcast to all other peers
                if (this.isHost && sourcePeer) {
                    this.broadcast(data, sourcePeer.peer);
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
            if (!this.isConnected && !this.isHost && this.roomId) {
                console.log('Trying to become the new host...');
                
                // We can't actually become the host with the same ID as the previous host
                // This would require us to use the exact same predictable peer ID
                // which might still be in use by the previous host
                
                // Instead, we'll disconnect and let the user know they need to create a new room
                this.cleanupExistingConnection();
                
                alert("The connection to the host was lost. You'll need to create a new room or join another room.");
                
                // Notify the app that we're disconnected
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback('host_disconnected');
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
        
        // Clear room ID from storage
        localStorage.removeItem('pubgRoomId');
        
        // Clean up the connection
        this.cleanupExistingConnection();
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
        
        // Add a random number to make collisions less likely (still simple for users)
        const randomNum = Math.floor(Math.random() * 100);
        
        // Select a random word
        const word = pubgWords[Math.floor(Math.random() * pubgWords.length)];
        const result = word + randomNum;
        
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
