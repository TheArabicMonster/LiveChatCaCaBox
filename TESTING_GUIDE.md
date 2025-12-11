# Testing Guide for Media Control Panel

## Prerequisites

Before testing the Media Control Panel, ensure you have:

1. **Discord Bot Setup**
   - Valid Discord Token
   - Valid Discord Client ID
   - Bot added to a Discord server

2. **Environment Configuration**
   - Copy `.env.example` to `.env`
   - Fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `API_URL`

3. **Dependencies Installed**
   ```bash
   pnpm install
   ```

## Starting the Server

Run the development server:
```bash
pnpm dev
```

The server should start on port 3000 by default.

## Testing Checklist

### 1. Access the Control Panel
- [ ] Navigate to `http://localhost:3000/control`
- [ ] Verify the page loads successfully
- [ ] Check that all UI elements are visible

### 2. Connect to Discord Guild
- [ ] Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
- [ ] Right-click your Discord server and select "Copy Server ID"
- [ ] Paste the Guild ID into the control panel input
- [ ] Click "Connect"
- [ ] Verify connection status changes to "Connected to guild"

### 3. Test Folder Browsing
- [ ] Create a test folder with sample media files:
  ```bash
  mkdir -p /tmp/test-media
  # Add some test images and videos to /tmp/test-media
  ```
- [ ] Enter the folder path in the control panel
- [ ] Click "Load Folder"
- [ ] Verify media files are displayed in the grid
- [ ] Check that thumbnails load correctly

### 4. Test File Upload
- [ ] Click on the file upload input
- [ ] Select one or more media files (images or videos)
- [ ] Verify files appear in the grid
- [ ] Check that uploaded file thumbnails display correctly

### 5. Test Media Sending
- [ ] Set up OBS with browser source pointing to:
  ```
  http://localhost:3000/client?guildId=YOUR_GUILD_ID
  ```
- [ ] Click on a media file in the control panel
- [ ] Verify success notification appears
- [ ] Check that media appears in OBS overlay
- [ ] Test with both images and videos

### 6. Test Search & Filter Feature

- [ ] Type in the search bar
- [ ] Verify files are filtered in real-time
- [ ] Test case-insensitive search (e.g., "TEST" finds "test.jpg")
- [ ] Search for partial filename matches
- [ ] Verify "No files match your search" message when no results
- [ ] Clear search and verify all files return

### 7. Test Sort Feature

- [ ] Select "Name (A-Z)" and verify alphabetical order
- [ ] Select "Name (Z-A)" and verify reverse order
- [ ] Select "Type" and verify images/videos are grouped
- [ ] Select "Newest First" and verify most recent files first
- [ ] Select "Oldest First" and verify oldest files first
- [ ] Verify sorting persists when searching

### 8. Test View Size Controls

#### Small View
- [ ] Click small icon button
- [ ] Verify grid shows 6 columns
- [ ] Verify thumbnails are smaller (100px height)
- [ ] Verify text and buttons are compact

#### Medium View (Default)
- [ ] Click medium icon button
- [ ] Verify grid shows 4 columns
- [ ] Verify thumbnails are medium (200px height)
- [ ] Verify this is the default view on load

#### Large View
- [ ] Click large icon button
- [ ] Verify grid shows 3 columns
- [ ] Verify thumbnails are larger (300px height)
- [ ] Verify smooth transition between sizes

### 9. Test File Rename Feature

#### Basic Rename
- [ ] Click the pencil icon on a media card
- [ ] Verify rename modal opens
- [ ] Verify current filename is displayed
- [ ] Verify input field shows filename with auto-selection
- [ ] Change the filename and click "Rename"
- [ ] Verify success notification appears
- [ ] Verify file grid updates with new name
- [ ] Verify the actual file on disk is renamed

#### Rename Keyboard Shortcuts
- [ ] Open rename modal
- [ ] Edit filename and press Enter
- [ ] Verify file is renamed
- [ ] Open rename modal again
- [ ] Press Escape
- [ ] Verify modal closes without renaming

