document.addEventListener('DOMContentLoaded', function() {
    // Audio is now loaded from our sounds/notification.js file with embedded base64 audio
    // No need to preload separately
    // Check if dark mode was previously enabled
    const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
    if (darkModeEnabled) {
        document.body.classList.add('dark-theme');
    }
    // DOM Elements
    const playerNameInput = document.getElementById('player-name');
    const directTeamNameInput = document.getElementById('direct-team-name');
    const joinBtn = document.getElementById('join-btn');
    const addToTeamBtn = document.getElementById('add-to-team-btn');
    const nextBtn = document.getElementById('next-btn');
    const resetQueueBtn = document.getElementById('reset-queue');
    const resetAllBtn = document.getElementById('reset-all');
    const queueContainer = document.getElementById('queue-container');
    const currentTeamContainer = document.getElementById('current-team');
    const nowServingDisplay = document.getElementById('now-serving');
    const queueCountDisplay = document.getElementById('queue-count');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const autoCallToggle = document.getElementById('auto-call-toggle');
    
    // Notification elements
    const notificationModal = new bootstrap.Modal(document.getElementById('notification-modal'), {
        backdrop: 'static',
        keyboard: false
    });
    const notificationMessage = document.getElementById('notification-message');
    const chickenRainContainer = document.getElementById('chicken-rain-container');
    
    // App State
    let queue = JSON.parse(localStorage.getItem('pubgQueue')) || [];
    let currentTeam = JSON.parse(localStorage.getItem('pubgTeam')) || [];
    let currentTicket = parseInt(localStorage.getItem('currentTicket')) || 1;
    let lastCalledTicket = parseInt(localStorage.getItem('lastCalledTicket')) || 0;
    let soundEnabled = false; // Sound notifications disabled per user request
    let autoCallEnabled = localStorage.getItem('autoCallEnabled') === 'true'; // Default to false
    
    // Initialize toggle states
    darkModeToggle.checked = darkModeEnabled;
    autoCallToggle.checked = autoCallEnabled;
    
    // Initialize the UI
    updateUI();
    
    // Event Listeners
    joinBtn.addEventListener('click', addToQueue);
    addToTeamBtn.addEventListener('click', addDirectlyToTeam);
    nextBtn.addEventListener('click', callNextPlayer);
    resetQueueBtn.addEventListener('click', resetQueue);
    resetAllBtn.addEventListener('click', resetAll);
    
    // Theme toggle listeners
    darkModeToggle.addEventListener('change', toggleDarkMode);
    autoCallToggle.addEventListener('change', toggleAutoCall);
    
    playerNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addToQueue();
        }
    });
    
    directTeamNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addDirectlyToTeam();
        }
    });
    
    // Functions
    function addToQueue() {
        const playerName = playerNameInput.value.trim();
        
        if (!playerName) {
            alert('Please enter your name');
            return;
        }
        
        const ticket = {
            id: currentTicket,
            name: playerName,
            timestamp: Date.now()
        };
        
        queue.push(ticket);
        currentTicket++;
        
        // Save to localStorage
        saveState();
        updateUI();
        
        // Clear input
        playerNameInput.value = '';
    }
    
    function addDirectlyToTeam() {
        const playerName = directTeamNameInput.value.trim();
        
        if (!playerName) {
            alert('Please enter a player name');
            return;
        }
        
        if (currentTeam.length >= 4) {
            alert('Team is full! Remove a player before adding a new one.');
            return;
        }
        
        const player = {
            id: 0, // Not from queue, so no ticket number
            name: playerName,
            timestamp: Date.now()
        };
        
        currentTeam.push(player);
        
        // Save to localStorage
        saveState();
        updateUI();
        
        // Clear input
        directTeamNameInput.value = '';
    }
    
    function callNextPlayer() {
        if (queue.length === 0) {
            alert('Queue is empty!');
            return;
        }
        
        if (currentTeam.length >= 4) {
            alert('Team is full! Remove a player before adding a new one.');
            return;
        }
        
        // Add loading animation while "processing" the next player
        nextBtn.innerHTML = 'Processing <div class="loading-dots"><span></span><span></span><span></span></div>';
        nextBtn.disabled = true;
        
        // Delay to show the animation (simulates processing)
        setTimeout(() => {
            // Get next player from queue
            const nextPlayer = queue.shift();
            currentTeam.push(nextPlayer);
            lastCalledTicket = nextPlayer.id;
            
            // Update the now serving display with animation
            nowServingDisplay.style.animation = 'none';
            // Trigger reflow to restart animation
            void nowServingDisplay.offsetWidth;
            nowServingDisplay.style.animation = 'glow 1.5s infinite alternate';
            nowServingDisplay.textContent = nextPlayer.id;
            
            // Show notification modal
            notificationMessage.textContent = `${nextPlayer.name}, your ticket #${nextPlayer.id} has been called!`;
            notificationModal.show();
            
            // Visual notification only and start chicken rain
            playNotificationSound();
            startChickenRain();
            
            // Save state and update UI
            saveState();
            updateUI();
            
            // Reset button
            nextBtn.innerHTML = 'Next Player <i class="fas fa-arrow-right"></i>';
            nextBtn.disabled = false;
        }, 800); // Short delay for animation effect
    }
    
    function updateUI() {
        // Update queue display
        queueContainer.innerHTML = '';
        queue.forEach((ticket, index) => {
            const ticketEl = document.createElement('div');
            ticketEl.className = 'ticket' + (ticket.id === lastCalledTicket ? ' active' : '');
            // Set custom property for staggered animation
            ticketEl.style.setProperty('--index', index);
            ticketEl.innerHTML = `
                <div>
                    <span class="number">#${ticket.id}</span>
                    <span class="name">${ticket.name}</span>
                </div>
                <div>
                    <small>${formatTimestamp(ticket.timestamp)}</small>
                </div>
            `;
            queueContainer.appendChild(ticketEl);
        });
        
        // Update queue statistics
        queueCountDisplay.textContent = queue.length;
        
        // Auto-call next player if enabled and team has space
        if (autoCallEnabled && currentTeam.length < 4 && queue.length > 0) {
            setTimeout(() => {
                callNextPlayer();
            }, 3000); // Wait 3 seconds before auto-calling
        }
        
        // Update team display
        currentTeamContainer.innerHTML = '';
        currentTeam.forEach((player, index) => {
            const playerEl = document.createElement('div');
            playerEl.className = 'team-member';
            
            // Get a PUBG-themed avatar for the player
            const avatarType = getPubgAvatar(player.name);
            const avatarIcon = getPubgAvatarIcon(avatarType);
            const avatarClass = `avatar avatar-${avatarType}`;
            
            playerEl.innerHTML = `
                <div class="${avatarClass}">${avatarIcon}</div>
                <div class="name">${player.name}</div>
                <button class="remove-player" data-index="${index}">✕</button>
            `;
            currentTeamContainer.appendChild(playerEl);
        });
        
        // Add remove player event listeners
        document.querySelectorAll('.remove-player').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                removePlayerFromTeam(index);
            });
        });
        
        // Update now serving display
        nowServingDisplay.textContent = lastCalledTicket || '--';
    }
    
    function removePlayerFromTeam(index) {
        currentTeam.splice(index, 1);
        saveState();
        updateUI();
    }
    
    function resetQueue() {
        if (confirm('Are you sure you want to reset the queue?')) {
            queue = [];
            localStorage.setItem('pubgQueue', JSON.stringify(queue));
            updateUI();
        }
    }
    
    function resetAll() {
        if (confirm('Are you sure you want to reset everything? This will clear the queue, current team, and ticket numbers.')) {
            queue = [];
            currentTeam = [];
            currentTicket = 1;
            lastCalledTicket = 0;
            
            saveState();
            updateUI();
        }
    }
    
    function saveState() {
        localStorage.setItem('pubgQueue', JSON.stringify(queue));
        localStorage.setItem('pubgTeam', JSON.stringify(currentTeam));
        localStorage.setItem('currentTicket', currentTicket);
        localStorage.setItem('lastCalledTicket', lastCalledTicket);
        localStorage.setItem('darkMode', document.body.classList.contains('dark-theme'));
        localStorage.setItem('autoCallEnabled', autoCallEnabled);
    }
    
    function formatTimestamp(timestamp) {
        // Convert to US Eastern Time
        const date = new Date(timestamp);
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/New_York'
        };
        return new Intl.DateTimeFormat('en-US', options).format(date);
    }
    
    function playNotificationSound() {
        // Visual notification effect only
        // Sound notifications removed per user request
        
        // Add visual notification effect
        document.body.classList.add('notification-active');
        setTimeout(() => {
            document.body.classList.remove('notification-active');
        }, 1500);
    }
    
    // Toggle dark mode
    function toggleDarkMode() {
        document.body.classList.toggle('dark-theme');
        darkModeToggle.checked = document.body.classList.contains('dark-theme');
        saveState();
    }
    
    // Toggle auto-call
    function toggleAutoCall() {
        autoCallEnabled = autoCallToggle.checked;
        saveState();
        
        // If auto-call was just enabled and we have space and people waiting,
        // trigger the auto-call immediately
        if (autoCallEnabled && currentTeam.length < 4 && queue.length > 0) {
            setTimeout(() => {
                callNextPlayer();
            }, 1000);
        }
    }
    
    // Function to create chicken animation effect
    function startChickenRain() {
        // Clear any existing chickens
        chickenRainContainer.innerHTML = '';
        
        // Randomly choose between rain and explosion
        const useExplosion = Math.random() > 0.5;
        
        if (useExplosion) {
            // Create 40 chickens in explosion pattern
            for (let i = 0; i < 40; i++) {
                const chicken = document.createElement('div');
                chicken.className = 'chicken explode';
                chicken.textContent = '🍗';
                
                // Random direction for explosion
                const angle = Math.random() * Math.PI * 2; // Random angle in radians
                const distance = 50 + Math.random() * 150; // Random distance
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                const rotation = Math.random() * 720 - 360; // Random rotation between -360 and 360 degrees
                
                chicken.style.setProperty('--explode-x', `${x}px`);
                chicken.style.setProperty('--explode-y', `${y}px`);
                chicken.style.setProperty('--explode-rotate', `${rotation}deg`);
                chicken.style.animationDelay = `${Math.random() * 0.5}s`;
                
                chickenRainContainer.appendChild(chicken);
            }
        } else {
            // Create 30 chickens in rain pattern
            for (let i = 0; i < 30; i++) {
                const chicken = document.createElement('div');
                chicken.className = 'chicken rain';
                chicken.textContent = '🍗';
                chicken.style.left = `${Math.random() * 100}%`;
                chicken.style.animationDuration = `${3 + Math.random() * 4}s, ${1 + Math.random() * 2}s`;
                chicken.style.animationDelay = `${Math.random() * 2}s`;
                
                chickenRainContainer.appendChild(chicken);
            }
        }
        
        // Clear chickens after animation completes
        setTimeout(() => {
            chickenRainContainer.innerHTML = '';
        }, 5000);
    }
    
    // Generate consistent PUBG avatar type based on player name
    function getPubgAvatar(name) {
        // Calculate a hash of the name to get consistent avatars for the same player
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = ((hash << 5) - hash) + name.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        
        // PUBG-themed avatar types
        const avatarTypes = ['helmet', 'ghillie', 'pan', 'medic', 'sniper', 'assault'];
        
        // Use the hash to determine avatar type (will be consistent for same name)
        const index = Math.abs(hash) % avatarTypes.length;
        return avatarTypes[index];
    }
    
    // Get the appropriate icon for each avatar type
    function getPubgAvatarIcon(type) {
        switch(type) {
            case 'helmet': return '<i class="fas fa-hard-hat"></i>';
            case 'ghillie': return '<i class="fas fa-leaf"></i>';
            case 'pan': return '<i class="fas fa-utensils"></i>';
            case 'medic': return '<i class="fas fa-first-aid"></i>';
            case 'sniper': return '<i class="fas fa-crosshairs"></i>';
            case 'assault': return '<i class="fas fa-shield-alt"></i>';
            default: return '<i class="fas fa-user"></i>';
        }
    }
});