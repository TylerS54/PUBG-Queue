# PUBG Winner Winner Chicken Dinner Queue

A modern, beautiful web application for managing your PUBG squad rotation. This app lets you and your friends join a virtual queue and get notified when it's your turn to play.

## Features

- **Take a Ticket System**: Players can join the queue and get a numbered ticket
- **Team Management**: See the current 4-person team at all times
- **Notification System**: Visual notifications when a player's ticket is called
- **Synchronized Experience**: Work across multiple browsers with peer-to-peer connectivity
- **Modern UI**: Clean, PUBG-themed design with intuitive controls
- **Local Storage**: Queue and team data persist between browser sessions
- **Responsive Design**: Works on desktop and mobile devices
- **No Backend Required**: Works with GitHub Pages or any static file hosting

## How to Use

1. **Open the app**: Simply open `index.html` in any modern web browser

2. **Join the Queue**:
   - Enter your name in the input box
   - Click "Take a Ticket" or press Enter
   - You'll be added to the waiting queue with a unique ticket number

3. **Calling Next Player**:
   - When a spot opens up in the team, click "Next Player"
   - The next person in the queue will be added to the team
   - Their ticket number will be displayed in "Now Serving"
   - A chicken animation celebration will play

4. **Managing the Team**:
   - Current team members are displayed in the "Current Team" section
   - Remove a player by clicking the "✕" button next to their name

5. **Sync Across Devices**:
   - Click "Create New Room" to generate a simple PUBG-themed room code
   - Room codes are single words like "CHICKEN" or "POCHINKI"
   - Copy the room code and share it with others
   - Others can enter the room code and click "Join" to connect
   - All changes to the queue or team will sync across all connected devices

6. **Admin Controls**:
   - "Reset Queue": Clears only the waiting queue
   - "Reset Everything": Clears the queue, team, and resets ticket numbers
   - "Dark Mode": Toggle between light and dark themes
   - "Auto-Call": Automatically call the next player when a spot opens on the team

## Local Development

This is a static web application with no backend server requirements. It uses:

- HTML5
- CSS3 with modern features
- JavaScript (ES6+)
- Bootstrap 5 for responsive layout
- Font Awesome for icons
- Local Storage API for persistence
- PeerJS for WebRTC-based peer-to-peer data synchronization

## Customization

Feel free to customize the app by modifying:

- `css/styles.css` for styling changes
- `js/app.js` for core application functionality
- `js/sync.js` for synchronization logic
- `index.html` for structure changes

## License

This project is for personal use only.

---

Enjoy your PUBG sessions with better team coordination!