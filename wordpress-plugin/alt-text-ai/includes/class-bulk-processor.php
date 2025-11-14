<?php
/**
 * Bulk Processor for Alt-Text AI
 * 
 * Handles bulk processing of images for alt-text generation
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextAI_Bulk_Processor {
    
    /**
     * Constructor
     */
    public function __construct() {
        add_action('wp_ajax_alt_text_ai_bulk_start', array($this, 'ajax_start_bulk_process'));
        add_action('wp_ajax_alt_text_ai_bulk_status', array($this, 'ajax_get_bulk_status'));
        add_action('wp_ajax_alt_text_ai_bulk_process_batch', array($this, 'ajax_process_batch'));
        add_action('wp_ajax_alt_text_ai_bulk_cancel', array($this, 'ajax_cancel_bulk_process'));
        add_action('alt_text_ai_bulk_process_batch', array($this, 'process_batch_background'));
    }
    
    /**
     * Start bulk processing
     */
    public function ajax_start_bulk_process() {
        check_ajax_referer('alt_text_ai_nonce', 'nonce');
        
        if (!current_user_can('upload_files')) {
            wp_die(__('You do not have permission to perform this action.', 'alt-text-ai'));
        }
        
        $batch_size = min(50, max(1, intval($_POST['batch_size'] ?? 10)));
        $overwrite_existing = (bool) ($_POST['overwrite_existing'] ?? false);
        $process_type = sanitize_text_field($_POST['process_type'] ?? 'missing'); // 'missing', 'all', or 'selected'
        $selected_images = array_map('intval', $_POST['selected_images'] ?? array());
        
        // Get images to process based on process type
        if ($process_type === 'selected' && !empty($selected_images)) {
            // Process only selected images
            $images_to_process = $this->get_selected_images($selected_images, $overwrite_existing);
        } elseif ($process_type === 'all') {
            // Process all images (regardless of alt-text status)
            $images_to_process = $this->get_images_without_alt_text(true); // true = include all images
        } else {
            // Default: Process only images missing alt-text
            $images_to_process = $this->get_images_without_alt_text(false); // false = only images without alt-text
        }
        
        // Filter out duplicates and apply overwrite logic
        // Note: When process_type is 'all', we include all images and let overwrite_existing control whether to regenerate
        // When process_type is 'missing', we only process images without alt-text (overwrite_existing is ignored for filtering)
        if (!empty($images_to_process)) {
            $filtered_images = array();
            $seen_ids = array(); // Track seen image IDs to prevent duplicates
            
            foreach ($images_to_process as $image_id) {
                // Skip duplicates
                if (in_array($image_id, $seen_ids)) {
                    continue;
                }
                $seen_ids[] = $image_id;
                
                // Apply filtering based on process type and overwrite setting
                if ($process_type === 'missing') {
                    // For "missing" type: only process images without alt-text (ignore overwrite checkbox for filtering)
                    $existing_alt = get_post_meta($image_id, '_wp_attachment_image_alt', true);
                    if (!empty($existing_alt) && trim($existing_alt) !== '') {
                        continue; // Skip images that already have alt-text
                    }
                } elseif ($process_type === 'all') {
                    // For "all" type: include all images, but if overwrite is false, skip those with alt-text
                    if (empty($overwrite_existing)) {
                $existing_alt = get_post_meta($image_id, '_wp_attachment_image_alt', true);
                        if (!empty($existing_alt) && trim($existing_alt) !== '') {
                            continue; // Skip images with existing alt-text if overwrite is disabled
                        }
                    }
                    // If overwrite is enabled, include all images (they will be regenerated)
                }
                // For "selected" type: include all selected images, filtering handled by get_selected_images()
                
                    $filtered_images[] = $image_id;
            }
            $images_to_process = $filtered_images;
        }
        
        if (empty($images_to_process)) {
            wp_send_json_error(__('No images found to process. All selected images already have alt-text.', 'alt-text-ai'));
        }
        
        // Check credits before starting bulk processing
        $api_client = new AltTextAI_API_Client();
        $usage_stats = $api_client->get_usage_stats();
        
        if (!$usage_stats['success']) {
            wp_send_json_error(__('Failed to check credits. Please verify your API key.', 'alt-text-ai'));
        }
        
        $credits_remaining = isset($usage_stats['data']['credits_remaining']) ? intval($usage_stats['data']['credits_remaining']) : 0;
        
        if ($credits_remaining <= 0) {
            wp_send_json_error(__('No credits remaining. Please upgrade your plan before starting bulk processing.', 'alt-text-ai'));
        }
        
        // Warn if credits are less than images to process
        if ($credits_remaining < count($images_to_process)) {
            // Still allow, but user will run out partway through
        }
        
        // Create bulk process record
        $process_id = $this->create_bulk_process_record($images_to_process, $batch_size, $overwrite_existing);
        
        // Process first batch immediately via AJAX (synchronous processing)
        // This ensures processing starts right away without relying on cron
        $this->process_batch_sync($process_id, 0);
        
        wp_send_json_success(array(
            'process_id' => $process_id,
            'total_images' => count($images_to_process),
            'batch_size' => $batch_size,
            'estimated_time' => $this->estimate_processing_time(count($images_to_process))
        ));
    }
    
    /**
     * Get bulk process status
     */
    public function ajax_get_bulk_status() {
        check_ajax_referer('alt_text_ai_nonce', 'nonce');
        
        if (!current_user_can('upload_files')) {
            wp_die(__('You do not have permission to perform this action.', 'alt-text-ai'));
        }
        
        $process_id = sanitize_text_field($_POST['process_id']);
        $status = $this->get_bulk_process_status($process_id);
        
        if ($status) {
            wp_send_json_success($status);
        } else {
            wp_send_json_error(__('Process not found.', 'alt-text-ai'));
        }
    }
    
    /**
     * Process batch via AJAX (called by frontend polling)
     */
    public function ajax_process_batch() {
        check_ajax_referer('alt_text_ai_nonce', 'nonce');
        
        if (!current_user_can('upload_files')) {
            wp_die(__('You do not have permission to perform this action.', 'alt-text-ai'));
        }
        
        $process_id = sanitize_text_field($_POST['process_id'] ?? '');
        $batch_offset = intval($_POST['batch_offset'] ?? 0);
        
        if (empty($process_id)) {
            wp_send_json_error(__('Process ID is required.', 'alt-text-ai'));
        }
        
        // Process the batch
        $this->process_batch_sync($process_id, $batch_offset);
        
        // Get updated status
        $status = $this->get_bulk_process_status($process_id);
        
        if ($status) {
            wp_send_json_success($status);
        } else {
            wp_send_json_error(__('Process not found.', 'alt-text-ai'));
        }
    }
    
    /**
     * Cancel bulk process
     */
    public function ajax_cancel_bulk_process() {
        check_ajax_referer('alt_text_ai_nonce', 'nonce');
        
        if (!current_user_can('upload_files')) {
            wp_die(__('You do not have permission to perform this action.', 'alt-text-ai'));
        }
        
        $process_id = sanitize_text_field($_POST['process_id']);
        $this->cancel_bulk_process($process_id);
        
        wp_send_json_success(__('Bulk process cancelled.', 'alt-text-ai'));
    }
    
    /**
     * Process batch synchronously (for immediate processing)
     */
    public function process_batch_sync($process_id, $batch_offset) {
        $this->process_batch_background($process_id, $batch_offset);
    }
    
    /**
     * Process batch in background
     */
    public function process_batch_background($process_id, $batch_offset) {
        $process_data = get_transient('alt_text_ai_bulk_' . $process_id);
        
        if (!$process_data || $process_data['status'] === 'cancelled') {
            return;
        }
        
        $api_client = new AltTextAI_API_Client();
        $batch_size = $process_data['batch_size'];
        $images = array_slice($process_data['images'], $batch_offset, $batch_size);
        
        $processed = 0;
        $skipped = 0;
        $successful = 0; // Track successful generations separately
        $errors = array();
        
        // Get existing successful image IDs to prevent double-counting
        $successful_image_ids = isset($process_data['successful_image_ids']) ? $process_data['successful_image_ids'] : array();
        $new_successful_ids = array(); // Track new successes in this batch
        
        foreach ($images as $image_id) {
            // Check if process was cancelled
            $current_process = get_transient('alt_text_ai_bulk_' . $process_id);
            if (!$current_process || $current_process['status'] === 'cancelled') {
                break;
            }
            
            // Check if this image was already successfully processed (prevent double-counting and duplicate API calls)
            if (in_array($image_id, $successful_image_ids)) {
                // Already processed successfully, skip to prevent double-counting and duplicate credit deduction
                $skipped++;
                $processed++;
                continue;
            }
            
            // Skip if image already has alt text (unless overwrite is enabled)
            // This prevents API calls for images that already have alt-text, saving credits
            if (empty($process_data['overwrite_existing'])) {
                $existing_alt = get_post_meta($image_id, '_wp_attachment_image_alt', true);
                if (!empty($existing_alt) && trim($existing_alt) !== '') {
                    // Image already has alt-text, skip API call to prevent credit deduction
                    $skipped++;
                    $processed++;
                    continue;
                }
            }
            
            $result = $api_client->generate_alt_text($image_id);
            
            // Check if credits ran out (402 error)
            if (isset($result['no_credits']) && $result['no_credits'] === true) {
                // Credits exhausted - stop processing immediately
                $error_message = $result['message'] ?? __('No credits remaining. Processing stopped.', 'alt-text-ai');
                error_log(sprintf(
                    'Alt Text Pro Bulk: Credits exhausted. Stopping processing at image %d. Processed: %d, Successful: %d',
                    $image_id,
                    $processed,
                    $successful
                ));
                $errors[] = array(
                    'image_id' => $image_id,
                    'error' => $error_message
                );
                $processed++;
                
                // Mark process as stopped due to credits - MUST be set before updating progress
                $process_data['status'] = 'stopped_no_credits';
                $process_data['stopped_reason'] = sprintf(
                    __('Credits exhausted after processing %d images. %d images successfully processed. Please upgrade your plan or wait for next month\'s credit refill.', 'alt-text-ai'),
                    $processed,
                    $successful
                );
                
                // Update progress immediately with stopped status
                $total_processed = $batch_offset + $processed;
                $all_successful_ids = array_unique(array_merge($successful_image_ids, $new_successful_ids));
                $total_successful = count($all_successful_ids);
                $existing_errors = isset($process_data['errors']) ? $process_data['errors'] : array();
                $all_errors = array_merge($existing_errors, $errors);
                
                $process_data['processed'] = $total_processed;
                $process_data['successful'] = $total_successful;
                $process_data['successful_image_ids'] = $all_successful_ids;
                $process_data['errors'] = $all_errors;
                $process_data['needs_next_batch'] = false; // CRITICAL: Prevent any further batches
                $process_data['last_updated'] = current_time('mysql');
                
                // Save immediately
                set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
                wp_cache_delete('alt_text_ai_bulk_' . $process_id, 'transient');
                
                // Update progress
                $this->update_bulk_process_progress($process_id, $total_processed, $all_errors, $total_successful);
                
                // Complete process immediately
                $this->complete_bulk_process($process_id, true);
                
                // Return immediately - do not process any more images
                return;
            }
            
            if ($result['success'] && !empty($result['alt_text'])) {
                // Update attachment alt text
                update_post_meta($image_id, '_wp_attachment_image_alt', $result['alt_text']);
                
                // Log the generation (only if alt_text exists)
                if (!empty($result['alt_text'])) {
                    $this->log_generation($image_id, $result['alt_text'], $result['credits_used'] ?? 1);
                }
                
                $processed++;
                $successful++; // Only count as successful when alt-text is actually generated
                $new_successful_ids[] = $image_id; // Track this image as successfully processed in this batch
                
                error_log(sprintf(
                    'Alt Text Pro Bulk: Successfully processed image %d. Batch successful: %d, Total successful IDs in batch: %d',
                    $image_id,
                    $successful,
                    count($new_successful_ids)
                ));
            } else {
                $error_message = $result['message'] ?? 'Unknown error';
                error_log(sprintf(
                    'Alt Text Pro Bulk: Failed to generate alt-text for image %d: %s',
                    $image_id,
                    $error_message
                ));
                $errors[] = array(
                    'image_id' => $image_id,
                    'error' => $error_message
                );
                // Still count as processed even if failed, but NOT as successful
                $processed++;
            }
            
            // Small delay to prevent overwhelming the API
            usleep(500000); // 0.5 seconds
        }
        
        // Update progress after batch completes
        $total_processed = $batch_offset + $processed;
        // Merge successful image IDs (remove duplicates)
        $all_successful_ids = array_unique(array_merge($successful_image_ids, $new_successful_ids));
        $total_successful = count($all_successful_ids); // Count unique successful images
        
        // Debug logging to track successful count
        error_log(sprintf(
            'Alt Text Pro Bulk: Batch complete. Batch offset: %d, Processed in batch: %d, Successful in batch: %d, Previous successful IDs: %d, New successful IDs: %d, Total successful: %d',
            $batch_offset,
            $processed,
            $successful,
            count($successful_image_ids),
            count($new_successful_ids),
            $total_successful
        ));
        
        // Merge errors with existing errors from previous batches
        $existing_errors = isset($process_data['errors']) ? $process_data['errors'] : array();
        $all_errors = array_merge($existing_errors, $errors);
        
        // Update process data with current progress BEFORE calling update_bulk_process_progress
        // This ensures we have the latest data when updating
        $process_data['processed'] = $total_processed;
        $process_data['successful'] = $total_successful; // Store successful count (unique images)
        $process_data['successful_image_ids'] = $all_successful_ids; // Store successful image IDs
        $process_data['errors'] = $all_errors; // Store merged errors
        $process_data['last_updated'] = current_time('mysql');
        
        // Save process data immediately to ensure it's persisted
        set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
        wp_cache_delete('alt_text_ai_bulk_' . $process_id, 'transient');
        
        // Now update progress (this will also save, but we've already saved above)
        $this->update_bulk_process_progress($process_id, $total_processed, $all_errors, $total_successful);
        
        // Check if processing was stopped due to credits (should not happen here as we return early, but safety check)
        if (isset($process_data['status']) && $process_data['status'] === 'stopped_no_credits') {
            // Complete process early due to credits exhaustion
            $this->complete_bulk_process($process_id, true);
            $process_data['needs_next_batch'] = false;
            set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS);
            return;
        }
        
        // Set status to running if not already set
        if (!isset($process_data['status']) || $process_data['status'] !== 'stopped_no_credits') {
            $process_data['status'] = 'running';
        }
        
        // Check if there are more batches to process
        // IMPORTANT: Only continue if status is still 'running' (not stopped)
        $next_batch_offset = $batch_offset + count($images);
        if ($next_batch_offset < count($process_data['images']) && $process_data['status'] === 'running') {
            // Set flag that frontend should request next batch
            $process_data['next_batch_offset'] = $next_batch_offset;
            $process_data['needs_next_batch'] = true;
            
            // Schedule next batch via cron (as backup)
            wp_schedule_single_event(time() + 2, 'alt_text_ai_bulk_process_batch', array($process_id, $next_batch_offset));
            
            // Try to trigger cron immediately
            if (function_exists('spawn_cron')) {
                spawn_cron();
            }
            
            set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
        } else {
            // Mark process as completed
            $this->complete_bulk_process($process_id);
            $process_data['needs_next_batch'] = false;
        }
        
        // Save updated process data
        set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
        wp_cache_delete('alt_text_ai_bulk_' . $process_id, 'transient');
    }
    
    /**
     * Get images without alt text
     */
    private function get_images_without_alt_text($include_existing = false) {
        global $wpdb;
        
        if ($include_existing) {
            // Include all images regardless of alt text
            $query = "SELECT p.ID 
                      FROM {$wpdb->posts} p 
                      WHERE p.post_type = 'attachment' 
                      AND p.post_mime_type LIKE 'image/%'
                      ORDER BY p.post_date DESC
                      LIMIT 1000";
        } else {
            // Only get images without alt text (using a more reliable query)
            // Use LEFT JOIN for better performance and to ensure we only get images without alt-text
            $query = "SELECT p.ID 
                      FROM {$wpdb->posts} p 
                      LEFT JOIN {$wpdb->postmeta} pm ON (
                          p.ID = pm.post_id 
                          AND pm.meta_key = '_wp_attachment_image_alt'
                          AND pm.meta_value IS NOT NULL 
                          AND pm.meta_value != ''
                          AND TRIM(pm.meta_value) != ''
                      )
                      WHERE p.post_type = 'attachment' 
                      AND p.post_mime_type LIKE 'image/%'
                      AND pm.post_id IS NULL
                      ORDER BY p.post_date DESC
                      LIMIT 1000";
        }
        
        return $wpdb->get_col($query);
    }
    
    /**
     * Get selected images
     */
    private function get_selected_images($image_ids, $include_existing = false) {
        global $wpdb;
        
        if (empty($image_ids)) {
            return array();
        }
        
        $placeholders = implode(',', array_fill(0, count($image_ids), '%d'));
        
        if ($include_existing) {
            // Include all selected images regardless of alt text
            $query = "SELECT p.ID 
                      FROM {$wpdb->posts} p 
                      WHERE p.ID IN ($placeholders) 
                      AND p.post_type = 'attachment' 
                      AND p.post_mime_type LIKE 'image/%'";
        } else {
            // Only get selected images without alt text
            // Use LEFT JOIN for better performance and to ensure we only get images without alt-text
            $query = "SELECT p.ID 
                      FROM {$wpdb->posts} p 
                      LEFT JOIN {$wpdb->postmeta} pm ON (
                          p.ID = pm.post_id 
                          AND pm.meta_key = '_wp_attachment_image_alt'
                          AND pm.meta_value IS NOT NULL 
                          AND pm.meta_value != ''
                          AND TRIM(pm.meta_value) != ''
                      )
                      WHERE p.ID IN ($placeholders) 
                      AND p.post_type = 'attachment' 
                      AND p.post_mime_type LIKE 'image/%'
                      AND pm.post_id IS NULL";
        }
        
        return $wpdb->get_col($wpdb->prepare($query, ...$image_ids));
    }
    
    /**
     * Create bulk process record
     */
    private function create_bulk_process_record($images, $batch_size, $overwrite_existing) {
        $process_id = uniqid('bulk_', true);
        
        $process_data = array(
            'id' => $process_id,
            'images' => $images,
            'batch_size' => $batch_size,
            'overwrite_existing' => $overwrite_existing,
            'status' => 'running',
            'total_images' => count($images),
            'processed' => 0,
            'successful' => 0, // Track successful generations separately
            'successful_image_ids' => array(), // Track which images were successfully processed to prevent double-counting
            'errors' => array(),
            'started_at' => current_time('mysql'),
            'user_id' => get_current_user_id()
        );
        
        // Store process data (expires in 24 hours)
        set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS);
        
        return $process_id;
    }
    
    /**
     * Get bulk process status
     */
    private function get_bulk_process_status($process_id) {
        $process_data = get_transient('alt_text_ai_bulk_' . $process_id);
        
        if (!$process_data) {
            return null;
        }
        
        // Get successful count from stored data (properly tracked during processing)
        $processed = isset($process_data['processed']) ? $process_data['processed'] : 0;
        $errors = isset($process_data['errors']) ? $process_data['errors'] : array();
        $error_count = count($errors);
        
        // Prioritize stored successful count, but also verify against successful_image_ids
        if (isset($process_data['successful'])) {
            $successful = intval($process_data['successful']);
        } elseif (isset($process_data['successful_image_ids']) && is_array($process_data['successful_image_ids'])) {
            // Fallback: count the successful image IDs array
            $successful = count($process_data['successful_image_ids']);
        } else {
            // Last resort: calculate from processed minus errors
        $successful = max(0, $processed - $error_count);
        }
        
        // Ensure successful count matches the actual successful_image_ids count
        if (isset($process_data['successful_image_ids']) && is_array($process_data['successful_image_ids'])) {
            $actual_successful_count = count($process_data['successful_image_ids']);
            if ($actual_successful_count !== $successful) {
                // Fix the discrepancy - use the actual count from the array
                $successful = $actual_successful_count;
                // Update the stored value for consistency
                $process_data['successful'] = $successful;
                set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
            }
        }
        
        // Include stopped_reason if process was stopped due to credits
        $status_data = array(
            'process_id' => $process_id,
            'status' => $process_data['status'] ?? 'running',
            'total_images' => isset($process_data['images']) ? count($process_data['images']) : 0,
            'processed' => $processed,
            'successful' => $successful,
            'errors' => $errors,
            'batch_size' => $process_data['batch_size'] ?? 10,
            'started_at' => $process_data['started_at'] ?? null,
            'completed_at' => $process_data['completed_at'] ?? null,
            'needs_next_batch' => isset($process_data['needs_next_batch']) ? $process_data['needs_next_batch'] : false,
            'next_batch_offset' => isset($process_data['next_batch_offset']) ? $process_data['next_batch_offset'] : null
        );
        
        // Add stopped_reason if process was stopped due to credits
        if (isset($process_data['status']) && $process_data['status'] === 'stopped_no_credits') {
            $status_data['stopped_reason'] = $process_data['stopped_reason'] ?? __('Credits exhausted. Please upgrade your plan or wait for next month\'s credit refill.', 'alt-text-ai');
        }
        
        return $status_data;
    }
    
    /**
     * Update bulk process progress
     */
    private function update_bulk_process_progress($process_id, $processed, $errors, $successful = null) {
        $process_data = get_transient('alt_text_ai_bulk_' . $process_id);
        
        if ($process_data) {
            $process_data['processed'] = $processed;
            $process_data['errors'] = $errors;
            if ($successful !== null) {
                $process_data['successful'] = $successful;
            }
            $process_data['status'] = 'running';
            $process_data['last_updated'] = current_time('mysql');
            
            // Update transient with extended expiry
            set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
            
            // Force save to ensure it's written immediately
            wp_cache_delete('alt_text_ai_bulk_' . $process_id, 'transient');
        }
    }
    
    /**
     * Complete bulk process
     */
    private function complete_bulk_process($process_id, $early_stop = false) {
        $process_data = get_transient('alt_text_ai_bulk_' . $process_id);
        
        if ($process_data) {
            // Check if email was already sent to prevent duplicates
            if (isset($process_data['email_sent']) && $process_data['email_sent'] === true) {
                error_log('Alt Text Pro Bulk: Email already sent for process ' . $process_id . ', skipping duplicate.');
                return;
            }
            
            if ($early_stop && isset($process_data['status']) && $process_data['status'] === 'stopped_no_credits') {
                $process_data['status'] = 'stopped_no_credits';
            } else {
            $process_data['status'] = 'completed';
            }
            
            $process_data['completed_at'] = current_time('mysql');
            $process_data['email_sent'] = true; // Mark email as sent to prevent duplicates
            
            set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS);
            
            // Send completion notification (only once)
            $this->send_completion_notification($process_data);
        }
    }
    
    /**
     * Cancel bulk process
     */
    private function cancel_bulk_process($process_id) {
        $process_data = get_transient('alt_text_ai_bulk_' . $process_id);
        
        if ($process_data) {
            $process_data['status'] = 'cancelled';
            $process_data['cancelled_at'] = current_time('mysql');
            
            set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS);
        }
        
        // Clear any scheduled events for this process
        wp_clear_scheduled_hook('alt_text_ai_bulk_process_batch', array($process_id));
    }
    
    /**
     * Send completion notification
     */
    private function send_completion_notification($process_data) {
        $user = get_user_by('id', $process_data['user_id']);
        
        if ($user && $user->user_email) {
            // Check if processing stopped due to credits
            $stopped_reason = isset($process_data['stopped_reason']) ? $process_data['stopped_reason'] : '';
            $is_stopped = isset($process_data['status']) && $process_data['status'] === 'stopped_no_credits';
            
            if ($is_stopped) {
                $subject = __('Alt Text Pro: Bulk Processing Stopped - No Credits', 'alt-text-ai');
                $message = sprintf(
                    __("Your bulk alt-text generation process has stopped due to insufficient credits.\n\nResults:\n- Total images: %d\n- Processed: %d\n- Successfully processed: %d\n- Errors: %d\n\nReason: %s\n\nPlease upgrade your plan to continue processing remaining images.\n\nYou can view the detailed results in your WordPress admin dashboard.", 'alt-text-ai'),
                    $process_data['total_images'],
                    $process_data['processed'] ?? 0,
                    $process_data['successful'] ?? 0,
                    count($process_data['errors'] ?? array()),
                    $stopped_reason ?: __('No credits remaining', 'alt-text-ai')
                );
            } else {
                $subject = __('Alt Text Pro: Bulk Processing Complete', 'alt-text-ai');
            $message = sprintf(
                __("Your bulk alt-text generation process has completed.\n\nResults:\n- Total images: %d\n- Successfully processed: %d\n- Errors: %d\n\nYou can view the detailed results in your WordPress admin dashboard.", 'alt-text-ai'),
                $process_data['total_images'],
                    $process_data['successful'] ?? 0,
                    count($process_data['errors'] ?? array())
            );
            }
            
            wp_mail($user->user_email, $subject, $message);
        }
    }
    
    /**
     * Estimate processing time
     */
    private function estimate_processing_time($image_count) {
        // Estimate 3 seconds per image (including API call and processing)
        $estimated_seconds = $image_count * 3;
        
        if ($estimated_seconds < 60) {
            return sprintf(__('%d seconds', 'alt-text-ai'), $estimated_seconds);
        } elseif ($estimated_seconds < 3600) {
            return sprintf(__('%d minutes', 'alt-text-ai'), ceil($estimated_seconds / 60));
        } else {
            return sprintf(__('%d hours', 'alt-text-ai'), ceil($estimated_seconds / 3600));
        }
    }
    
    /**
     * Log alt-text generation
     */
    private function log_generation($attachment_id, $alt_text, $credits_used = 1) {
        global $wpdb;
        
        // Don't log if alt_text is empty
        if (empty($alt_text)) {
            error_log('Alt Text Pro Bulk: Skipping log entry - alt_text is empty for attachment ' . $attachment_id);
            return;
        }
        
        $table_name = $wpdb->prefix . 'alt_text_ai_logs';
        
        $wpdb->insert(
            $table_name,
            array(
                'attachment_id' => $attachment_id,
                'alt_text' => $alt_text,
                'credits_used' => $credits_used,
                'created_at' => current_time('mysql')
            ),
            array('%d', '%s', '%d', '%s')
        );
        
        if ($wpdb->last_error) {
            error_log('Alt Text Pro Bulk: Database error logging generation: ' . $wpdb->last_error);
        }
    }
    
    /**
     * Get bulk processing history
     */
    public function get_processing_history($limit = 10) {
        $history = array();
        $transients = wp_cache_get('alt_text_ai_bulk_history');
        
        if (!$transients) {
            // This is a simplified version - in production you might want to store this in the database
            $transients = array();
        }
        
        return array_slice($transients, 0, $limit);
    }
}
