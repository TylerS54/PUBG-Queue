# PUBG Squad Queue System

A modern, beautiful web application for managing your PUBG squad rotation. This app lets you and your friends join a virtual queue and get notified when it's your turn to play.

## Features

- **Take a Ticket System**: Players can join the queue and get a numbered ticket
- **Team Management**: See the current 4-person team at all times
- **Notification System**: Visual and audio notifications when a player's ticket is called
- **Modern UI**: Clean, game-themed design with intuitive controls
- **Local Storage**: Queue and team data persist between browser sessions
- **Responsive Design**: Works on desktop and mobile devices

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
   - A notification sound will play

4. **Managing the Team**:
   - Current team members are displayed in the "Current Team" section
   - Remove a player by clicking the "✕" button next to their name

5. **Admin Controls**:
   - "Reset Queue": Clears only the waiting queue
   - "Reset Everything": Clears the queue, team, and resets ticket numbers

## Local Development

This is a static web application with no server requirements. It uses:

- HTML5
- CSS3 with modern features
- JavaScript (ES6+)
- Bootstrap 5 for responsive layout
- Font Awesome for icons
- Local Storage API for persistence

## Customization

Feel free to customize the app by modifying:

- `css/styles.css` for styling changes
- `js/app.js` for functionality changes
- `index.html` for structure changes

## License

This project is for personal use only.

---

Enjoy your PUBG sessions with better team coordination!