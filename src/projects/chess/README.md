# Chess Project

The goal of this project was to create online multiplayer chess **from scratch on AWS Amplify**.  
Throughout this project I became much more comfortable with React and AWS backend services.  
*I didn't realize how subtly feature-rich chess sites are until now.*

## APIs / Libraries Used
- **React-Chessboard**
- **Chess.js**
- **AWS Amplify**
- **GraphQL**
- **Cognito**

## Features

A fully functional multiplayer chess site with many of the features expected today:

- Move validation (client-side via chess.js)
- Click-or-drag movement
- Timers per move
- Draw offers
- Comprehensive game-end detection:
  - Threefold repetition  
  - 50-move rule  
  - Checkmate  
  - Resignation  
  - Accepted draw  
  - Stalemate  
- A full move history panel  
  - Each move is clickable and jumps to that position
- Board rotation button
- **ELO measured in MCBAC** (Magnus Carlson Blood Alcohol Content)  
  - MCBAC is a humorous model approximating *how drunk Magnus would need to be* to play at a given rating  
  - Defined by  
    \[
    B(R) = 0.12 + \frac{1}{11.42}\ln\!\left(\frac{2445.31}{(R - 900)} - 1\right)
    \]
    If \(R \le 900\), the site displays a skull and crossbones.
- **En Passant is forced** (if it's legal, you *must* play it)

### Lobby System
- Game browser with live updates
- Create game button
- Spectator mode for any game
- Automatic game expiration (1-day TTL in DynamoDB)
- Cookies store the current game ID for quick return

## Basic System Overview

This project is broken into three main React components: **ChessApp**, **ChessLobby**, and **ChessGame**.

1. **ChessApp** renders first when the chess project is opened.  
2. If no active game is selected, the lobby is shown, allowing you to create or join games.  
3. Once a game is selected, **ChessGame** loads the current board state.  
   - If a color has no player, "Join as White/Black" buttons appear.  
   - Buttons appear for everyone, but only logged-in users can actually join.  
4. Login and authentication are handled by **AWS Cognito**.  
5. Once both players join, gameplay begins.  
6. Moves are validated **client-side** using chess.js.  
   - The server only stores state: one DynamoDB item for the game, and one item per move.  
   - This keeps compute costs low and avoids server-side move validation.  
7. During the game, bottom buttons allow:
   - **Resign** (immediate loss)
   - **Offer Draw** (writes a draw request into the game document; the other client surfaces a UI prompt)  
8. When the game ends, “Play Again” and “Delete Game” buttons appear.  
9. All games automatically expire and are removed after 24 hours via DynamoDB TTL.
