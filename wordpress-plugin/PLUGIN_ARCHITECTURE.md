# Alt Text Pro WordPress Plugin - Architecture Overview

## 📋 Table of Contents
1. [Plugin Overview](#plugin-overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [Key Features](#key-features)
6. [API Integration](#api-integration)
7. [Database Schema](#database-schema)
8. [Security & Best Practices](#security--best-practices)

---

## Plugin Overview

**Alt Text Pro** is a WordPress plugin that generates AI-powered alt-text for images using Google Gemini AI via a SaaS backend (Netlify Functions + Supabase).

**Version:** 1.0.1  
**WordPress Requirements:** 5.0+  
**PHP Requirements:** 7.4+  
**API Base:** `https://www.alt-text.pro/.netlify/functions`

---

## Architecture

### High-Level Architecture

```
WordPress Plugin
    ↓
API Client (class-api-client.php)
    ↓
Netlify Functions (generate-alt-text.js)
    ↓
Google Gemini AI API
    ↓
Supabase Database (credits, usage logs)
```

### Component Structure

```
alt-text-ai/
├── alt-text-ai.php              # Main plugin file (singleton pattern)
├── includes/
│   ├── class-admin.php          # Admin dashboard & menu pages
│   ├── class-api-client.php     # API communication layer
│   ├── class-settings.php       # Settings management
│   ├── class-media-handler.php  # Auto-generation on upload
│   └── class-bulk-processor.php # Bulk processing engine
├── templates/
│   ├── dashboard.php            # Main dashboard UI
│   ├── settings.php             # Settings page UI
│   ├── bulk-process.php         # Bulk processing UI
│   └── logs.php                 # Usage logs UI
└── assets/
    ├── css/admin.css            # Admin styles
    └── js/admin.js              # Frontend JavaScript
```

---

## Core Components

### 1. Main Plugin Class (`alt-text-ai.php`)

**Purpose:** Plugin initialization and orchestration

**Key Responsibilities:**
- Singleton pattern for single instance
- Loads all dependencies
- Registers WordPress hooks
- Handles activation/deactivation
- Creates database tables
- Enqueues scripts/styles
- AJAX handlers for single image generation

**Key Methods:**
- `init()` - Initialize plugin
- `load_dependencies()` - Load class files
- `enqueue_admin_scripts()` - Load CSS/JS
- `ajax_generate_alt_text()` - Single image generation
- `log_generation()` - Log to local database

**Database Table Created:**
- `wp_alt_text_ai_logs` - Local logging table

---

### 2. Admin Class (`class-admin.php`)

**Purpose:** Admin interface and menu management

**Key Responsibilities:**
- Creates admin menu structure
- Renders dashboard, settings, bulk process, logs pages
- Adds meta boxes to media edit screen
- Shows admin notices
- Handles plugin action links

**Menu Structure:**
- **Alt Text Pro** (Main menu)
  - Dashboard (`alt-text-ai`)
  - Bulk Process (`alt-text-ai-bulk`)
  - Settings (`alt-text-ai-settings`)
  - Usage & Logs (`alt-text-ai-logs`)

**Key Methods:**
- `add_admin_menu()` - Create menu structure
- `dashboard_page()` - Render dashboard
- `bulk_process_page()` - Render bulk processing page
- `settings_page()` - Render settings page
- `logs_page()` - Render logs page
- `add_media_meta_boxes()` - Add meta box to media edit screen
- `get_media_field_html()` - Generate alt-text UI for media

---

### 3. API Client (`class-api-client.php`)

**Purpose:** Communication with Netlify Functions backend

**Key Responsibilities:**
- Handles all API requests to backend
- Validates API key format
- Converts images to base64
- Validates image size (15MB limit)
- Error handling and retry logic
- Credit checking

**Key Methods:**
- `generate_alt_text($attachment_id, $context)` - Generate alt-text
- `get_usage_stats()` - Get credit/usage information
- `validate_api_key($api_key)` - Validate API key
- `test_connection()` - Test API connectivity
- `get_image_base64($attachment_id)` - Convert image to base64
- `make_request($endpoint, $method, $data)` - Core HTTP request handler

**API Endpoints Used:**
- `generate-alt-text` - POST - Generate alt-text
- `get-usage` - GET - Get usage statistics
- `auth-validate` - POST - Validate API key

**Error Handling:**
- 401: Invalid API key
- 402: No credits remaining (returns `no_credits: true` flag)
- 403: Access forbidden
- 404: Endpoint not found
- 429: Rate limit exceeded
- 500: Server error

**Image Validation:**
- File exists check
- MIME type validation (image/*)
- File size limit (15MB raw, ~20MB base64)
- Base64 encoding validation

---

### 4. Settings Class (`class-settings.php`)

**Purpose:** Settings management and validation

**Key Responsibilities:**
- Registers WordPress settings API
- Sanitizes and validates settings
- Handles settings form fields
- AJAX test connection
- Settings import/export

**Settings:**
- `api_key` - User's API key (alt_... or altai_...)
- `auto_generate` - Auto-generate on upload
- `overwrite_existing` - Overwrite existing alt-text
- `context_enabled` - Enable context-aware generation
- `batch_size` - Images per batch (1-50)

**Key Methods:**
- `register_settings()` - Register with WordPress Settings API
- `sanitize_settings($input)` - Sanitize and validate
- `ajax_test_connection()` - Test API connection via AJAX
- `validate_api_key_format($api_key)` - Format validation

---

### 5. Media Handler (`class-media-handler.php`)

**Purpose:** Automatic alt-text generation on image upload

**Key Responsibilities:**
- Hooks into `add_attachment` action
- Auto-generates alt-text if enabled
- Background processing via WordPress cron
- Context extraction from filename/posts
- Regeneration via AJAX

**Key Methods:**
- `handle_new_attachment($attachment_id)` - Trigger on upload
- `generate_alt_text_background($attachment_id)` - Background generation
- `ajax_regenerate_alt_text()` - AJAX regeneration
- `get_context_suggestions($attachment_id)` - Extract context
- `needs_alt_text($attachment_id)` - Check if image needs alt-text

**Hooks:**
- `add_attachment` - When new attachment is added
- `wp_handle_upload_prefilter` - Before upload processing
- `alt_text_ai_generate_background` - Cron event for background generation

---

### 6. Bulk Processor (`class-bulk-processor.php`)

**Purpose:** Bulk processing of multiple images

**Key Responsibilities:**
- Batch processing with configurable batch size
- Progress tracking via WordPress transients
- Duplicate prevention
- Credit checking before/during processing
- Email notifications on completion
- Race condition prevention

**Key Methods:**
- `ajax_start_bulk_process()` - Start bulk processing
- `ajax_process_batch()` - Process single batch via AJAX
- `ajax_get_bulk_status()` - Get current progress
- `ajax_cancel_bulk_process()` - Cancel processing
- `process_batch_background($process_id, $batch_offset)` - Process batch
- `get_images_without_alt_text($include_existing)` - Query images
- `get_selected_images($image_ids, $include_existing)` - Get selected images
- `complete_bulk_process($process_id, $early_stop)` - Mark as complete

**Processing Flow:**
1. User selects images or chooses "all missing alt-text"
2. SQL query filters images (LEFT JOIN to exclude existing alt-text)
3. PHP-level filtering removes duplicates and existing alt-text
4. Credit check before starting
5. Process first batch immediately (synchronous)
6. Frontend polls for status and triggers next batch
7. Each batch:
   - Checks for cancellation
   - Skips already processed images
   - Skips images with existing alt-text (unless overwrite)
   - Makes API call
   - Handles 402 (no credits) - stops immediately
   - Updates progress
   - Schedules next batch (cron backup)
8. On completion, sends email notification

**SQL Query Optimization:**
- Uses `LEFT JOIN` instead of `NOT IN` for better performance
- Filters at database level before PHP processing
- Prevents processing images with existing alt-text

**Duplicate Prevention:**
- SQL query excludes images with alt-text
- PHP-level filtering with `seen_ids` array
- Tracks `successful_image_ids` to prevent reprocessing
- Frontend `processingBatches` object prevents race conditions

**Credit Management:**
- Pre-check before starting
- Immediate stop on 402 error
- Status set to `stopped_no_credits`
- Email notification includes credit exhaustion reason

---

## Data Flow

### Single Image Generation Flow

```
1. User clicks "Generate Alt-Text" button
   ↓
2. JavaScript (admin.js) sends AJAX request
   ↓
3. Main plugin (ajax_generate_alt_text) receives request
   ↓
4. API Client (generate_alt_text) called
   ↓
5. Image converted to base64 (get_image_base64)
   ↓
6. HTTP POST to Netlify Function (generate-alt-text)
   ↓
7. Netlify Function:
   - Validates API key
   - Checks credits
   - Calls Gemini API
   - Deducts credit
   - Returns alt-text
   ↓
8. API Client receives response
   ↓
9. Main plugin:
   - Updates _wp_attachment_image_alt meta
   - Logs to local database
   ↓
10. JavaScript updates UI with result
```

### Bulk Processing Flow

```
1. User selects options and clicks "Start Processing"
   ↓
2. JavaScript sends AJAX (alt_text_ai_bulk_start)
   ↓
3. Bulk Processor:
   - Queries images (SQL + PHP filtering)
   - Checks credits
   - Creates process record (transient)
   - Processes first batch immediately
   ↓
4. Frontend polls status every 2 seconds
   ↓
5. When needs_next_batch = true:
   - Frontend calls ajax_process_batch
   - Processes next batch
   - Updates progress
   ↓
6. Repeat until all batches complete
   ↓
7. On completion:
   - Sends email notification
   - Updates final status
```

---

## Key Features

### 1. Single Image Generation
- Generate from media library
- Generate from post edit screen (meta box)
- Context input support
- Real-time credit updates
- Error handling with user-friendly messages

### 2. Bulk Processing
- Process all images missing alt-text
- Process selected images
- Process all images (with overwrite option)
- Progress tracking with percentage
- Success/error counts
- Cancel functionality
- Email notifications

### 3. Auto-Generation
- Optional automatic generation on upload
- Respects overwrite_existing setting
- Background processing via cron
- Admin notices for success/errors

### 4. Dashboard
- Credit usage display
- Plan information
- Site statistics
- Recent activity
- Quick actions

### 5. Settings
- API key configuration
- Auto-generation toggle
- Overwrite existing toggle
- Context enhancement toggle
- Batch size configuration
- Connection testing

### 6. Usage Logs
- Paginated log view
- Search functionality
- Statistics (total, today, this month)
- Link to edit images

---

## API Integration

### Backend Architecture

**Netlify Functions:**
- `generate-alt-text.js` - Main generation endpoint
- `get-usage.js` - Usage statistics
- `auth-validate.js` - API key validation

**Supabase Database:**
- `profiles` table - User credits, subscription
- `usage_logs` table - Generation history
- `users` table (auth) - User authentication

**Google Gemini AI:**
- Model: `gemini-2.0-flash`
- Image input: Base64 encoded
- Output: Plain text alt-text description
- Safety filters: Built-in content filtering

### API Request Format

**Generate Alt-Text:**
```json
POST /generate-alt-text
Headers:
  Authorization: Bearer alt_... or altai_...
  Content-Type: application/json
Body:
  {
    "image_base64": "...",
    "context": "optional context"
  }
```

**Response:**
```json
{
  "success": true,
  "alt_text": "Description here",
  "credits_remaining": 99,
  "credits_used": 1
}
```

### Credit Management

**Credit Deduction:**
- Uses Supabase RPC function `use_credit()`
- Atomic operation (deducts credit + logs usage)
- Falls back to direct update if RPC fails
- Returns updated credits_remaining

**Credit Checking:**
- Before bulk processing starts
- During bulk processing (stops on 402)
- Real-time updates in dashboard

---

## Database Schema

### WordPress Tables

**wp_alt_text_ai_logs** (Local logging)
```sql
- id (mediumint, auto_increment, primary key)
- attachment_id (bigint)
- alt_text (text)
- credits_used (int, default 1)
- processing_time (float, nullable)
- created_at (datetime, default CURRENT_TIMESTAMP)
```

**wp_postmeta** (WordPress core)
- `_wp_attachment_image_alt` - Stores alt-text
- `_alt_text_ai_context` - Stores context for regeneration

**wp_posts** (WordPress core)
- Attachment post type records

### Supabase Tables (Backend)

**profiles**
- `id` (UUID, primary key)
- `email` (text)
- `credits_remaining` (integer)
- `total_processed` (integer)
- `subscription_plan` (text)
- `updated_at` (timestamp)

**usage_logs**
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key)
- `credits_used` (integer)
- `alt_text_generated` (text)
- `image_context` (text, nullable)
- `created_at` (timestamp)

---

## Security & Best Practices

### Security Measures

1. **Nonce Verification**
   - All AJAX requests verify nonce
   - Prevents CSRF attacks

2. **Capability Checks**
   - `upload_files` for image operations
   - `manage_options` for settings

3. **Input Sanitization**
   - All user input sanitized
   - SQL prepared statements
   - Output escaped

4. **API Key Security**
   - Stored in WordPress options (encrypted by WP)
   - Never exposed in frontend
   - Masked in logs

5. **File Validation**
   - MIME type checking
   - File size limits
   - File existence validation

### Best Practices

1. **Error Handling**
   - Comprehensive error logging
   - User-friendly error messages
   - Graceful degradation

2. **Performance**
   - Efficient SQL queries (LEFT JOIN)
   - Batch processing with delays
   - Transient caching for bulk progress

3. **User Experience**
   - Real-time progress updates
   - Clear error messages
   - Loading states
   - Success confirmations

4. **Code Organization**
   - Single responsibility principle
   - Separation of concerns
   - Reusable methods
   - Consistent naming

5. **WordPress Standards**
   - Follows WordPress coding standards
   - Uses WordPress APIs
   - Proper hook usage
   - Internationalization ready

---

## Key Improvements Made

### Recent Fixes

1. **SQL Query Optimization**
   - Changed from `NOT IN` to `LEFT JOIN`
   - Better performance and reliability
   - Correctly filters images with existing alt-text

2. **Duplicate Prevention**
   - SQL-level filtering
   - PHP-level duplicate removal
   - Frontend race condition prevention
   - Successful image ID tracking

3. **Credit Management**
   - Pre-check before bulk processing
   - Immediate stop on credit exhaustion
   - Accurate credit counting
   - Real-time updates

4. **Error Handling**
   - Better Gemini API error detection
   - Safety filter detection
   - Detailed error messages
   - Comprehensive logging

5. **Email Notifications**
   - Single email per bulk process
   - Email sent flag to prevent duplicates
   - Credit exhaustion notifications

---

## Future Enhancement Opportunities

1. **Caching**
   - Cache API responses
   - Cache image metadata
   - Reduce API calls

2. **Batch Optimization**
   - Parallel batch processing
   - Smarter batch sizing
   - Retry logic improvements

3. **Analytics**
   - Usage trends
   - Success rate tracking
   - Performance metrics

4. **UI Improvements**
   - Drag-and-drop image selection
   - Preview generated alt-text
   - Bulk edit interface

5. **Integration**
   - Gutenberg block support
   - Elementor integration
   - WooCommerce product images

---

## Testing Checklist

- [x] Single image generation
- [x] Bulk processing
- [x] Credit checking
- [x] Duplicate prevention
- [x] Error handling
- [x] Email notifications
- [x] Settings persistence
- [x] API key validation
- [x] Auto-generation on upload
- [x] Media library integration

---

**Last Updated:** November 2025  
**Maintained By:** Alt Text Pro Team

