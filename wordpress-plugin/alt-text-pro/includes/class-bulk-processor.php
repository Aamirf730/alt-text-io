<?php
/**
 * Bulk Processor for Alt-Text AI
 * 
 * Handles bulk processing of images for alt-text generation
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextPro_Bulk_Processor
{

    /**
     * Constructor
     */
    public function __construct()
    {
        add_action('wp_ajax_alt_text_pro_bulk_start', array($this, 'ajax_start_bulk_process'));
        add_action('wp_ajax_alt_text_pro_bulk_status', array($this, 'ajax_get_bulk_status'));
        add_action('wp_ajax_alt_text_pro_bulk_process_batch', array($this, 'ajax_process_batch'));
        add_action('wp_ajax_alt_text_pro_bulk_cancel', array($this, 'ajax_cancel_bulk_process'));
    }

    /**
     * Start bulk processing
     */
    public function ajax_start_bulk_process()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        $batch_size = min(50, max(1, intval($_POST['batch_size'] ?? 2)));
        $overwrite_existing = isset($_POST['overwrite_existing']) ? (bool) sanitize_text_field(wp_unslash($_POST['overwrite_existing'])) : false;
        $process_type = isset($_POST['process_type']) ? sanitize_text_field(wp_unslash($_POST['process_type'])) : 'missing'; // 'missing', 'all', or 'selected'
        $selected_images = isset($_POST['selected_images']) ? array_map('intval', (array) $_POST['selected_images']) : array();

        // Get images to process based on process type
        if ($process_type === 'selected' && !empty($selected_images)) {
            // Process only selected images. For selected images, we always include them regardless of alt-text
            // unless user explicitly wants to filter them (not currently exposed in UI for selected)
            $images_to_process = $this->get_selected_images($selected_images, true);
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
            $msg = esc_html__('No images found to process.', 'alt-text-pro');
            if ($process_type === 'missing') {
                $msg = esc_html__('All images already have alt-text.', 'alt-text-pro');
            } elseif ($process_type === 'selected') {
                $msg = esc_html__('The selected images already have alt-text or are not valid attachments.', 'alt-text-pro');
            }
            wp_send_json_error($msg);
        }

        // Check credits before starting bulk processing
        $api_client = new AltTextPro_API_Client();
        $usage_stats = $api_client->get_usage_stats();

        if (!$usage_stats['success']) {
            wp_send_json_error(esc_html__('Failed to check credits. Please verify your API key.', 'alt-text-pro'));
        }

        $credits_remaining = isset($usage_stats['data']['credits_remaining']) ? intval($usage_stats['data']['credits_remaining']) : 0;

        if ($credits_remaining <= 0) {
            wp_send_json_error(esc_html__('No credits remaining. Please upgrade your plan before starting bulk processing.', 'alt-text-pro'));
        }

        // Warn if credits are less than images to process
        if ($credits_remaining < count($images_to_process)) {
            // Still allow, but user will run out partway through
        }

        // Create bulk process record
        $process_id = $this->create_bulk_process_record($images_to_process, $batch_size, $overwrite_existing);

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
    public function ajax_get_bulk_status()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        $process_id = isset($_POST['process_id']) ? sanitize_text_field(wp_unslash($_POST['process_id'])) : '';
        $status = $this->get_bulk_process_status($process_id);

        if ($status) {
            wp_send_json_success($status);
        } else {
            wp_send_json_error(esc_html__('Process not found.', 'alt-text-pro'));
        }
    }

    /**
     * Process batch via AJAX (called by frontend polling)
     */
    public function ajax_process_batch()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        $process_id = isset($_POST['process_id']) ? sanitize_text_field(wp_unslash($_POST['process_id'])) : '';
        $batch_offset = isset($_POST['batch_offset']) ? intval($_POST['batch_offset']) : 0;

        if (empty($process_id)) {
            wp_send_json_error(esc_html__('Process ID is required.', 'alt-text-pro'));
        }

        // Process batch
        $batch_results = $this->process_batch_sync($process_id, $batch_offset);

        // Get updated status
        $status = $this->get_bulk_process_status($process_id);

        if ($status) {
            $status['batch_results'] = $batch_results;
            wp_send_json_success($status);
        } else {
            wp_send_json_error(esc_html__('Process not found.', 'alt-text-pro'));
        }
    }

    /**
     * Cancel bulk process
     */
    public function ajax_cancel_bulk_process()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        $process_id = isset($_POST['process_id']) ? sanitize_text_field(wp_unslash($_POST['process_id'])) : '';
        $this->cancel_bulk_process($process_id);

        // Get updated data to return for summary
        $process_data = get_transient('alt_text_pro_bulk_' . $process_id);

        wp_send_json_success($process_data);
    }

    /**
     * Process batch synchronously (for immediate processing)
     */
    public function process_batch_sync($process_id, $batch_offset)
    {
        return $this->process_batch_background($process_id, $batch_offset);
    }

    /**
     * Process batch in background
     */
    public function process_batch_background($process_id, $batch_offset)
    {
        $process_data = get_transient('alt_text_pro_bulk_' . $process_id);

        if (!$process_data || $process_data['status'] === 'cancelled') {
            return;
        }

        $api_client = new AltTextPro_API_Client();
        $batch_size = $process_data['batch_size'];
        $images = array_slice($process_data['images'], $batch_offset, $batch_size);

        $processed = 0;
        $skipped = 0;
        $successful = 0; // Track successful generations separately
        $errors = array();
        $batch_results = array();

        // Get existing successful image IDs to prevent double-counting
        $successful_image_ids = isset($process_data['successful_image_ids']) ? $process_data['successful_image_ids'] : array();
        $new_successful_ids = array(); // Track new successes in this batch

        foreach ($images as $image_id) {
            // Check if process was cancelled - MUST clear cache to get fresh value!
            // Without this, cached transient might not reflect cancel request
            wp_cache_delete('alt_text_pro_bulk_' . $process_id, 'transient');
            wp_cache_delete('_transient_alt_text_pro_bulk_' . $process_id, 'options');
            $current_process = get_transient('alt_text_pro_bulk_' . $process_id);
            if (!$current_process || $current_process['status'] === 'cancelled') {
                // Log cancellation for debugging
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                    error_log('Alt Text Pro Bulk: Process cancelled, stopping at image ' . $image_id);
                }
                break;
            }

            // Check if this image was already successfully processed (prevent double-counting and duplicate API calls)
            if (in_array($image_id, $successful_image_ids)) {
                // Already processed successfully, skip to prevent double-counting and duplicate credit deduction
                $skipped++;
                $processed++;
                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename(get_attached_file($image_id)),
                    'status' => 'skipped'
                );
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
                    $batch_results[] = array(
                        'id' => $image_id,
                        'filename' => basename(get_attached_file($image_id)),
                        'status' => 'skipped'
                    );
                    continue;
                }
            }

            // Get blog context from settings
            $settings = get_option('alt_text_pro_settings', array());
            $blog_context = isset($settings['blog_context']) ? $settings['blog_context'] : '';
            $context_enabled = !empty($settings['context_enabled']);

            // Get individual image context if available
            $image_context = get_post_meta($image_id, '_alt_text_pro_context', true);

            // Auto-generate context if enabled and empty
            if ($context_enabled && empty($image_context)) {
                $media_handler = new AltTextPro_Media_Handler();
                $suggestions = $media_handler->get_context_suggestions($image_id);
                if (!empty($suggestions)) {
                    $image_context = implode(' | ', $suggestions);
                }
            }

            $result = $api_client->generate_alt_text($image_id, $image_context, $blog_context);

            // Check if credits ran out (402 error)
            if (isset($result['no_credits']) && $result['no_credits'] === true) {
                // Credits exhausted - stop processing immediately
                $error_message = $result['message'] ?? esc_html__('No credits remaining. Processing stopped.', 'alt-text-pro');
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                    error_log(sprintf(
                        'Alt Text Pro Bulk: Credits exhausted. Stopping processing at image %d. Processed: %d, Successful: %d',
                        $image_id,
                        $processed,
                        $successful
                    ));
                }
                $errors[] = array(
                    'image_id' => $image_id,
                    'error' => $error_message
                );
                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename(get_attached_file($image_id)),
                    'status' => 'error',
                    'error' => $error_message
                );
                $processed++;

                // Mark process as stopped due to credits - MUST be set before updating progress
                $process_data['status'] = 'stopped_no_credits';
                $process_data['stopped_reason'] = sprintf(
                    // translators: %1$d: Number of processed images, %2$d: Number of successfully processed images
                    esc_html__('Credits exhausted after processing %1$d images. %2$d images successfully processed. Please upgrade your plan or wait for next month\'s credit refill.', 'alt-text-pro'),
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
                set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
                wp_cache_delete('alt_text_pro_bulk_' . $process_id, 'transient');

                // Update progress
                $this->update_bulk_process_progress($process_id, $total_processed, $all_errors, $total_successful);

                // Complete process immediately
                $this->complete_bulk_process($process_id, true);

                // Return current batch results up to this point
                return $batch_results;
            }

            if ($result['success'] && !empty($result['alt_text'])) {
                // Update attachment alt text
                update_post_meta($image_id, '_wp_attachment_image_alt', $result['alt_text']);

                // Log generation (only if alt_text exists)
                if (!empty($result['alt_text'])) {
                    $this->log_generation($image_id, $result['alt_text'], $result['credits_used'] ?? 1);
                }

                $processed++;
                $successful++; // Only count as successful when alt-text is actually generated
                $new_successful_ids[] = $image_id; // Track this image as successfully processed in this batch

                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename(get_attached_file($image_id)),
                    'status' => 'success'
                );

                if (defined('WP_DEBUG') && WP_DEBUG) {
                    // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                    error_log(sprintf(
                        'Alt Text Pro Bulk: Successfully processed image %d. Batch successful: %d, Total successful IDs in batch: %d',
                        $image_id,
                        $successful,
                        count($new_successful_ids)
                    ));
                }
            } else {
                $error_message = $result['message'] ?? 'Unknown error';
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                    error_log(sprintf(
                        'Alt Text Pro Bulk: Failed to generate alt-text for image %d: %s',
                        $image_id,
                        $error_message
                    ));
                }
                $errors[] = array(
                    'image_id' => $image_id,
                    'error' => $error_message
                );
                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename(get_attached_file($image_id)),
                    'status' => 'error',
                    'error' => $error_message
                );
                // Still count as processed even if failed, but NOT as successful
                $processed++;
            }

            // Small delay to prevent overwhelming API
            usleep(500000); // 0.5 seconds
        }

        // Update progress after batch completes
        $total_processed = $batch_offset + $processed;
        // Merge successful image IDs (remove duplicates)
        $all_successful_ids = array_unique(array_merge($successful_image_ids, $new_successful_ids));
        $total_successful = count($all_successful_ids); // Count unique successful images

        // Debug logging to track successful count
        if (defined('WP_DEBUG') && WP_DEBUG) {
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
            error_log(sprintf(
                'Alt Text Pro Bulk: Batch complete. Batch offset: %d, Processed in batch: %d, Successful in batch: %d, Previous successful IDs: %d, New successful IDs: %d, Total successful: %d',
                $batch_offset,
                $processed,
                $successful,
                count($successful_image_ids),
                count($new_successful_ids),
                $total_successful
            ));
        }

        // Merge errors with existing errors from previous batches
        $existing_errors = isset($process_data['errors']) ? $process_data['errors'] : array();
        $all_errors = array_merge($existing_errors, $errors);

        // Update process data with current progress BEFORE calling update_bulk_process_progress
        // This ensures we have latest data when updating
        $process_data['processed'] = $total_processed;
        $process_data['successful'] = $total_successful; // Store successful count (unique images)
        $process_data['successful_image_ids'] = $all_successful_ids; // Store successful image IDs
        $process_data['errors'] = $all_errors; // Store merged errors
        $process_data['last_updated'] = current_time('mysql');
        $process_data['needs_next_batch'] = false;
        $process_data['next_batch_offset'] = null;

        // Save process data immediately to ensure it's persisted
        set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
        wp_cache_delete('alt_text_pro_bulk_' . $process_id, 'transient');

        // Now update progress (this will also save, but we've already saved above)
        $this->update_bulk_process_progress($process_id, $total_processed, $all_errors, $total_successful);

        // Check if processing was stopped due to credits (should not happen here as we return early, but safety check)
        if (isset($process_data['status']) && $process_data['status'] === 'stopped_no_credits') {
            // Complete process early due to credits exhaustion
            $this->complete_bulk_process($process_id, true);
            $process_data['needs_next_batch'] = false;
            set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS);
            return;
        }

        // Set status to running if not already set
        if (!isset($process_data['status']) || $process_data['status'] !== 'stopped_no_credits') {
            $process_data['status'] = 'running';
        }

        // Check if there are more batches to process
        // IMPORTANT: No longer using cron. Browser will request next batch based on these flags.
        $next_batch_offset = $batch_offset + count($images);
        if ($next_batch_offset < count($process_data['images']) && $process_data['status'] === 'running') {
            // Set flag that frontend should request next batch
            $process_data['next_batch_offset'] = $next_batch_offset;
            $process_data['needs_next_batch'] = true;

            set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
            wp_cache_delete('alt_text_pro_bulk_' . $process_id, 'transient');
        } elseif ($process_data['status'] === 'running') {
            $process_data['status'] = 'completed';
            $process_data['needs_next_batch'] = false;
            $process_data['next_batch_offset'] = null;
            set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
            wp_cache_delete('alt_text_pro_bulk_' . $process_id, 'transient');
            $this->complete_bulk_process($process_id);
        }

        return $batch_results;
    }

    /**
     * Get images without alt text
     */
    private function get_images_without_alt_text($include_existing = false)
    {
        global $wpdb;

        if ($include_existing) {
            // Include all images regardless of alt text
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is prepared immediately after assignment
            $query = $wpdb->prepare(
                "SELECT p.ID 
                 FROM {$wpdb->posts} p 
                 WHERE p.post_type = 'attachment' 
                 AND p.post_mime_type LIKE %s
                 ORDER BY p.post_date DESC
                 LIMIT %d",
                'image/%',
                1000
            );
        } else {
            // Only get images without alt text (using a more reliable query)
            // Use LEFT JOIN for better performance and to ensure we only get images without alt-text
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is prepared immediately after assignment
            $query = $wpdb->prepare(
                "SELECT p.ID 
                 FROM {$wpdb->posts} p 
                 LEFT JOIN {$wpdb->postmeta} pm ON (
                     p.ID = pm.post_id 
                     AND pm.meta_key = '_wp_attachment_image_alt'
                     AND pm.meta_value IS NOT NULL 
                     AND pm.meta_value != ''
                     AND TRIM(pm.meta_value) != ''
                 )
                 WHERE p.post_type = 'attachment' 
                 AND p.post_mime_type LIKE %s
                 AND pm.post_id IS NULL
                 ORDER BY p.post_date DESC
                 LIMIT %d",
                'image/%',
                1000
            );
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery
        return $wpdb->get_col($query);
    }

    /**
     * Get selected images
     */
    private function get_selected_images($image_ids, $include_existing = false)
    {
        global $wpdb;

        if (empty($image_ids)) {
            return array();
        }

        // Sanitize image IDs
        $image_ids = array_map('intval', $image_ids);
        $image_ids = array_filter($image_ids);

        if (empty($image_ids)) {
            return array();
        }

        // Build IN clause with sanitized IDs using proper placeholders
        $ids_escaped = array_map('intval', $image_ids);
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- IDs are sanitized with intval
        $ids_placeholders = implode(',', array_fill(0, count($ids_escaped), '%d'));
        $prepared_values = array_merge($ids_escaped, array('image/%'));

        if ($include_existing) {
            // Include all selected images regardless of alt text
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $sql = "SELECT p.ID 
                 FROM {$wpdb->posts} p 
                 WHERE p.ID IN ($ids_placeholders) 
                 AND p.post_type = 'attachment' 
                 AND p.post_mime_type LIKE %s";
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            $query = $wpdb->prepare($sql, ...$prepared_values);
        } else {
            // Only get selected images without alt text
            // Use LEFT JOIN for better performance and to ensure we only get images without alt-text
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $sql = "SELECT p.ID 
                 FROM {$wpdb->posts} p 
                 LEFT JOIN {$wpdb->postmeta} pm ON (
                     p.ID = pm.post_id 
                     AND pm.meta_key = '_wp_attachment_image_alt'
                     AND pm.meta_value IS NOT NULL 
                     AND pm.meta_value != ''
                     AND TRIM(pm.meta_value) != ''
                 )
                 WHERE p.ID IN ($ids_placeholders) 
                 AND p.post_type = 'attachment' 
                 AND p.post_mime_type LIKE %s
                 AND pm.post_id IS NULL";
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            $query = $wpdb->prepare($sql, ...$prepared_values);
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery
        return $wpdb->get_col($query);
    }

    /**
     * Create bulk process record
     */
    private function create_bulk_process_record($images, $batch_size, $overwrite_existing)
    {
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
            'needs_next_batch' => true,
            'next_batch_offset' => 0,
            'started_at' => current_time('mysql'),
            'user_id' => get_current_user_id()
        );

        // Store process data (expires in 24 hours)
        set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS);

        return $process_id;
    }

    /**
     * Get bulk process status
     */
    private function get_bulk_process_status($process_id)
    {
        $process_data = get_transient('alt_text_pro_bulk_' . $process_id);

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
            // Fallback: count successful image IDs array
            $successful = count($process_data['successful_image_ids']);
        } else {
            // Last resort: calculate from processed minus errors
            $successful = max(0, $processed - $error_count);
        }

        // Ensure successful count matches actual successful_image_ids count
        if (isset($process_data['successful_image_ids']) && is_array($process_data['successful_image_ids'])) {
            $actual_successful_count = count($process_data['successful_image_ids']);
            if ($actual_successful_count !== $successful) {
                // Fix discrepancy - use actual count from array
                $successful = $actual_successful_count;
                // Update stored value for consistency
                $process_data['successful'] = $successful;
                set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
            }
        }

        // Include stopped_reason if process was stopped due to credits
        $status_data = array(
            'process_id' => $process_id,
            'status' => ($process_data['status'] ?? 'running') === 'running' ? 'processing' : ($process_data['status'] ?? 'running'),
            'total_images' => isset($process_data['images']) ? count($process_data['images']) : 0,
            'processed' => $processed,
            'processed_count' => $processed, // Added for JS compatibility
            'successful' => $successful,
            'successful_count' => $successful, // Added for JS compatibility
            'errors' => $errors,
            'error_count' => count($errors), // Added for JS compatibility
            'batch_size' => $process_data['batch_size'] ?? 2,
            'started_at' => $process_data['started_at'] ?? null,
            'completed_at' => $process_data['completed_at'] ?? null,
            'needs_next_batch' => isset($process_data['needs_next_batch']) ? $process_data['needs_next_batch'] : false,
            'next_batch_offset' => isset($process_data['next_batch_offset']) ? $process_data['next_batch_offset'] : null
        );

        // Add stopped_reason if process was stopped due to credits
        if (isset($process_data['status']) && $process_data['status'] === 'stopped_no_credits') {
            $status_data['stopped_reason'] = $process_data['stopped_reason'] ?? esc_html__('Credits exhausted. Please upgrade your plan or wait for next month\'s credit refill.', 'alt-text-pro');
        }

        return $status_data;
    }

    /**
     * Update bulk process progress
     */
    private function update_bulk_process_progress($process_id, $processed, $errors, $successful = null)
    {
        $process_data = get_transient('alt_text_pro_bulk_' . $process_id);

        if ($process_data) {
            $process_data['processed'] = $processed;
            $process_data['errors'] = $errors;
            if ($successful !== null) {
                $process_data['successful'] = $successful;
            }
            $process_data['status'] = 'running';
            $process_data['last_updated'] = current_time('mysql');

            // Update transient with extended expiry
            set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);

            // Force save to ensure it's written immediately
            wp_cache_delete('alt_text_pro_bulk_' . $process_id, 'transient');
        }
    }

    /**
     * Complete bulk process
     */
    private function complete_bulk_process($process_id, $early_stop = false)
    {
        $process_data = get_transient('alt_text_pro_bulk_' . $process_id);

        if ($process_data) {
            // Check if email was already sent to prevent duplicates
            if (isset($process_data['email_sent']) && $process_data['email_sent'] === true) {
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                    error_log('Alt Text Pro Bulk: Email already sent for process ' . $process_id . ', skipping duplicate.');
                }
                return;
            }

            if ($early_stop && isset($process_data['status']) && $process_data['status'] === 'stopped_no_credits') {
                $process_data['status'] = 'stopped_no_credits';
            } else {
                $process_data['status'] = 'completed';
            }

            $process_data['completed_at'] = current_time('mysql');
            $process_data['email_sent'] = true; // Mark email as sent to prevent duplicates

            set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS);

            // Send completion notification (only once)
            $this->send_completion_notification($process_data);
        }
    }

    /**
     * Cancel bulk process
     */
    private function cancel_bulk_process($process_id)
    {
        $process_data = get_transient('alt_text_pro_bulk_' . $process_id);

        if ($process_data) {
            $process_data['status'] = 'cancelled';
            $process_data['cancelled_at'] = current_time('mysql');

            set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS);
        }
    }

    /**
     * Send completion notification
     */
    private function send_completion_notification($process_data)
    {
        $user = get_user_by('id', $process_data['user_id']);

        if ($user && $user->user_email) {
            // Check if processing stopped due to credits
            $stopped_reason = isset($process_data['stopped_reason']) ? $process_data['stopped_reason'] : '';
            $is_stopped = isset($process_data['status']) && $process_data['status'] === 'stopped_no_credits';

            if ($is_stopped) {
                $subject = esc_html__('Alt Text Pro: Bulk Processing Stopped - No Credits', 'alt-text-pro');
                $message = sprintf(
                    // translators: %1$d: Total images, %2$d: Processed images, %3$d: Successfully processed images, %4$d: Error count, %5$s: Stopped reason
                    esc_html__("Your bulk alt-text generation process has stopped due to insufficient credits.\n\nResults:\n- Total images: %1\$d\n- Processed: %2\$d\n- Successfully processed: %3\$d\n- Errors: %4\$d\n\nReason: %5\$s\n\nPlease upgrade your plan to continue processing remaining images.\n\nYou can view detailed results in your WordPress admin dashboard.", 'alt-text-pro'),
                    $process_data['total_images'],
                    $process_data['processed'] ?? 0,
                    $process_data['successful'] ?? 0,
                    count($process_data['errors'] ?? array()),
                    $stopped_reason ?: esc_html__('No credits remaining', 'alt-text-pro')
                );
            } else {
                $subject = esc_html__('Alt Text Pro: Bulk Processing Complete', 'alt-text-pro');
                $message = sprintf(
                    // translators: %1$d: Total images, %2$d: Successfully processed images, %3$d: Error count
                    esc_html__("Your bulk alt-text generation process has completed.\n\nResults:\n- Total images: %1\$d\n- Successfully processed: %2\$d\n- Errors: %3\$d\n\nYou can view detailed results in your WordPress admin dashboard.", 'alt-text-pro'),
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
    private function estimate_processing_time($image_count)
    {
        // Estimate 3 seconds per image (including API call and processing)
        $estimated_seconds = $image_count * 3;

        if ($estimated_seconds < 60) {
            return sprintf(
                // translators: %d: Number of seconds
                esc_html__('%1$d seconds', 'alt-text-pro'),
                $estimated_seconds
            );
        } elseif ($estimated_seconds < 3600) {
            return sprintf(
                // translators: %d: Number of minutes
                esc_html__('%1$d minutes', 'alt-text-pro'),
                ceil($estimated_seconds / 60)
            );
        } else {
            return sprintf(
                // translators: %d: Number of hours
                esc_html__('%1$d hours', 'alt-text-pro'),
                ceil($estimated_seconds / 3600)
            );
        }
    }

    /**
     * Log alt-text generation
     */
    private function log_generation($attachment_id, $alt_text, $credits_used = 1)
    {
        global $wpdb;

        // Don't log if alt_text is empty
        if (empty($alt_text)) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                error_log('Alt Text Pro Bulk: Skipping log entry - alt_text is empty for attachment ' . $attachment_id);
            }
            return;
        }

        $table_name = $wpdb->prefix . 'alt_text_pro_logs';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
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
            if (defined('WP_DEBUG') && WP_DEBUG) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                error_log('Alt Text Pro Bulk: Database error logging generation: ' . $wpdb->last_error);
            }
        }
    }

    /**
     * Get bulk processing history
     */
    public function get_processing_history($limit = 10)
    {
        $history = array();
        $transients = wp_cache_get('alt_text_pro_bulk_history');

        if (!$transients) {
            // This is a simplified version - in production you might want to store this in database
            $transients = array();
        }

        return array_slice($transients, 0, $limit);
    }
}
