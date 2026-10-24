---
name: Context Awareness Feature
overview: Add blog context setting and toggleable per-image context field to enhance AI-generated alt text with location awareness and user-provided context.
todos:
  - id: update_settings_class
    content: "Update class-settings.php: Add blog_context and show_context_field settings with sanitization and field callbacks"
    status: pending
  - id: update_settings_template
    content: "Update settings.php template: Add Context Settings card with blog context textarea and show context field checkbox"
    status: pending
  - id: update_admin_class
    content: "Update class-admin.php: Make context field visibility conditional based on show_context_field setting"
    status: pending
  - id: update_api_client
    content: "Update class-api-client.php: Modify generate_alt_text() to accept and combine blog context with individual context"
    status: pending
  - id: update_main_plugin
    content: "Update alt-text-pro.php: Pass blog context from settings to API client in ajax_generate_alt_text()"
    status: pending
  - id: update_media_handler
    content: "Update class-media-handler.php: Include blog context when generating alt text on upload"
    status: pending
  - id: update_bulk_processor
    content: "Update class-bulk-processor.php: Include blog context in bulk processing operations"
    status: pending
  - id: test_functionality
    content: "Test all scenarios: settings save, context field toggle, individual generation, bulk processing, auto-generation"
    status: pending
---

# Context Awareness

Feature Implementation Plan

## Overview

Enhance the Alt Text Pro plugin to support context-aware alt text generation by:

1. Adding a "Blog Context" setting for general blog theme/description
2. Adding a toggle to show/hide the context input field on media edit pages
3. Combining blog context + individual image context when generating alt text

4. The backend AI will automatically detect locations when present in images

## Implementation Details

### 1. Settings Updates

**File: `wordpress-plugin/alt-text-pro/includes/class-settings.php`**

- Add new settings fields:

- `blog_context` (textarea): General description of the blog (e.g., "travel blog about New Zealand")
- `show_context_field` (checkbox): Toggle to show/hide context input field on media edit pages

- Update `get_default_settings()` to include:
  ```php
    'blog_context' => '',
    'show_context_field' => false
  ```

- Add sanitization for `blog_context` (textarea, max length ~500 chars)

- Add settings field callbacks:
- `blog_context_field_callback()`: Textarea for blog description

- `show_context_field_callback()`: Checkbox to toggle context field visibility

**File: `wordpress-plugin/alt-text-pro/templates/settings.php`**

- Add new settings card section "Context Settings" with:

- Blog Context textarea field with description: "Provide general context about your blog to help AI generate more relevant alt text (e.g., 'travel blog about New Zealand', 'food blog focusing on Italian cuisine')"

- Show Context Field checkbox with description: "When enabled, displays a context input field on individual image edit pages where you can add specific context for each image"

### 2. Media Field Updates

**File: `wordpress-plugin/alt-text-pro/includes/class-admin.php`**

- Update `get_media_field_html()` method:
- Remove `display: none !important` from context field div
- Add conditional display based on `show_context_field` setting:
    ```php
        $show_context_field = isset($settings['show_context_field']) && $settings['show_context_field'];
    ```


- Show context field only when `show_context_field` is enabled
- Update placeholder text to be more helpful: "e.g., product photo, team meeting, landmark location, etc."

### 3. API Client Updates

**File: `wordpress-plugin/alt-text-pro/includes/class-api-client.php`**

- Update `generate_alt_text()` method signature to accept optional blog context:
  ```php
    public function generate_alt_text($attachment_id, $context = '', $blog_context = '')
  ```


- Combine contexts before sending to API:
  ```php
    $combined_context = trim($blog_context . ($blog_context && $context ? ' | ' : '') . $context);
  ```


- Update request data to use combined context:

  ```php
    $request_data = array(
        'image_base64' => $image_data,
        'context' => $combined_context
    );
  ```



### 4. Main Plugin Class Updates

**File: `wordpress-plugin/alt-text-pro/alt-text-pro.php`**

- Update `ajax_generate_alt_text()` method:
- Get blog context from settings
- Pass both individual context and blog context to API client:
    ```php
        $settings = get_option('alt_text_pro_settings', array());
        $blog_context = isset($settings['blog_context']) ? $settings['blog_context'] : '';
        $result = $api_client->generate_alt_text($attachment_id, $context, $blog_context);
    ```




### 5. Media Handler Updates

**File: `wordpress-plugin/alt-text-pro/includes/class-media-handler.php`**

- Update `generate_alt_text_background()` method:
- Get blog context from settings
- Pass blog context to API client:
    ```php
        $settings = get_option('alt_text_pro_settings', array());
        $blog_context = isset($settings['blog_context']) ? $settings['blog_context'] : '';
        $result = $api_client->generate_alt_text($attachment_id, $context, $blog_context);
    ```




### 6. Bulk Processor Updates

**File: `wordpress-plugin/alt-text-pro/includes/class-bulk-processor.php`**

- Update `process_batch_background()` method:
- Get blog context from settings once per batch (not per image for efficiency)
- Pass blog context to API client when generating alt text:
    ```php
        $settings = get_option('alt_text_pro_settings', array());
        $blog_context = isset($settings['blog_context']) ? $settings['blog_context'] : '';
        $result = $api_client->generate_alt_text($image_id, '', $blog_context);
    ```


- Note: Bulk processing doesn't use individual image context (only blog context)

### 7. JavaScript Updates

**File: `wordpress-plugin/alt-text-pro/assets/js/admin.js`**

- Update `generateAltText()` function:

- Ensure context field value is properly captured when visible

- The existing code already handles context extraction, just needs to work with the now-visible field

### 8. CSS Updates (if needed)

**File: `wordpress-plugin/alt-text-pro/assets/css/admin.css`**

- Ensure context field styling is appropriate when visible

- Add any necessary styling for the blog context textarea in settings

## Data Flow

```javascript
User provides blog context in Settings
    ↓
Settings saved to WordPress options
    ↓
When generating alt text:
    ↓
Get blog context from settings
Get individual image context (if context field enabled and filled)
    ↓
Combine contexts: "Blog Context | Image Context"
    ↓
Send to API with combined context
    ↓
Backend AI uses context + image analysis
    ↓
Returns alt text (may include location if detected)
```



## Testing Checklist

- [ ] Blog context setting saves correctly
- [ ] Context field toggle works (shows/hides on media edit pages)

- [ ] Context field is visible when enabled, hidden when disabled
- [ ] Individual image context is captured when field is visible

- [ ] Blog context is sent to API when generating alt text
- [ ] Combined context (blog + individual) works correctly
- [ ] Bulk processing includes blog context

- [ ] Auto-generation on upload includes blog context
- [ ] Settings validation works (max length, sanitization)
- [ ] Context field placeholder text is helpful

## Notes

- Location detection is handled automatically by the backend AI - no plugin-side detection needed
- Location will only appear in alt text when the AI detects it in the image

- Blog context helps the AI understand the overall theme for better relevance
- Individual image context allows per-image customization