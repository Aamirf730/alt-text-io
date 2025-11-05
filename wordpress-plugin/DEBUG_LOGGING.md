# Debug Logging Guide for Alt Text Pro Plugin

## Enabling WordPress Debug Logging

To enable debug logging for the bulk processing feature, you need to add these lines to your WordPress `wp-config.php` file:

```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

**Important:** 
- Set `WP_DEBUG_DISPLAY` to `false` to prevent errors from showing on your site
- After debugging, set `WP_DEBUG` back to `false` for security

## Finding the Debug Log File

The debug log file is located at:
```
/wp-content/debug.log
```

## What Gets Logged

The plugin will log detailed information about:

1. **AJAX Request Start** - When bulk processing starts
2. **Process Creation** - Process ID, batch size, images to process
3. **Batch Processing** - Each image being processed
4. **API Calls** - API request timing and results
5. **Progress Updates** - Progress tracking after each image
6. **Errors** - Any errors encountered during processing
7. **Completion** - When processing completes

## Example Log Entries

```
[Alt Text Pro Bulk] [2024-11-05 20:15:30] === AJAX: Starting bulk process ===
[Alt Text Pro Bulk] [2024-11-05 20:15:30] Batch size: 10
[Alt Text Pro Bulk] [2024-11-05 20:15:30] Images to process count: 9
[Alt Text Pro Bulk] [2024-11-05 20:15:30] Created process record with ID: bulk_1234567890
[Alt Text Pro Bulk] [2024-11-05 20:15:30] === Starting batch processing ===
[Alt Text Pro Bulk] [2024-11-05 20:15:30] Process ID: bulk_1234567890
[Alt Text Pro Bulk] [2024-11-05 20:15:30] Batch Offset: 0
[Alt Text Pro Bulk] [2024-11-05 20:15:30] Images in this batch: 10
[Alt Text Pro Bulk] [2024-11-05 20:15:30] --- Processing image ID: 123 ---
[Alt Text Pro Bulk] [2024-11-05 20:15:30] Calling API to generate alt-text for image: 123
[Alt Text Pro Bulk] [2024-11-05 20:15:32] API call completed in 2.1 seconds
[Alt Text Pro Bulk] [2024-11-05 20:15:32] API result success: yes
[Alt Text Pro Bulk] [2024-11-05 20:15:32] Image 123 processed successfully
```

## Troubleshooting

### If logs are not appearing:

1. Check that `WP_DEBUG_LOG` is set to `true` in `wp-config.php`
2. Check file permissions on `wp-content/debug.log` (should be writable)
3. Check your server's PHP error log location
4. Look for logs in your hosting control panel's error log section

### Common Issues to Look For:

- **"Process data not found"** - The transient expired or wasn't saved
- **"API call timeout"** - The API request is taking too long
- **"Process cancelled"** - User cancelled the process
- **"No images to process"** - All images already have alt-text

## Browser Console Logs

The plugin also logs to the browser console. Open your browser's Developer Tools (F12) and check the Console tab for:

- Batch processing responses
- Status check responses
- Error messages
- Processing progress

## Next Steps

1. Enable debug logging in `wp-config.php`
2. Run bulk processing
3. Check `/wp-content/debug.log` for detailed logs
4. Share the relevant log entries if you need help troubleshooting