#### Rename Error Cases
- [ ] Try to rename to an existing filename
- [ ] Verify error message about duplicate name
- [ ] Try to rename with empty name
- [ ] Verify appropriate error handling

### 10. Test Different File Formats

#### Images
- [ ] Test JPG file
- [ ] Test PNG file
- [ ] Test GIF file
- [ ] Test WebP file

#### Videos
- [ ] Test MP4 file
- [ ] Test WebM file
- [ ] Test MOV file (if available)
- [ ] Test AVI file (if available)

### 11. Test Error Handling

#### Invalid Folder Path
- [ ] Enter a non-existent folder path
- [ ] Verify error message appears

#### Invalid Guild ID
- [ ] Enter an invalid Guild ID
- [ ] Try to send media
- [ ] Verify appropriate error handling

#### Large File Upload
- [ ] Try uploading a file close to 100MB limit
- [ ] Verify it uploads successfully
- [ ] Try uploading a file over 100MB
- [ ] Verify error message about file size

### 12. Test Security

#### Path Traversal
- [ ] Try entering `../../../etc` as folder path
- [ ] Verify it's rejected with "Invalid folder path" error

#### Special Characters in Filename
- [ ] Upload a file with special characters (e.g., `test'file.jpg`)
- [ ] Verify it's sanitized correctly
- [ ] Verify the file can be sent to stream

### 13. Test Concurrent Usage
- [ ] Open multiple browser tabs with control panel
- [ ] Send media from different tabs
- [ ] Verify queue handles multiple requests correctly
- [ ] Rename a file in one tab
- [ ] Verify the change reflects when reloading in another tab

### 14. Test Integration with Discord Commands
- [ ] Send media via Discord `/send` command
- [ ] Send media via control panel
- [ ] Verify both work correctly
- [ ] Check that queue order is maintained

## Expected Results

### Successful Folder Load
```
Response: { files: [...] }
Notification: "Loaded X files"
Grid displays media thumbnails
```

### Successful File Upload
```
Notification: "Uploaded X file(s)"
Grid displays uploaded files
```

### Successful Media Send
```
Notification: "Sent 'filename' to stream!"
Media appears in OBS overlay within 1-2 seconds
```

### Error Cases
```
Invalid path: { error: "Invalid folder path" }
Folder not found: { error: "Folder not found" }
Missing Guild ID: { error: "guildId is required" }
```

## Manual Verification

After all automated tests pass, manually verify:

1. **UI Responsiveness**
   - Test on different screen sizes
   - Check mobile view (if applicable)

2. **Performance**
   - Load folder with many files (100+)
   - Verify reasonable load time
   - Check UI remains responsive

3. **Browser Compatibility**
   - Test in Chrome/Edge
   - Test in Firefox
   - Test in Safari (if available)

## Troubleshooting Common Issues

### Server Won't Start
- Check `.env` file has valid Discord credentials
- Ensure port 3000 is not already in use
- Run `pnpm install` to ensure dependencies are installed

### Media Not Appearing in OBS
- Verify OBS browser source URL includes correct `guildId`
- Check server logs for errors
- Ensure browser source is visible in OBS scene

### Files Not Loading from Folder
- Verify folder path is absolute
- Check file permissions
- Ensure files have supported extensions

### Upload Fails
- Check file size (must be < 100MB)
- Verify uploads directory exists and is writable
- Check server logs for detailed error

## Logs to Monitor

Watch the server logs for:
```
[CONTROL] File uploaded: <filename>
[CONTROL] Media sent to stream: <filename> (guild: <id>)
[SOCKET] New message <id> (guild: <guild_id>): <content>
```

## Clean Up After Testing

```bash
# Remove test media folder
rm -rf /tmp/test-media

# Remove uploaded files
rm -rf uploads/*

# Reset database (if needed)
rm sqlite.db*
pnpm migration:up
```

## Notes for Production

Before deploying to production:
1. Add authentication to control panel
2. Implement rate limiting
3. Set up HTTPS
4. Configure firewall rules
5. Add upload quotas per guild
6. Implement file cleanup for old uploads
7. Consider hosting Socket.IO locally instead of CDN
