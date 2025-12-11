# Media Control Panel

The Media Control Panel is a web-based interface that allows you to send media files directly to your stream without using Discord commands.

## Features

### Media Management
- **Folder Browsing**: Load and display media files from a custom folder on your system
- **File Upload**: Upload media files directly from your browser
- **File Rename**: Easily rename files directly from the control panel for better organization
- **Search & Filter**: Real-time search bar to quickly find files
- **Sort Options**: Sort files by name (A-Z/Z-A), type, or date (newest/oldest)
- **View Size Controls**: Choose between small, medium, or large icon sizes like Windows File Explorer
- **Instant Display**: Click on any media file to instantly send it to your stream

### Stream Controls
- **Text-to-Speech**: Type text to be spoken on stream (normal or hidden mode)
- **Stop Media**: Instantly stop currently playing media with one click
- **Stream Settings**: Configure default duration, max duration, and fullscreen mode

### General
- **Real-time Status**: See connection status and receive notifications
- **Grid View**: Visual grid layout for easy media file browsing
- **No Discord Required**: All Discord bot commands available in the web interface

## How to Use

### 1. Access the Control Panel

Navigate to the control panel in your web browser:
```
http://localhost:3000/control
```

Or if you're using a custom API_URL:
```
http://your-api-url/control
```

### 2. Connect to Your Discord Server

1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on your Discord server and select "Copy Server ID"
3. Paste the Guild ID into the input field
4. Click "Connect"

### 3. Load Media Files

You have two options:

#### Option A: Load from Folder
1. Enter the full path to your media folder (e.g., `/home/user/stream-media`)
2. Click "Load Folder"
3. The panel will display all supported media files (images and videos)

#### Option B: Upload Files
1. Click on the file upload input
2. Select one or more media files from your computer
3. The files will be uploaded and displayed in the grid

### 4. Organize Your Media

#### Search for Files
1. Type in the search bar at the top
2. Files are filtered in real-time as you type
3. Search is case-insensitive

#### Sort Files
1. Use the "Sort by" dropdown to organize your media:
   - **Name (A-Z)**: Alphabetical order
   - **Name (Z-A)**: Reverse alphabetical order
   - **Type**: Group images and videos together
   - **Newest First**: Most recently modified files first
   - **Oldest First**: Oldest files first

#### Adjust View Size
1. Click the view size buttons (small/medium/large icons)
2. **Small**: Compact grid with 6 columns - see more files at once
3. **Medium**: Default view with 4 columns - balanced layout
4. **Large**: Detailed view with 3 columns - larger thumbnails

### 5. Rename Files (Optional)

1. Click the pencil icon (✏️) on any media card
2. A modal will appear showing the current filename
3. Edit the filename (the extension-free name is auto-selected)
4. Click "Rename" or press Enter to confirm
5. Press Escape or click "Cancel" to abort
6. The file will be renamed on your system instantly

**Note**: The rename feature works for both folder files and uploaded files. It validates that no duplicate names exist and sanitizes the filename for security.

### 6. Use Stream Controls

#### Text-to-Speech
1. Type your message in the text area
2. Click "🔊 Speak" to send with your username shown
3. Or click "🔊 Speak (Hidden)" to send anonymously
4. The text will be converted to speech and played on stream

#### Stop Current Media
1. Click "⏹️ Stop Current Media" button
2. Any currently playing media will stop immediately
3. The stream queue will be cleared

#### Configure Stream Settings
1. Click "⚙️ Stream Settings" button
2. Set your preferred options:
   - **Default Media Duration**: How long media plays (leave empty for auto-detect)
   - **Maximum Media Duration**: Cap for media length (leave empty for no limit)
   - **Display Fullscreen**: Toggle fullscreen display mode
3. Click "Save Settings" to apply changes
4. Settings are saved per Discord Guild and persist across sessions

### 7. Send Media to Stream

1. Click "Send to Stream" button or the media thumbnail
2. The file will be automatically sent to your stream
3. You'll receive a confirmation notification
4. The media will appear on your OBS overlay

## Supported File Formats

### Images
- JPG/JPEG
- PNG
- GIF
- WebP

### Videos
- MP4
- WebM
- MOV
- AVI

## Tips

- You can use both Discord commands and the Control Panel simultaneously
- The Control Panel works best with media files stored locally or on network drives
- For uploaded files, they're stored in the `uploads/` directory of the application
- Media files are sent to the same OBS overlay configured for Discord commands

## Troubleshooting

### Cannot connect to guild
- Verify your Discord Guild ID is correct
- Make sure the bot is running and connected to Discord

### Folder not found
- Ensure the folder path is absolute (full path from root)
- Check that the folder exists and you have read permissions

### Media not displaying
- Verify your OBS browser source is pointing to `/client?guildId=YOUR_GUILD_ID`
- Check that the media file format is supported
- Look at the server logs for any error messages

## Security Notes

- The Control Panel does not require authentication in the current version
- Only share the control panel URL with trusted users
- Uploaded files are stored on the server - manage storage accordingly
- Consider firewall rules if exposing the control panel to the internet
