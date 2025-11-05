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
        add_action('wp_ajax_alt_text_ai_bulk_process', array($this, 'ajax_process_batch'));
        add_action('wp_ajax_alt_text_ai_bulk_status', array($this, 'ajax_get_bulk_status'));
        add_action('wp_ajax_alt_text_ai_bulk_cancel', array($this, 'ajax_cancel_bulk_process'));
        // Note: Removed cron-based processing in favor of AJAX-based sequential processing
        // add_action('alt_text_ai_bulk_process_batch', array($this, 'process_batch_background'));
    }
    
    /**
     * AJAX handler for processing a batch
     */
    public function ajax_process_batch() {
        $this->debug_log('=== AJAX: Processing batch ===');
        $this->debug_log('POST data: ' . print_r($_POST, true));
        
        check_ajax_referer('alt_text_ai_nonce', 'nonce');
        
        if (!current_user_can('upload_files')) {
            $this->debug_log('ERROR: User does not have permission');
            wp_die(__('You do not have permission to perform this action.', 'alt-text-ai'));
        }
        
        // Increase execution time limit for batch processing
        if (function_exists('set_time_limit')) {
            @set_time_limit(180); // 3 minutes per batch
        }
        if (function_exists('ini_set')) {
            @ini_set('max_execution_time', '180');
        }
        
        $process_id = sanitize_text_field($_POST['process_id'] ?? '');
        $batch_offset = intval($_POST['batch_offset'] ?? 0);
        $batch_size = intval($_POST['batch_size'] ?? 10);
        
        $this->debug_log('Process ID: ' . $process_id);
        $this->debug_log('Batch Offset: ' . $batch_offset);
        $this->debug_log('Batch Size: ' . $batch_size);
        
        if (empty($process_id)) {
            $this->debug_log('ERROR: Process ID is empty');
            wp_send_json_error(__('Process ID is required.', 'alt-text-ai'));
        }
        
        $result = $this->process_batch_sync($process_id, $batch_offset, $batch_size);
        
        $this->debug_log('Batch result: ' . print_r($result, true));
        
        if ($result['success']) {
            wp_send_json_success($result);
        } else {
            wp_send_json_error($result['message'] ?? __('Failed to process batch.', 'alt-text-ai'));
        }
    }
    
    /**
     * Start bulk processing
     */
    public function ajax_start_bulk_process() {
        $this->debug_log('=== AJAX: Starting bulk process ===');
        $this->debug_log('POST data: ' . print_r($_POST, true));
        
        check_ajax_referer('alt_text_ai_nonce', 'nonce');
        
        if (!current_user_can('upload_files')) {
            $this->debug_log('ERROR: User does not have permission');
            wp_die(__('You do not have permission to perform this action.', 'alt-text-ai'));
        }
        
        // Increase execution time limit for batch processing
        if (function_exists('set_time_limit')) {
            @set_time_limit(300); // 5 minutes
        }
        if (function_exists('ini_set')) {
            @ini_set('max_execution_time', '300');
        }
        
        $batch_size = min(50, max(1, intval($_POST['batch_size'] ?? 10)));
        $overwrite_existing = (bool) ($_POST['overwrite_existing'] ?? false);
        $selected_images = array_map('intval', $_POST['selected_images'] ?? array());
        
        $this->debug_log('Batch size: ' . $batch_size);
        $this->debug_log('Overwrite existing: ' . ($overwrite_existing ? 'yes' : 'no'));
        $this->debug_log('Selected images count: ' . count($selected_images));
        
        // Get images to process
        if (!empty($selected_images)) {
            $this->debug_log('Getting selected images');
            $images_to_process = $this->get_selected_images($selected_images, $overwrite_existing);
        } else {
            $this->debug_log('Getting images without alt-text');
            $images_to_process = $this->get_images_without_alt_text($overwrite_existing);
        }
        
        $this->debug_log('Images to process count: ' . count($images_to_process));
        
        // Filter out images that already have alt text (unless overwrite is enabled)
        if (empty($overwrite_existing) && !empty($images_to_process)) {
            $filtered_images = array();
            foreach ($images_to_process as $image_id) {
                $existing_alt = get_post_meta($image_id, '_wp_attachment_image_alt', true);
                if (empty($existing_alt) || trim($existing_alt) === '') {
                    $filtered_images[] = $image_id;
                }
            }
            $images_to_process = $filtered_images;
            $this->debug_log('After filtering, images to process: ' . count($images_to_process));
        }
        
        if (empty($images_to_process)) {
            $this->debug_log('ERROR: No images to process');
            wp_send_json_error(__('No images found to process. All selected images already have alt-text.', 'alt-text-ai'));
        }
        
        // Create bulk process record
        $process_id = $this->create_bulk_process_record($images_to_process, $batch_size, $overwrite_existing);
        $this->debug_log('Created process record with ID: ' . $process_id);
        
        // Process first batch immediately (synchronously for better reliability)
        $this->debug_log('Processing first batch immediately');
        $first_batch_result = $this->process_batch_sync($process_id, 0, $batch_size);
        $this->debug_log('First batch result: ' . print_r($first_batch_result, true));
        
        wp_send_json_success(array(
            'process_id' => $process_id,
            'total_images' => count($images_to_process),
            'batch_size' => $batch_size,
            'estimated_time' => $this->estimate_processing_time(count($images_to_process)),
            'initial_batch' => $first_batch_result
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
     * Process batch synchronously (for AJAX calls)
     */
    public function process_batch_sync($process_id, $batch_offset, $batch_size = null) {
        // Enable WordPress debug logging
        if (!defined('WP_DEBUG_LOG') || !WP_DEBUG_LOG) {
            if (function_exists('error_log')) {
                error_log('Alt Text Pro: WP_DEBUG_LOG is not enabled. Enable it in wp-config.php to see debug logs.');
            }
        }
        
        $this->debug_log('=== Starting batch processing ===');
        $this->debug_log('Process ID: ' . $process_id);
        $this->debug_log('Batch Offset: ' . $batch_offset);
        $this->debug_log('Batch Size: ' . ($batch_size ?: 'default'));
        
        // Increase execution time limit for batch processing
        if (function_exists('set_time_limit')) {
            @set_time_limit(180); // 3 minutes per batch
        }
        
        $process_data = get_transient('alt_text_ai_bulk_' . $process_id);
        
        if (!$process_data) {
            $this->debug_log('ERROR: Process data not found for process_id: ' . $process_id);
            return array('success' => false, 'message' => 'Process not found');
        }
        
        if ($process_data['status'] === 'cancelled') {
            $this->debug_log('ERROR: Process was cancelled');
            return array('success' => false, 'message' => 'Process cancelled');
        }
        
        $this->debug_log('Process data found. Total images: ' . count($process_data['images']));
        $this->debug_log('Current status: ' . ($process_data['status'] ?? 'unknown'));
        
        $api_client = new AltTextAI_API_Client();
        $current_batch_size = $batch_size ?: $process_data['batch_size'];
        $images = array_slice($process_data['images'], $batch_offset, $current_batch_size);
        
        $this->debug_log('Images in this batch: ' . count($images));
        $this->debug_log('Image IDs: ' . implode(', ', $images));
        
        if (empty($images)) {
            $this->debug_log('No images to process in this batch. Completing process.');
            // No more images to process
            $this->complete_bulk_process($process_id);
            return array('success' => true, 'completed' => true);
        }
        
        $processed = 0;
        $successful = 0;
        $errors = isset($process_data['errors']) ? $process_data['errors'] : array();
        
        foreach ($images as $image_id) {
            $this->debug_log('--- Processing image ID: ' . $image_id . ' ---');
            
            // Check if process was cancelled
            $current_process = get_transient('alt_text_ai_bulk_' . $process_id);
            if (!$current_process || $current_process['status'] === 'cancelled') {
                $this->debug_log('Process cancelled during image processing');
                break;
            }
            
            // Skip if image already has alt text (unless overwrite is enabled)
            if (empty($process_data['overwrite_existing'])) {
                $existing_alt = get_post_meta($image_id, '_wp_attachment_image_alt', true);
                if (!empty($existing_alt) && trim($existing_alt) !== '') {
                    $this->debug_log('Image ' . $image_id . ' already has alt-text, skipping');
                    $processed++;
                    continue;
                }
            }
            
            $this->debug_log('Calling API to generate alt-text for image: ' . $image_id);
            $api_start_time = microtime(true);
            
            $result = $api_client->generate_alt_text($image_id);
            
            $api_end_time = microtime(true);
            $api_duration = round($api_end_time - $api_start_time, 2);
            $this->debug_log('API call completed in ' . $api_duration . ' seconds');
            $this->debug_log('API result success: ' . ($result['success'] ? 'yes' : 'no'));
            
            if ($result['success'] && !empty($result['alt_text'])) {
                if ($this->is_placeholder_alt_text($result['alt_text'])) {
                    $this->debug_log('Placeholder alt-text detected, skipping update for image ' . $image_id);
                    $errors[] = array(
                        'image_id' => $image_id,
                        'error' => __('Placeholder alt-text returned by API. Try again later.', 'alt-text-ai')
                    );
                    $processed++;
                    continue;
                }

                $this->debug_log('Successfully generated alt-text: ' . substr($result['alt_text'], 0, 50) . '...');
                
                // Update attachment alt text
                $update_result = update_post_meta($image_id, '_wp_attachment_image_alt', $result['alt_text']);
                $this->debug_log('Post meta updated: ' . ($update_result ? 'yes' : 'no'));
                
                // Log the generation
                if (!empty($result['alt_text'])) {
                    $this->log_generation($image_id, $result['alt_text'], $result['credits_used'] ?? 1);
                    $this->debug_log('Generation logged to database');
                }
                
                $processed++;
                $successful++;
                $this->debug_log('Image ' . $image_id . ' processed successfully');
            } else {
                $error_message = $result['message'] ?? 'Unknown error';
                $this->debug_log('ERROR: Failed to generate alt-text for image ' . $image_id . ': ' . $error_message);
                error_log(sprintf(
                    'Alt Text Pro Bulk: Failed to generate alt-text for image %d: %s',
                    $image_id,
                    $error_message
                ));
                $errors[] = array(
                    'image_id' => $image_id,
                    'error' => $error_message
                );
                $processed++;
            }
            
            // Update progress after each image
            $total_processed = $batch_offset + $processed;
            $this->debug_log('Updating progress: ' . $total_processed . ' / ' . count($process_data['images']));
            $this->update_bulk_process_progress($process_id, $total_processed, $errors, $successful);
        }
        
        // Check if there are more batches to process
        $next_batch_offset = $batch_offset + count($images);
        $has_more = $next_batch_offset < count($process_data['images']);
        
        $this->debug_log('Batch completed. Processed: ' . $processed . ', Successful: ' . $successful);
        $this->debug_log('Has more batches: ' . ($has_more ? 'yes' : 'no'));
        $this->debug_log('Next batch offset: ' . $next_batch_offset);
        
        if (!$has_more) {
            $this->debug_log('All batches completed. Marking process as completed.');
            // Mark process as completed
            $this->complete_bulk_process($process_id);
        }
        
        $this->debug_log('=== Batch processing completed ===');
        
        return array(
            'success' => true,
            'processed' => $processed,
            'successful' => $successful,
            'errors' => array_slice($errors, -count($images)), // Only return errors from this batch
            'total_processed' => $batch_offset + $processed,
            'has_more' => $has_more,
            'next_offset' => $next_batch_offset
        );
    }
    
    /**
     * Process batch in background (for cron/legacy support)
     * Note: This function is kept for backward compatibility but cron processing is disabled.
     * We use AJAX-based sequential processing instead.
     */
    public function process_batch_background($process_id = null, $batch_offset = 0) {
        // Handle all possible argument counts to prevent fatal errors
        $num_args = func_num_args();
        
        if ($num_args === 0) {
            $this->debug_log('ERROR: process_batch_background called with no arguments - ignoring');
            return;
        }
        
        if ($num_args === 1) {
            // If only one argument is passed, it might be the process_id
            // Try to get the batch_offset from the process data
            $process_data = get_transient('alt_text_ai_bulk_' . $process_id);
            if ($process_data && isset($process_data['processed'])) {
                $batch_offset = $process_data['processed'];
            } else {
                $batch_offset = 0;
            }
        }
        
        $this->debug_log('=== Background batch processing (legacy/disabled) ===');
        $this->debug_log('Process ID: ' . ($process_id ?? 'null'));
        $this->debug_log('Batch Offset: ' . $batch_offset);
        $this->debug_log('NOTE: Cron-based processing is disabled. Use AJAX-based processing instead.');
        
        // Don't actually process - just log and return to prevent errors
        // The actual processing happens via AJAX now
        return;
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
            $query = "SELECT p.ID 
                      FROM {$wpdb->posts} p 
                      WHERE p.post_type = 'attachment' 
                      AND p.post_mime_type LIKE 'image/%'
                      AND p.ID NOT IN (
                          SELECT DISTINCT pm.post_id 
                          FROM {$wpdb->postmeta} pm 
                          WHERE pm.meta_key = '_wp_attachment_image_alt' 
                          AND pm.meta_value IS NOT NULL 
                          AND pm.meta_value != ''
                          AND TRIM(pm.meta_value) != ''
                      )
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
            $query = "SELECT p.ID 
                      FROM {$wpdb->posts} p 
                      WHERE p.ID IN ($placeholders) 
                      AND p.post_type = 'attachment' 
                      AND p.post_mime_type LIKE 'image/%'
                      AND p.ID NOT IN (
                          SELECT DISTINCT pm.post_id 
                          FROM {$wpdb->postmeta} pm 
                          WHERE pm.meta_key = '_wp_attachment_image_alt' 
                          AND pm.meta_value IS NOT NULL 
                          AND pm.meta_value != ''
                          AND TRIM(pm.meta_value) != ''
                      )";
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
            'successful' => 0,
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
        
        // Calculate successful count
        $processed = isset($process_data['processed']) ? $process_data['processed'] : 0;
        $errors = isset($process_data['errors']) ? $process_data['errors'] : array();
        $error_count = count($errors);
        
        // Use stored successful count if available, otherwise calculate
        if (isset($process_data['successful'])) {
            $successful = $process_data['successful'];
        } else {
            $successful = max(0, $processed - $error_count);
        }
        
        return array(
            'process_id' => $process_id,
            'status' => $process_data['status'] ?? 'running',
            'total_images' => isset($process_data['images']) ? count($process_data['images']) : 0,
            'processed' => $processed,
            'successful' => $successful,
            'errors' => $errors,
            'batch_size' => $process_data['batch_size'] ?? 10,
            'started_at' => $process_data['started_at'] ?? null,
            'completed_at' => $process_data['completed_at'] ?? null,
            'last_updated' => $process_data['last_updated'] ?? null
        );
    }
    
    /**
     * Update bulk process progress
     */
    private function update_bulk_process_progress($process_id, $processed, $errors, $successful = null) {
        $process_data = get_transient('alt_text_ai_bulk_' . $process_id);
        
        if ($process_data) {
            $process_data['processed'] = $processed;
            $process_data['errors'] = $errors;
            $process_data['status'] = 'running';
            $process_data['last_updated'] = current_time('mysql');
            
            // Update successful count if provided
            if ($successful !== null) {
                $process_data['successful'] = $successful;
            } else {
                // Calculate successful count from errors
                $error_count = count($errors);
                $process_data['successful'] = max(0, $processed - $error_count);
            }
            
            // Update transient with extended expiry
            set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
            
            // Force save to ensure it's written immediately
            wp_cache_delete('alt_text_ai_bulk_' . $process_id, 'transient');
        }
    }
    
    /**
     * Complete bulk process
     */
    private function complete_bulk_process($process_id) {
        $process_data = get_transient('alt_text_ai_bulk_' . $process_id);
        
        if ($process_data) {
            $process_data['status'] = 'completed';
            $process_data['completed_at'] = current_time('mysql');
            
            set_transient('alt_text_ai_bulk_' . $process_id, $process_data, DAY_IN_SECONDS);
            
            // Send completion notification
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
        
        // Clear any scheduled cron events for this process (legacy support)
        // Note: We're using AJAX now, but clear old cron events if they exist
        if (function_exists('wp_clear_scheduled_hook')) {
            wp_clear_scheduled_hook('alt_text_ai_bulk_process_batch', array($process_id));
        }
    }
    
    /**
     * Send completion notification
     */
    private function send_completion_notification($process_data) {
        $user = get_user_by('id', $process_data['user_id']);
        
        if ($user && $user->user_email) {
            $subject = __('Alt Text Pro: Bulk Processing Complete', 'alt-text-ai');
            
            $message = sprintf(
                __("Your bulk alt-text generation process has completed.\n\nResults:\n- Total images: %d\n- Successfully processed: %d\n- Errors: %d\n\nYou can view the detailed results in your WordPress admin dashboard.", 'alt-text-ai'),
                $process_data['total_images'],
                $process_data['successful'],
                count($process_data['errors'])
            );
            
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
    
    /**
     * Debug logging helper
     * Logs to WordPress debug.log file if WP_DEBUG_LOG is enabled
     */
    private function debug_log($message) {
        if (defined('WP_DEBUG_LOG') && WP_DEBUG_LOG) {
            $timestamp = current_time('mysql');
            $log_message = sprintf('[Alt Text Pro Bulk] [%s] %s', $timestamp, $message);
            error_log($log_message);
        }
    }

    /**
     * Check if alt-text is a known placeholder
     */
    private function is_placeholder_alt_text($alt_text) {
        if (!is_string($alt_text)) {
            return false;
        }

        $normalized = strtolower(trim($alt_text));
        $normalized = preg_replace('/[^\w\s]/', '', $normalized);

        $placeholders = array(
            'image description unavailable',
            'alt text unavailable',
            'description unavailable',
            'no description available',
            'alt text not available'
        );

        foreach ($placeholders as $placeholder) {
            if ($normalized === $placeholder || strpos($normalized, $placeholder) !== false) {
                return true;
            }
        }

        return $normalized === '';
    }
}
