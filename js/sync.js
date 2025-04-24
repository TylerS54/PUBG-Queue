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
        // Use a public PeerJS server for better connectivity
        // This allows connections across different networks
        this.peer = new Peer({
            host: 'peerjs-server.herokuapp.com',
            secure: true,
            port: 443,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            },
            debug: 2 // Set debug level for more info in console
        });

        // Initialize the global room registry with a network-accessible registry
        window.PUBG_ROOM_REGISTRY = window.PUBG_ROOM_REGISTRY || {};
        
        // Try to load room registry from localStorage
        try {
            const savedRegistry = localStorage.getItem('pubgRoomRegistry');
            if (savedRegistry) {
                const registry = JSON.parse(savedRegistry);
                // Merge into global registry
                Object.assign(window.PUBG_ROOM_REGISTRY, registry);
                console.log('Loaded room registry from localStorage:', window.PUBG_ROOM_REGISTRY);
            }
        } catch (e) {
            console.error('Failed to load room registry from localStorage:', e);
        }

        // Handle peer open event
        this.peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            // Store my ID for reconnection
            localStorage.setItem('myPeerId', id);
            
            // Auto-reconnect to previous session if possible
            // Only attempt after we have a valid peer ID
            this.autoReconnect();
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
        
        // Handle disconnection from the signaling server
        this.peer.on('disconnected', () => {
            console.log('Disconnected from signaling server, attempting to reconnect...');
            this.peer.reconnect();
        });
    }

    // Try to reconnect to a previous session
    autoReconnect() {
        const savedRoomId = localStorage.getItem('pubgRoomId');
        if (savedRoomId) {
            console.log('Attempting to reconnect to room:', savedRoomId);
            // Since this is now called in the peer.open event, we should have a valid peer ID
            this.joinRoom(savedRoomId);
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
        
        // Make our peer ID global so it can be shared
        // With the custom ID format that includes the room code,
        // anyone with the room ID can connect directly
        
        const roomIdLower = this.roomId.toLowerCase();
        
        // When we're the host, the peer ID is the actual peer ID
        // Anyone with the room ID can use this simple mapping to find us
        window.PUBG_ROOM_REGISTRY[roomIdLower] = this.peer.id;
        
        // Also store in localStorage for persistence
        try {
            let registry = JSON.parse(localStorage.getItem('pubgRoomRegistry') || '{}');
            registry[roomIdLower] = this.peer.id;
            localStorage.setItem('pubgRoomRegistry', JSON.stringify(registry));
        } catch (e) {
            console.error('Failed to save room registry to localStorage:', e);
        }
        
        console.log('Created room', this.roomId, 'with host peer ID:', this.peer.id);
        
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
        
        // Check if peer is ready, if not, wait and retry
        if (!this.peer || !this.peer.id) {
            console.log('Peer not ready yet, waiting 1 second before joining room');
            setTimeout(() => this.joinRoom(friendlyRoomId), 1000);
            return true; // Return optimistically
        }
        
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
    
    // Try direct connection to find the host peer ID
    tryDirectConnection(friendlyRoomId, callback) {
        // First, check if we've successfully created our peer
        if (!this.peer || !this.peer.id) {
            console.error('Peer connection not ready yet, retrying in 1 second');
            setTimeout(() => this.tryDirectConnection(friendlyRoomId, callback), 1000);
            return;
        }
        
        // For cross-device connections, we need a simple and direct way to address hosts
        // We'll try a few different approaches:
        const roomIdLower = friendlyRoomId.toLowerCase();
        
        // 1. Check our local registry first (fastest if available)
        if (window.PUBG_ROOM_REGISTRY && window.PUBG_ROOM_REGISTRY[roomIdLower]) {
            const hostId = window.PUBG_ROOM_REGISTRY[roomIdLower];
            console.log('Found host peer ID in local registry:', hostId);
            callback(hostId);
            this.pendingDiscovery = null;
            return;
        }
        
        // 2. Check localStorage registry
        try {
            const savedRegistry = localStorage.getItem('pubgRoomRegistry');
            if (savedRegistry) {
                const registry = JSON.parse(savedRegistry);
                if (registry[roomIdLower]) {
                    const hostId = registry[roomIdLower];
                    console.log('Found host peer ID in localStorage registry:', hostId);
                    window.PUBG_ROOM_REGISTRY[roomIdLower] = hostId;
                    callback(hostId);
                    this.pendingDiscovery = null;
                    return;
                }
            }
        } catch (e) {
            console.error('Error reading localStorage registry:', e);
        }
        
        // 3. Allow user to manually enter a host ID if they have it
        const manualInput = confirm(
            `Could not automatically find the host for room "${friendlyRoomId}". ` +
            `Would you like to enter the host's ID manually?`
        );
        
        if (manualInput) {
            const hostId = prompt(
                `Please enter the host ID for room "${friendlyRoomId}":`,
                ""
            );
            
            if (hostId && hostId.trim()) {
                // Store for future use
                window.PUBG_ROOM_REGISTRY[roomIdLower] = hostId.trim();
                try {
                    let registry = JSON.parse(localStorage.getItem('pubgRoomRegistry') || '{}');
                    registry[roomIdLower] = hostId.trim();
                    localStorage.setItem('pubgRoomRegistry', JSON.stringify(registry));
                } catch (e) {}
                
                callback(hostId.trim());
                this.pendingDiscovery = null;
                return;
            }
        }
        
        // No valid host ID found
        console.log('No valid host ID found for room:', friendlyRoomId);
        callback(null);
        this.pendingDiscovery = null;
    }
    
    // Setup connection event handlers
    setupConnectionHandlers(conn) {
        if (!conn) return false;
        
        this.hostConnection = conn;
        
        // Set a timeout in case the connection never opens
        let connectionTimeout = setTimeout(() => {
            console.error('Connection timed out');
            if (!this.isConnected && this.onDisconnectCallback) {
                this.onDisconnectCallback();
            }
        }, 5000);
        
        conn.on('open', () => {
            console.log('Connected to host');
            this.isConnected = true;
            clearTimeout(connectionTimeout);
            
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
            
            if (this.onDisconnectCallback) {
                this.onDisconnectCallback();
            }
            
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
                    // Update the global registry with our peer ID for this room
                    const roomIdLower = this.roomId.toLowerCase();
                    window.PUBG_ROOM_REGISTRY = window.PUBG_ROOM_REGISTRY || {};
                    window.PUBG_ROOM_REGISTRY[roomIdLower] = this.peer.id;
                    
                    // Also update in localStorage for persistence
                    try {
                        let registry = JSON.parse(localStorage.getItem('pubgRoomRegistry') || '{}');
                        registry[roomIdLower] = this.peer.id;
                        localStorage.setItem('pubgRoomRegistry', JSON.stringify(registry));
                    } catch (e) {
                        console.error('Failed to update room registry in localStorage:', e);
                    }
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
