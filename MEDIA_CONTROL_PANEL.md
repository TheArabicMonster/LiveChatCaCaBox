# Media Control Panel

The Media Control Panel is a web-based interface that allows you to send media files directly to your stream without using Discord commands.

## Features

- **Folder Browsing**: Load and display media files from a custom folder on your system
- **File Upload**: Upload media files directly from your browser
- **Instant Display**: Click on any media file to instantly send it to your stream
- **Real-time Status**: See connection status and receive notifications
- **Grid View**: Visual grid layout for easy media file browsing

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

### 4. Send Media to Stream

1. Click on any media file in the grid
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
