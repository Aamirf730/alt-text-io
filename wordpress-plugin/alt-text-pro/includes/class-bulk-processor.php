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

    private const MAX_RETRY_ATTEMPTS = 3;

    /**
     * Constructor
     */
    public function __construct()
    {
        add_action('wp_ajax_alt_text_pro_bulk_start', array($this, 'ajax_start_bulk_process'));
        add_action('wp_ajax_alt_text_pro_bulk_status', array($this, 'ajax_get_bulk_status'));
        add_action('wp_ajax_alt_text_pro_bulk_process_batch', array($this, 'ajax_process_batch'));
        add_action('wp_ajax_alt_text_pro_bulk_skip_failed_image', array($this, 'ajax_skip_failed_image'));
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

        // Keep each AJAX batch to one billable image so a user-initiated cancel
        // cannot be hidden behind a larger already-running batch.
        $batch_size = 1;
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
        $credits_used = isset($usage_stats['data']['credits_used']) ? intval($usage_stats['data']['credits_used']) : 0;
        $total_credits = isset($usage_stats['data']['total_credits']) ? intval($usage_stats['data']['total_credits']) : 0;
        $monthly_credit_allowance = isset($usage_stats['data']['monthly_credit_allowance']) ? intval($usage_stats['data']['monthly_credit_allowance']) : 0;
        $monthly_credit_limit = isset($usage_stats['data']['monthly_credit_limit']) ? intval($usage_stats['data']['monthly_credit_limit']) : 0;
        $monthly_credits_remaining = isset($usage_stats['data']['monthly_credits_remaining']) ? intval($usage_stats['data']['monthly_credits_remaining']) : null;
        $monthly_credits_used = isset($usage_stats['data']['monthly_credits_used']) ? intval($usage_stats['data']['monthly_credits_used']) : $credits_used;
        $subscription_plan = isset($usage_stats['data']['subscription_plan']) ? sanitize_text_field($usage_stats['data']['subscription_plan']) : 'free';
        $subscription_plans = array('free', 'tier1', 'tier2', 'tier3', 'tier4', 'lite', 'standard', 'pro', 'agency');

        if ($credits_remaining <= 0) {
            wp_send_json_error(esc_html__('No credits remaining. Please upgrade your plan before starting bulk processing.', 'alt-text-pro'));
        }

        $total_images = count($images_to_process);
        $plan_allowance = $monthly_credit_limit > 0 ? $monthly_credit_limit : ($monthly_credit_allowance > 0 ? $monthly_credit_allowance : $total_credits);
        $plan_remaining = $monthly_credits_remaining !== null
            ? $monthly_credits_remaining
            : ($plan_allowance > 0 ? max(0, $plan_allowance - $monthly_credits_used) : $credits_remaining);
        $credit_limit_for_run = in_array($subscription_plan, $subscription_plans, true)
            ? min($credits_remaining, $plan_remaining)
            : $credits_remaining;
        $processable_images = min($total_images, $credit_limit_for_run);

        if ($processable_images <= 0) {
            wp_send_json_error(esc_html__('No plan credits remaining for this billing cycle. Please upgrade, top up, or wait for your next credit refill before starting bulk processing.', 'alt-text-pro'));
        }

        // Create bulk process record
        $process_id = $this->create_bulk_process_record($images_to_process, $batch_size, $overwrite_existing, $credits_remaining, $processable_images, $plan_allowance, $monthly_credits_used);

        wp_send_json_success(array(
            'process_id' => $process_id,
            'total_images' => $total_images,
            'queue_total_images' => $total_images,
            'processable_images' => $processable_images,
            'credits_remaining' => $credits_remaining,
            'plan_allowance' => $plan_allowance,
            'plan_credits_used' => $monthly_credits_used,
            'plan_credits_remaining' => $credit_limit_for_run,
            'batch_size' => $batch_size,
            'estimated_time' => $this->estimate_processing_time($processable_images)
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

        $process_data = $this->get_bulk_process_data($process_id, true);
        if (!$process_data) {
            wp_send_json_error(esc_html__('Process not found.', 'alt-text-pro'));
        }

        $terminal_statuses = array('completed', 'cancelled', 'cancelling', 'stopped_no_credits');
        if (in_array($process_data['status'] ?? '', $terminal_statuses, true)) {
            $status = $this->get_bulk_process_status($process_id);
            $status['batch_results'] = array();
            wp_send_json_success($status);
        }

        $expected_offset = isset($process_data['next_batch_offset'])
            ? intval($process_data['next_batch_offset'])
            : intval($process_data['processed'] ?? 0);
        if ($batch_offset < 0 || $batch_offset !== $expected_offset) {
            // Reconcile a repeated or stale browser request without calling the
            // billable API a second time.
            $status = $this->get_bulk_process_status($process_id);
            $status['batch_results'] = array();
            wp_send_json_success($status);
        }

        $lock_token = $this->acquire_process_lock($process_id);
        if (!$lock_token) {
            $status = $this->get_bulk_process_status($process_id);
            $status['batch_results'] = array();
            $status['busy'] = true;
            $status['needs_next_batch'] = false;
            $status['retry_after_seconds'] = 2;
            wp_send_json_success($status);
        }

        try {
            // Check the offset again after acquiring the cross-request lock.
            $process_data = $this->get_bulk_process_data($process_id, true);
            $expected_offset = $process_data && isset($process_data['next_batch_offset'])
                ? intval($process_data['next_batch_offset'])
                : intval($process_data['processed'] ?? 0);

            if (!$process_data || $batch_offset !== $expected_offset) {
                $batch_results = array();
            } else {
                $batch_results = $this->process_batch_sync($process_id, $batch_offset);
            }
        } finally {
            $this->release_process_lock($process_id, $lock_token);
        }

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
     * Record a failed batch image after a transport-level request failure.
     *
     * This is intentionally separate from normal batch processing. It only
     * advances the queue after the active server-side image request has
     * finished or its short-lived marker has expired, preventing double counts
     * when the browser loses a response after WordPress has already completed.
     */
    public function ajax_skip_failed_image()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        $process_id = isset($_POST['process_id']) ? sanitize_text_field(wp_unslash($_POST['process_id'])) : '';
        $batch_offset = isset($_POST['batch_offset']) ? intval($_POST['batch_offset']) : 0;
        $failure_type = isset($_POST['failure_type']) ? sanitize_key(wp_unslash($_POST['failure_type'])) : '';

        if (empty($process_id)) {
            wp_send_json_error(esc_html__('Process ID is required.', 'alt-text-pro'));
        }

        $result = $this->skip_failed_image($process_id, $batch_offset, $failure_type);
        if ($result['success']) {
            wp_send_json_success($result['data']);
        }

        wp_send_json_error($result['message']);
    }

    /**
     * Reconcile one failed browser request without racing an active batch.
     */
    private function skip_failed_image($process_id, $batch_offset, $failure_type)
    {
        $process_data = $this->get_bulk_process_data($process_id, true);
        if (!$process_data) {
            return array(
                'success' => false,
                'message' => esc_html__('Process not found.', 'alt-text-pro')
            );
        }

        $lock_token = $this->acquire_process_lock($process_id);
        if (!$lock_token) {
            return array(
                'success' => true,
                'data' => array(
                    'busy' => true,
                    'retry_after_seconds' => 2
                )
            );
        }

        try {
            $process_data = $this->get_bulk_process_data($process_id, true);
            if (!$process_data) {
                return array(
                    'success' => false,
                    'message' => esc_html__('Process not found.', 'alt-text-pro')
                );
            }

            $status = $process_data['status'] ?? 'running';
            if (in_array($status, array('completed', 'cancelled', 'cancelling', 'stopped_no_credits'), true)) {
                $status_data = $this->get_bulk_process_status($process_id);
                $status_data['batch_results'] = array();
                return array('success' => true, 'data' => $status_data);
            }

            // Do not mark an image failed while its original server-side request
            // can still finish and record a successful result.
            if (get_transient($this->get_active_request_key($process_id)) !== false) {
                return array(
                    'success' => true,
                    'data' => array(
                        'busy' => true,
                        'retry_after_seconds' => 2
                    )
                );
            }

            $processable_images = isset($process_data['processable_images'])
                ? intval($process_data['processable_images'])
                : count($process_data['images'] ?? array());
            if ($batch_offset < 0 || $batch_offset >= $processable_images || empty($process_data['images'][$batch_offset])) {
                return array(
                    'success' => false,
                    'message' => esc_html__('The failed image could not be identified.', 'alt-text-pro')
                );
            }

            $processed = intval($process_data['processed'] ?? 0);
            if ($processed > $batch_offset) {
                // The original request already advanced the process before the
                // browser reported its transport failure.
                $status_data = $this->get_bulk_process_status($process_id);
                $status_data['batch_results'] = array();
                return array('success' => true, 'data' => $status_data);
            }

            if ($processed < $batch_offset) {
                return array(
                    'success' => false,
                    'message' => esc_html__('Process status is out of sync. Please start a new run.', 'alt-text-pro')
                );
            }

            $image_id = intval($process_data['images'][$batch_offset]);
            $can_edit_image = wp_attachment_is_image($image_id) && current_user_can('edit_post', $image_id);
            $error_message = !$can_edit_image
                ? esc_html__('This image is no longer available to edit.', 'alt-text-pro')
                : ($failure_type === 'too_large'
                    ? esc_html__('Image too large to process.', 'alt-text-pro')
                    : esc_html__('Image could not be processed.', 'alt-text-pro'));
            $error_entry = array(
                'image_id' => $image_id,
                'error' => $error_message
            );
            $errors = isset($process_data['errors']) && is_array($process_data['errors'])
                ? $process_data['errors']
                : array();
            $errors[] = $error_entry;

            $processed++;
            $next_batch_offset = $batch_offset + 1;
            $process_data['processed'] = $processed;
            $process_data['errors'] = $errors;
            $process_data['needs_next_batch'] = $next_batch_offset < $processable_images;
            $process_data['next_batch_offset'] = $process_data['needs_next_batch'] ? $next_batch_offset : null;
            $process_data['last_updated'] = current_time('mysql');
            $process_data['status'] = 'running';

            set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);

            $batch_result = array(
                'id' => $image_id,
                'status' => 'error',
                'error' => $error_message
            );
            if ($can_edit_image) {
                $batch_result['filename'] = basename(get_attached_file($image_id));
            }

            if (!$process_data['needs_next_batch']) {
                $this->complete_bulk_process($process_id);
            }

            $status_data = $this->get_bulk_process_status($process_id);
            if (!$status_data) {
                return array(
                    'success' => false,
                    'message' => esc_html__('Process status could not be saved.', 'alt-text-pro')
                );
            }

            $status_data['batch_results'] = array($batch_result);
            return array('success' => true, 'data' => $status_data);
        } finally {
            $this->release_process_lock($process_id, $lock_token);
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
        if (!$this->cancel_bulk_process($process_id)) {
            wp_send_json_error(esc_html__('Process not found.', 'alt-text-pro'));
        }

        wp_send_json_success($this->get_bulk_process_status($process_id));
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
        $process_data = $this->get_bulk_process_data($process_id, true);

        if (
            !$process_data ||
            in_array($process_data['status'] ?? '', array('cancelled', 'cancelling'), true)
        ) {
            return;
        }

        $api_client = new AltTextPro_API_Client();
        $batch_size = $process_data['batch_size'];
        $processable_images = isset($process_data['processable_images']) ? intval($process_data['processable_images']) : count($process_data['images']);

        if ($batch_offset >= $processable_images) {
            $process_data['status'] = 'completed';
            $process_data['needs_next_batch'] = false;
            $process_data['next_batch_offset'] = null;
            set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
            $this->complete_bulk_process($process_id);
            return array();
        }

        $remaining_processable = max(0, $processable_images - $batch_offset);
        $images = array_slice($process_data['images'], $batch_offset, min($batch_size, $remaining_processable));

        $processed = 0;
        $skipped = 0;
        $successful = 0; // Track successful generations separately
        $errors = array();
        $batch_results = array();
        $cancelled_mid_batch = false;

        // Get existing successful image IDs to prevent double-counting
        $successful_image_ids = isset($process_data['successful_image_ids']) ? $process_data['successful_image_ids'] : array();
        $new_successful_ids = array(); // Track new successes in this batch

        foreach ($images as $image_id) {
            $image_id = intval($image_id);

            // Re-read the process before starting each image so cancellation is honored.
            $current_process = $this->get_bulk_process_data($process_id, true);
            if (
                !$current_process ||
                in_array($current_process['status'] ?? '', array('cancelled', 'cancelling'), true)
            ) {
                if ($current_process) {
                    $process_data = $current_process;
                }
                $cancelled_mid_batch = true;
                break;
            }

            // Permissions can change after a job is queued. Re-check immediately
            // before any metadata read or billable API request.
            if (!$image_id || !wp_attachment_is_image($image_id) || !current_user_can('edit_post', $image_id)) {
                $error_message = esc_html__('This image is no longer available to edit.', 'alt-text-pro');
                $errors[] = array(
                    'image_id' => $image_id,
                    'error' => $error_message
                );
                $batch_results[] = array(
                    'id' => $image_id,
                    'status' => 'error',
                    'error' => $error_message
                );
                $processed++;
                continue;
            }

            // Check if this image was already successfully processed (prevent double-counting and duplicate API calls)
            if (in_array($image_id, $successful_image_ids, true)) {
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

            // Mark the billable request as active before contacting the API.
            // Cancel uses this separate short-lived marker to distinguish
            // "stop now" from "stop after the current image settles".
            $active_request_key = $this->get_active_request_key($process_id);
            set_transient(
                $active_request_key,
                array(
                    'batch_offset' => $batch_offset,
                    'image_id' => $image_id
                ),
                2 * MINUTE_IN_SECONDS
            );

            // Close the small race between the first cancellation check and the
            // active marker being written. Never start AI work for a stopped job.
            $current_process = $this->get_bulk_process_data($process_id, true);
            if (
                !$current_process ||
                in_array($current_process['status'] ?? '', array('cancelled', 'cancelling'), true)
            ) {
                delete_transient($active_request_key);
                if ($current_process) {
                    $process_data = $current_process;
                }
                $cancelled_mid_batch = true;
                break;
            }

            $result = $api_client->generate_alt_text($image_id, $image_context, $blog_context);
            delete_transient($active_request_key);

            // Cancellation may arrive while WordPress is waiting for the AI.
            // A successful response has already consumed one credit, so retain
            // and count it. A failed response can stop without adding an error.
            $current_process = $this->get_bulk_process_data($process_id, true);
            if (
                $current_process &&
                in_array($current_process['status'] ?? '', array('cancelled', 'cancelling'), true)
            ) {
                $process_data = $current_process;
                $cancelled_mid_batch = true;
            }

            if ($cancelled_mid_batch && (!$result['success'] || empty($result['alt_text']))) {
                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename(get_attached_file($image_id)),
                    'status' => 'cancelled'
                );
                break;
            }

            // Oversized images are a per-image failure, not a bulk-run failure.
            // Record the error, advance the processed offset, and continue with
            // the next image without retrying the same payload.
            if (!empty($result['image_too_large'])) {
                $error_message = esc_html__('Image too large to process.', 'alt-text-pro');
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
                continue;
            }

            if (!$result['success'] && !empty($result['retryable'])) {
                if (!isset($process_data['retry_attempts']) || !is_array($process_data['retry_attempts'])) {
                    $process_data['retry_attempts'] = array();
                }

                $retry_attempt = intval($process_data['retry_attempts'][$image_id] ?? 0) + 1;
                $process_data['retry_attempts'][$image_id] = $retry_attempt;

                if ($retry_attempt >= self::MAX_RETRY_ATTEMPTS) {
                    unset($process_data['retry_attempts'][$image_id]);
                    $error_message = esc_html__('The Alt Text Pro service could not process this image after three attempts.', 'alt-text-pro');
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
                    continue;
                }

                // Use the provider's requested retry window. A fixed 15-second
                // minimum unnecessarily slows providers that recover sooner.
                $retry_after = isset($result['retry_after_seconds']) ? max(1, intval($result['retry_after_seconds'])) : 15;
                $error_message = $result['message'] ?? esc_html__('AI generation is temporarily rate limited. Waiting before retrying.', 'alt-text-pro');

                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename(get_attached_file($image_id)),
                    'status' => 'retrying',
                    'error' => $error_message,
                    'retry_after_seconds' => $retry_after
                );

                $process_data['status'] = 'running';
                $process_data['needs_next_batch'] = true;
                $process_data['next_batch_offset'] = $batch_offset;
                $process_data['retry_after_seconds'] = $retry_after;
                $process_data['retry_message'] = $error_message;
                $process_data['last_updated'] = current_time('mysql');

                set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);

                return $batch_results;
            }

            // Check if credits ran out (402 error)
            if (isset($result['no_credits']) && $result['no_credits'] === true) {
                // Credits exhausted - stop processing immediately
                $error_message = $result['message'] ?? esc_html__('No credits remaining. Processing stopped.', 'alt-text-pro');
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
                unset($process_data['retry_attempts']);
                $process_data['needs_next_batch'] = false; // CRITICAL: Prevent any further batches
                $process_data['last_updated'] = current_time('mysql');

                // Save immediately
                set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);

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

            } else {
                $error_message = $result['message'] ?? 'Unknown error';
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

        // Merge errors with existing errors from previous batches
        $existing_errors = isset($process_data['errors']) ? $process_data['errors'] : array();
        $all_errors = array_merge($existing_errors, $errors);

        // A cancel request can arrive while this PHP request is waiting on the AI API.
        // Re-read immediately before saving so a late batch response cannot revive the job.
        $latest_process = $this->get_bulk_process_data($process_id, true);
        if (
            $latest_process &&
            in_array($latest_process['status'] ?? '', array('cancelled', 'cancelling'), true)
        ) {
            $process_data = $latest_process;
            $cancelled_mid_batch = true;
        }

        // Update process data with current progress BEFORE calling update_bulk_process_progress
        // This ensures we have latest data when updating
        $process_data['processed'] = $total_processed;
        $process_data['successful'] = $total_successful; // Store successful count (unique images)
        $process_data['successful_image_ids'] = $all_successful_ids; // Store successful image IDs
        $process_data['errors'] = $all_errors; // Store merged errors
        unset($process_data['retry_attempts']);
        $process_data['last_updated'] = current_time('mysql');
        $process_data['needs_next_batch'] = false;
        $process_data['next_batch_offset'] = null;
        unset($process_data['retry_after_seconds'], $process_data['retry_message']);

        if ($cancelled_mid_batch) {
            $process_data['status'] = 'cancelled';
            $process_data['cancelled_at'] = $process_data['cancelled_at'] ?? current_time('mysql');
        }

        // Save process data immediately to ensure it's persisted
        set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);

        if ($cancelled_mid_batch) {
            return $batch_results;
        }

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
        $run_limit = isset($process_data['processable_images']) ? intval($process_data['processable_images']) : count($process_data['images']);
        if ($next_batch_offset < $run_limit && $process_data['status'] === 'running') {
            // Set flag that frontend should request next batch
            $process_data['next_batch_offset'] = $next_batch_offset;
            $process_data['needs_next_batch'] = true;

            set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
        } elseif ($process_data['status'] === 'running') {
            $process_data['status'] = 'completed';
            $process_data['needs_next_batch'] = false;
            $process_data['next_batch_offset'] = null;
            set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
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
        return $this->filter_editable_images($wpdb->get_col($query));
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
        return $this->filter_editable_images($wpdb->get_col($query));
    }

    /**
     * Keep only image attachments the current user may modify.
     */
    private function filter_editable_images($image_ids)
    {
        $editable_images = array();
        $normalized_image_ids = array_values(array_unique(array_filter(array_map('intval', (array) $image_ids))));

        if (empty($normalized_image_ids)) {
            return array();
        }

        // Prime posts only; attachment metadata and terms are not needed here.
        _prime_post_caches($normalized_image_ids, false, false);

        foreach ($normalized_image_ids as $image_id) {
            if (
                wp_attachment_is_image($image_id) &&
                current_user_can('edit_post', $image_id)
            ) {
                $editable_images[] = $image_id;
            }
        }

        return $editable_images;
    }

    /**
     * Create bulk process record
     */
    private function create_bulk_process_record($images, $batch_size, $overwrite_existing, $credits_remaining_at_start = 0, $processable_images = null, $plan_allowance = null, $plan_credits_used = null)
    {
        $process_id = 'bulk_' . wp_generate_password(32, false, false);
        $total_images = count($images);
        $processable_images = $processable_images === null
            ? min($total_images, max(0, intval($credits_remaining_at_start)))
            : min($total_images, max(0, intval($processable_images)));

        $process_data = array(
            'id' => $process_id,
            'images' => $images,
            'batch_size' => $batch_size,
            'overwrite_existing' => $overwrite_existing,
            'status' => 'running',
            'total_images' => $total_images,
            'queue_total_images' => $total_images,
            'processable_images' => $processable_images,
            'credits_remaining_at_start' => max(0, intval($credits_remaining_at_start)),
            'plan_allowance' => $plan_allowance === null ? null : max(0, intval($plan_allowance)),
            'plan_credits_used_at_start' => $plan_credits_used === null ? null : max(0, intval($plan_credits_used)),
            'processed' => 0,
            'successful' => 0, // Track successful generations separately
            'successful_image_ids' => array(), // Track which images were successfully processed to prevent double-counting
            'retry_attempts' => array(),
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
        $process_data = $this->get_bulk_process_data($process_id);

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
            'queue_total_images' => isset($process_data['queue_total_images']) ? intval($process_data['queue_total_images']) : (isset($process_data['images']) ? count($process_data['images']) : 0),
            'processable_images' => isset($process_data['processable_images']) ? intval($process_data['processable_images']) : (isset($process_data['images']) ? count($process_data['images']) : 0),
            'credits_remaining_at_start' => isset($process_data['credits_remaining_at_start']) ? intval($process_data['credits_remaining_at_start']) : null,
            'plan_allowance' => isset($process_data['plan_allowance']) ? intval($process_data['plan_allowance']) : null,
            'plan_credits_used_at_start' => isset($process_data['plan_credits_used_at_start']) ? intval($process_data['plan_credits_used_at_start']) : null,
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
            'next_batch_offset' => isset($process_data['next_batch_offset']) ? $process_data['next_batch_offset'] : null,
            'retry_after_seconds' => isset($process_data['retry_after_seconds']) ? intval($process_data['retry_after_seconds']) : null,
            'retry_message' => isset($process_data['retry_message']) ? $process_data['retry_message'] : null
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
        $process_data = $this->get_bulk_process_data($process_id, true);

        if ($process_data) {
            $process_data['processed'] = $processed;
            $process_data['errors'] = $errors;
            if ($successful !== null) {
                $process_data['successful'] = $successful;
            }
            $current_status = $process_data['status'] ?? 'running';
            if (!in_array($current_status, array('cancelled', 'completed', 'stopped_no_credits'), true)) {
                $process_data['status'] = 'running';
            }
            $process_data['last_updated'] = current_time('mysql');
            unset($process_data['retry_after_seconds'], $process_data['retry_message']);

            // Update transient with extended expiry
            set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS * 2);
        }
    }

    /**
     * Complete bulk process
     */
    private function complete_bulk_process($process_id, $early_stop = false)
    {
        $process_data = $this->get_bulk_process_data($process_id, true);

        if ($process_data) {
            if (isset($process_data['status']) && $process_data['status'] === 'cancelled') {
                $process_data['completed_at'] = $process_data['completed_at'] ?? current_time('mysql');
                $process_data['needs_next_batch'] = false;
                $process_data['next_batch_offset'] = null;
                set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS);
                return;
            }

            // Check if email was already sent to prevent duplicates
            if (isset($process_data['email_sent']) && $process_data['email_sent'] === true) {
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
        $process_data = $this->get_bulk_process_data($process_id, true);

        if (!$process_data) {
            return false;
        }

        $current_status = $process_data['status'] ?? 'running';
        if (in_array($current_status, array('completed', 'stopped_no_credits'), true)) {
            return true;
        }

        // A browser abort cannot stop PHP or an upstream AI request. Mark an
        // active request as "cancelling" until it returns, then its result can
        // be counted before the process becomes terminally cancelled.
        $has_active_request = get_transient($this->get_active_request_key($process_id)) !== false;
        $process_data['status'] = $has_active_request ? 'cancelling' : 'cancelled';
        $process_data['cancelled_at'] = current_time('mysql');
        $process_data['needs_next_batch'] = false;
        $process_data['next_batch_offset'] = null;

        set_transient('alt_text_pro_bulk_' . $process_id, $process_data, DAY_IN_SECONDS);
        return true;
    }

    /**
     * Get the short-lived transient key used while one billable request is active.
     */
    private function get_active_request_key($process_id)
    {
        return 'alt_text_pro_bulk_active_' . $process_id;
    }

    /**
     * Clear the option caches touched by direct atomic lock queries.
     */
    private function clear_lock_option_cache($option_name)
    {
        wp_cache_delete($option_name, 'options');
        wp_cache_delete('notoptions', 'options');
    }

    /**
     * Insert a lock only when no row with the same option name exists.
     */
    private function atomic_insert_lock_option($option_name, $lock)
    {
        global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $inserted = $wpdb->query($wpdb->prepare(
            "INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, %s)",
            $option_name,
            maybe_serialize($lock),
            'no'
        ));

        if (1 === $inserted) {
            $this->clear_lock_option_cache($option_name);
            return true;
        }

        return false;
    }

    /**
     * Delete only the exact lock value that was read by this request.
     */
    private function atomic_delete_lock_option($option_name, $expected_lock)
    {
        global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $deleted = $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name = %s AND option_value = %s",
            $option_name,
            maybe_serialize($expected_lock)
        ));

        if (1 === $deleted) {
            $this->clear_lock_option_cache($option_name);
            return true;
        }

        return false;
    }

    /**
     * Acquire a database-backed lock so one bulk offset cannot be billed twice.
     */
    private function acquire_process_lock($process_id)
    {
        if (!$this->get_bulk_process_data($process_id, true)) {
            return false;
        }

        $option_name = 'alt_text_pro_bulk_lock_' . hash('sha256', $process_id);
        $token = wp_generate_password(32, false, false);
        $lock = array(
            'token' => $token,
            'expires_at' => time() + 120
        );

        if ($this->atomic_insert_lock_option($option_name, $lock)) {
            return $token;
        }

        $existing_lock = get_option($option_name, false);
        if (is_array($existing_lock) && intval($existing_lock['expires_at'] ?? 0) < time()) {
            if (
                $this->atomic_delete_lock_option($option_name, $existing_lock) &&
                $this->atomic_insert_lock_option($option_name, $lock)
            ) {
                return $token;
            }
        }

        return false;
    }

    /**
     * Release a bulk lock only when this request owns its random token.
     */
    private function release_process_lock($process_id, $token)
    {
        $option_name = 'alt_text_pro_bulk_lock_' . hash('sha256', $process_id);
        $existing_lock = get_option($option_name, false);

        if (
            is_array($existing_lock) &&
            is_string($existing_lock['token'] ?? null) &&
            is_string($token) &&
            hash_equals($existing_lock['token'], $token)
        ) {
            $this->atomic_delete_lock_option($option_name, $existing_lock);
        }
    }

    /**
     * Read bulk-process state without deleting it from a persistent object cache.
     *
     * Cancellation checks can happen more than once in the same PHP request. A
     * forced object-cache read bypasses any request-local copy while preserving
     * the Redis-backed transient for the next AJAX batch.
     */
    private function get_bulk_process_data($process_id, $force_refresh = false)
    {
        if (
            !is_string($process_id) ||
            !preg_match('/^bulk_(?:[A-Za-z0-9]{32}|[a-f0-9]{13}\.[0-9]{8})$/', $process_id)
        ) {
            return false;
        }

        $transient_key = 'alt_text_pro_bulk_' . $process_id;

        if ($force_refresh && wp_using_ext_object_cache()) {
            $found = false;
            $process_data = wp_cache_get($transient_key, 'transient', true, $found);
        } else {
            $process_data = get_transient($transient_key);
        }

        if (
            !$process_data ||
            !is_array($process_data) ||
            intval($process_data['user_id'] ?? 0) !== get_current_user_id()
        ) {
            return false;
        }

        return $process_data;
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
        // This is an expected end-to-end average, not an enforced delay. Actual
        // pacing remains sequential and waits longer only after a provider 429.
        $estimated_seconds = $image_count * 8;

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
                error_log('Alt Text Pro Bulk: Generation history could not be saved.');
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
