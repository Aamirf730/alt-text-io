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

    // Largest queue one run takes on. Above the biggest credit pack, and small
    // enough that the saved run state stays a reasonable option row.
    private const MAX_BULK_QUEUE = 20000;

    // One bulk run per site. Two concurrent runs over the same library would
    // both reach images still in flight in the other run and pay twice.
    private const ACTIVE_RUN_OPTION = 'alt_text_pro_active_bulk_run';

    // A run that is stopping and makes no progress for this long no longer
    // blocks a new one.
    private const ACTIVE_RUN_STALE_SECONDS = 900;

    // A running run left by a closed tab (or a background run whose WP-Cron
    // stopped) stays paused and resumable for this long (7 days). It keeps
    // the site's one run slot; its owner or any administrator can stop it.
    private const RESUMABLE_RUN_SECONDS = 604800;

    // A tab-driven run with no progress for this long is shown as paused.
    private const PAUSED_AFTER_SECONDS = 120;

    // Summaries of the latest finished runs (for "Recent runs" and undo).
    public const RUN_HISTORY_OPTION = 'alt_text_pro_bulk_runs';
    private const RUN_HISTORY_LIMIT = 10;

    // Failed or skipped images listed per run on the Bulk page.
    private const RUN_ITEMS_LIMIT = 200;

    // Log rows one undo request restores.
    private const UNDO_CHUNK = 100;

    // WP-Cron event that continues a run in the background.
    public const BACKGROUND_HOOK = 'alt_text_pro_bulk_background_tick';

    // Option prefix marking a run as continuing in the background. Kept
    // outside the run state so switching mode never races a batch that is
    // saving that state.
    private const BACKGROUND_OPTION_PREFIX = 'alt_text_pro_bulk_bg_';

    // Seconds of work one background tick starts images for.
    private const BACKGROUND_TICK_BUDGET = 30;

    // Additive logs-table columns for bulk runs (outcome, reason, run,
    // previous alt text). Upgraded separately from the base table.
    public const LOG_SCHEMA_OPTION = 'alt_text_pro_bulk_log_db_version';
    public const LOG_SCHEMA_VERSION = '1';

    // Attachment meta set by the "decorative image" flag; such images are
    // never queued.
    public const DECORATIVE_META = '_alt_text_pro_decorative';

    // Log outcomes that are not generations (no credit used).
    private const NOT_GENERATED_OUTCOMES = array('failed', 'skipped');

    // The daily cleanup removes saved state for runs that ended, or that have
    // made no progress for this long (3 days).
    private const STATE_RETENTION_SECONDS = 259200;

    // Upper bound of saved runs one cleanup pass inspects.
    private const CLEANUP_BATCH = 200;

    // Statuses after which a run never processes another image.
    private const TERMINAL_STATUSES = array('completed', 'cancelled', 'cancelling', 'stopped_no_credits', 'stopped_error');

    // Images per page in the "Selected" picker.
    private const SELECTION_PAGE_SIZE = 40;

    /**
     * Constructor
     */
    public function __construct($register_hooks = true)
    {
        // Helper instances (see get_active_run_for_page()) must not register
        // the AJAX handlers a second time.
        if (!$register_hooks) {
            return;
        }

        add_action('wp_ajax_alt_text_pro_bulk_start', array($this, 'ajax_start_bulk_process'));
        add_action('wp_ajax_alt_text_pro_bulk_status', array($this, 'ajax_get_bulk_status'));
        add_action('wp_ajax_alt_text_pro_bulk_process_batch', array($this, 'ajax_process_batch'));
        add_action('wp_ajax_alt_text_pro_bulk_skip_failed_image', array($this, 'ajax_skip_failed_image'));
        add_action('wp_ajax_alt_text_pro_bulk_cancel', array($this, 'ajax_cancel_bulk_process'));
        add_action('wp_ajax_alt_text_pro_bulk_list_images', array($this, 'ajax_list_images'));
        add_action('wp_ajax_alt_text_pro_bulk_estimate', array($this, 'ajax_estimate'));
        add_action('wp_ajax_alt_text_pro_bulk_set_mode', array($this, 'ajax_set_mode'));
        add_action('wp_ajax_alt_text_pro_bulk_run_items', array($this, 'ajax_run_items'));
        add_action('wp_ajax_alt_text_pro_bulk_undo_run', array($this, 'ajax_undo_run'));
        add_action(self::BACKGROUND_HOOK, array(__CLASS__, 'run_background_tick'));
    }

    /**
     * The site's live bulk run for the Bulk page: lets the user who started
     * it resume after a reload, and lets other administrators see and
     * cancel it. Null when no run is going.
     *
     * @return array|null
     */
    public static function get_active_run_for_page()
    {
        $processor = new self(false);
        $marker = $processor->get_live_active_run();
        if (!$marker) {
            return null;
        }

        $process_id = (string) $marker['process_id'];
        $process_data = $processor->get_bulk_process_data($process_id, true, true);
        if (!is_array($process_data)) {
            return null;
        }

        $owner_id = intval($process_data['user_id'] ?? 0);
        $is_owner = $owner_id === get_current_user_id();
        $owner = get_userdata($owner_id);
        $is_background = $processor->is_background_run($process_id);
        $idle_seconds = $processor->get_idle_seconds($process_data);

        return array(
            'mode' => $is_background ? 'background' : 'foreground',
            // A tab-driven run that stopped moving (tab closed or reloaded).
            'is_paused' => !$is_background && $idle_seconds > self::PAUSED_AFTER_SECONDS,
            'idle_seconds' => $idle_seconds,
            'last_activity' => $idle_seconds > 0 ? human_time_diff(time() - $idle_seconds, time()) : '',
            // Only the user who started the run gets its token back.
            'process_id' => $is_owner ? $process_id : '',
            'is_owner' => $is_owner,
            'can_cancel' => $is_owner || current_user_can('manage_options'),
            'cancel_ref' => current_user_can('manage_options') || $is_owner ? self::get_cancel_reference($process_id) : '',
            'started_by' => $owner ? $owner->display_name : '',
            'started_at' => (string) ($process_data['started_at'] ?? ''),
            'status' => (string) ($process_data['status'] ?? 'running'),
            'processed' => intval($process_data['processed'] ?? 0),
            'processable_images' => intval($process_data['processable_images'] ?? count($process_data['images'] ?? array())),
        );
    }

    /**
     * Script and styles for the Bulk, Review and Logs pages (estimate,
     * filters, background runs, recent runs and undo, review actions).
     */
    public static function enqueue_page_assets()
    {
        wp_enqueue_style(
            'alt-text-pro-bulk-tools',
            ALT_TEXT_PRO_PLUGIN_URL . 'assets/css/bulk-tools.css',
            array('alt-text-pro-admin'),
            ALT_TEXT_PRO_VERSION
        );
        wp_enqueue_script(
            'alt-text-pro-bulk-tools',
            ALT_TEXT_PRO_PLUGIN_URL . 'assets/js/bulk-tools.js',
            array('jquery', 'alt-text-pro-admin'),
            ALT_TEXT_PRO_VERSION,
            true
        );
        wp_localize_script('alt-text-pro-bulk-tools', 'altTextProBulkTools', array(
            'strings' => self::get_js_strings(),
        ));
    }

    /**
     * Translated text for bulk-tools.js and the bulk parts of admin.js.
     *
     * @return array<string, string>
     */
    private static function get_js_strings()
    {
        return array(
            // translators: 1: suggestions waiting, 2: those that replace existing alt text.
            'approveAllConfirm' => __('Approve all %1$s suggestions as written? %2$s of them replace alt text the image already has. Edits you typed but did not approve are ignored.', 'alt-text-pro'),
            // translators: %s: number of suggestions approved.
            'approveAllDone' => __('%s suggestions approved.', 'alt-text-pro'),
            'backgroundNote' => __('Running in the background with WP-Cron. You can close this tab. WP-Cron runs when someone visits the site (or on your host\'s schedule), so progress can pause on a quiet site.', 'alt-text-pro'),
            'backgroundState' => __('Background', 'alt-text-pro'),
            'backgroundStatus' => __('Running in the background', 'alt-text-pro'),
            'backgroundTask' => __('Images are processed in the background a few at a time.', 'alt-text-pro'),
            // translators: %s: number of images whose alt text the run replaces.
            'confirmReplace' => __('%s images in this run already have alt text, and the run will replace it. The old alt text is saved, so you can undo the run from Recent runs.', 'alt-text-pro'),
            // translators: 1: images the credits cover, 2: images in the run.
            'confirmShort' => __('You have credits for %1$s of the %2$s images, so the run will stop after %1$s images.', 'alt-text-pro'),
            'confirmStart' => __('Start the run?', 'alt-text-pro'),
            'estimateCapped' => __('One run takes the newest 20,000 images; start another run afterwards for older ones.', 'alt-text-pro'),
            // translators: 1: credits (images) the run uses, 2: estimated time such as "5 minutes".
            'estimateFull' => __('This run will use about %1$s credits (1 per image) and take about %2$s.', 'alt-text-pro'),
            'estimateNone' => __('No images match these choices, so this run would use no credits.', 'alt-text-pro'),
            // translators: %s: number of images that already have alt text.
            'estimateReplace' => __('%s of these images already have alt text, which will be replaced (you can undo the run).', 'alt-text-pro'),
            // translators: %s: number of images that already have alt text.
            'estimateReplaceReview' => __('%s of these images already have alt text; new suggestions replace it only when you approve them.', 'alt-text-pro'),
            'estimateReview' => __('The new alt text waits on the Review page until you approve it.', 'alt-text-pro'),
            'estimateSelectFirst' => __('Select images to see what the run will cost.', 'alt-text-pro'),
            // translators: 1: matching images, 2: images the credits cover, 3: estimated time.
            'estimateShort' => __('%1$s images match, but you have credits for %2$s. The run will stop after %2$s images (about %3$s) and use about %2$s credits.', 'alt-text-pro'),
            // translators: %s: estimated time such as "5 minutes".
            'estimatedTimeLog' => __('Estimated time: about %s.', 'alt-text-pro'),
            // translators: %d: number of filters in use.
            'filtersActive' => __('(%d active)', 'alt-text-pro'),
            'foregroundNote' => __('This tab is running the bulk job. Keep it open, or let it keep going in the background.', 'alt-text-pro'),
            // translators: %s: number of images.
            'imagesCount' => __('%s images', 'alt-text-pro'),
            'movedToBackground' => __('The run keeps going in the background. You can close this tab; you will get an email when it finishes if completion emails are on.', 'alt-text-pro'),
            'movedToTab' => __('The run continues in this tab. Keep it open.', 'alt-text-pro'),
            'reviewEmpty' => __('Alt text cannot be empty. Reject the suggestion instead.', 'alt-text-pro'),
            // translators: %s: number of suggestions.
            'reviewRemaining' => __('%s suggestions are waiting for review.', 'alt-text-pro'),
            // translators: %s: number of suggestions (1).
            'reviewRemainingOne' => __('%s suggestion is waiting for review.', 'alt-text-pro'),
            'runInTab' => __('Run in this tab instead', 'alt-text-pro'),
            // translators: %d: number of images listed.
            'runItemsLimit' => __('The first %d are listed. Logs and the CSV export have all of them.', 'alt-text-pro'),
            'runItemsNone' => __('No failed or skipped images were recorded for this run.', 'alt-text-pro'),
            'statusSuggested' => __('Saved for review', 'alt-text-pro'),
            // translators: %s: number of images the run changed.
            'undoConfirm' => __('Undo this run? Up to %s images get back the alt text they had before it. Images whose alt text was changed since keep the newer text. No credits are used.', 'alt-text-pro'),
            // translators: 1: images restored, 2: images kept because they changed after the run.
            'undoDone' => __('Done. %1$s images got their previous alt text back. %2$s kept their alt text because it was changed after the run.', 'alt-text-pro'),
            'undoing' => __('Undoing the run...', 'alt-text-pro'),
            // translators: %s: number of images that could not be changed.
            'undoNotAllowed' => __('%s images were skipped because you cannot edit them.', 'alt-text-pro'),
            // translators: %s: number of images restored so far.
            'undoProgress' => __('Undoing the run... %s images restored so far.', 'alt-text-pro'),
            // translators: %s: number of suggestions withdrawn.
            'undoWithdrawn' => __('%s suggestions waiting for review were withdrawn.', 'alt-text-pro'),
        );
    }

    /**
     * Opaque reference another administrator uses to cancel a run without
     * receiving its process token.
     */
    private static function get_cancel_reference($process_id)
    {
        return hash_hmac('sha256', (string) $process_id, wp_salt('nonce'));
    }

    /**
     * Start bulk processing
     */
    public function ajax_start_bulk_process()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            AltTextPro::send_permission_error();
        }

        // Keep each AJAX batch to one billable image so a user-initiated cancel
        // cannot be hidden behind a larger already-running batch.
        $batch_size = 1;
        $overwrite_existing = isset($_POST['overwrite_existing']) ? (bool) sanitize_text_field(wp_unslash($_POST['overwrite_existing'])) : false;
        $process_type = isset($_POST['process_type']) ? sanitize_text_field(wp_unslash($_POST['process_type'])) : 'missing'; // 'missing', 'all', or 'selected'
        $selected_images = isset($_POST['selected_images']) ? array_slice(array_map('intval', (array) $_POST['selected_images']), 0, self::MAX_BULK_QUEUE) : array();
        // Date, "attached to" and category filters (sanitized in parse_filters()).
        // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- each field is sanitized in parse_filters()
        $filters = self::parse_filters(isset($_POST['filters']) ? wp_unslash($_POST['filters']) : array());
        // Continue with WP-Cron instead of this browser tab.
        $background = !empty($_POST['background']);

        if ($this->get_live_active_run()) {
            wp_send_json_error(esc_html__('Another bulk run is already in progress on this site. Wait for it to finish or cancel it before starting a new one.', 'alt-text-pro'));
        }

        // "All" without overwrite is the same set as "missing"; use the
        // filtered query instead of re-checking every image's metadata in PHP.
        if ($process_type === 'all' && empty($overwrite_existing)) {
            $process_type = 'missing';
        }

        // Images picked one by one are regenerated even when they already
        // have alt text: choosing them is the request to replace it.
        if ($process_type === 'selected') {
            $overwrite_existing = true;
        }

        // Get images to process based on process type
        if ($process_type === 'selected' && !empty($selected_images)) {
            // Process only selected images. For selected images, we always include them regardless of alt-text
            // unless user explicitly wants to filter them (not currently exposed in UI for selected)
            $images_to_process = $this->get_selected_images($selected_images, true);
        } elseif ($process_type === 'all') {
            // Process all images (regardless of alt-text status)
            $images_to_process = $this->get_images_without_alt_text(true, $filters); // true = include all images
        } else {
            // Default: Process only images missing alt-text
            $images_to_process = $this->get_images_without_alt_text(false, $filters); // false = only images without alt-text
        }

        // The queries already return unique, editable IDs: "missing" filters
        // out existing alt text in SQL, "all" (with overwrite) takes every
        // image, and "selected" is filtered by get_selected_images().
        $images_to_process = array_values(array_unique(array_map('intval', (array) $images_to_process)));
        $queue_capped = count($images_to_process) >= self::MAX_BULK_QUEUE;

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
            if (!empty($usage_stats['stop_bulk']) || !empty($usage_stats['code'])) {
                wp_send_json_error(array(
                    'message' => $usage_stats['message'] ?? esc_html__('Failed to check credits. Please verify your API key.', 'alt-text-pro'),
                    'code' => sanitize_key((string) ($usage_stats['code'] ?? 'usage_unavailable')),
                ));
            }
            wp_send_json_error(esc_html__('Failed to check credits. Please verify your API key.', 'alt-text-pro'));
        }

        $credit_limits = self::get_run_credit_limits(is_array($usage_stats['data'] ?? null) ? $usage_stats['data'] : array());
        $credits_remaining = $credit_limits['credits_remaining'];
        $monthly_credits_used = $credit_limits['plan_credits_used'];
        $plan_allowance = $credit_limits['plan_allowance'];
        $credit_limit_for_run = $credit_limits['run_limit'];

        if ($credits_remaining <= 0) {
            wp_send_json_error(array(
                'message' => __('No credits remaining. Buy a credit pack or upgrade your plan at alt-text.pro before starting bulk processing.', 'alt-text-pro'),
                'code' => 'no_credits',
            ));
        }

        $total_images = count($images_to_process);
        $processable_images = min($total_images, $credit_limit_for_run);

        if ($processable_images <= 0) {
            wp_send_json_error(array(
                'message' => __('No plan credits remaining for this billing cycle. Buy a credit pack or upgrade your plan at alt-text.pro, or wait for your next credit refill before starting bulk processing.', 'alt-text-pro'),
                'code' => 'no_credits',
            ));
        }

        // Create bulk process record
        $process_id = $this->create_bulk_process_record($images_to_process, $batch_size, $overwrite_existing, $credits_remaining, $processable_images, $plan_allowance, $monthly_credits_used, array('filters' => $filters));

        if (!$this->claim_active_run($process_id)) {
            // Another request started a run between the check above and now.
            $this->delete_bulk_process_state($process_id);
            delete_transient('alt_text_pro_bulk_' . $process_id);
            wp_send_json_error(esc_html__('Another bulk run is already in progress on this site. Wait for it to finish or cancel it before starting a new one.', 'alt-text-pro'));
        }

        if ($background) {
            $this->set_background_mode($process_id, true);
        }

        wp_send_json_success(array(
            'process_id' => $process_id,
            'mode' => $background ? 'background' : 'foreground',
            'total_images' => $total_images,
            'queue_total_images' => $total_images,
            'processable_images' => $processable_images,
            'credits_remaining' => $credits_remaining,
            'plan_allowance' => $plan_allowance,
            'plan_credits_used' => $monthly_credits_used,
            'plan_credits_remaining' => $credit_limit_for_run,
            'batch_size' => $batch_size,
            'queue_capped' => $queue_capped,
            'queue_cap' => self::MAX_BULK_QUEUE,
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
            AltTextPro::send_permission_error();
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
            AltTextPro::send_permission_error();
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

        // A run continuing in the background is driven by WP-Cron only; an
        // open tab just shows its progress.
        if (in_array($process_data['status'] ?? '', self::TERMINAL_STATUSES, true) || $this->is_background_run($process_id)) {
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
            AltTextPro::send_permission_error();
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
            if (in_array($status, self::TERMINAL_STATUSES, true)) {
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

            $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS * 2);

            $batch_result = array(
                'id' => $image_id,
                'status' => 'error',
                'error' => $error_message
            );
            if ($can_edit_image) {
                $batch_result['filename'] = basename((string) get_attached_file($image_id));
            }
            $this->log_batch_outcomes(self::get_run_ref($process_data), array($batch_result));

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
            AltTextPro::send_permission_error();
        }

        $process_id = isset($_POST['process_id']) ? sanitize_text_field(wp_unslash($_POST['process_id'])) : '';
        $cancel_ref = isset($_POST['cancel_ref']) ? sanitize_key(wp_unslash($_POST['cancel_ref'])) : '';

        // An administrator may stop a run another user started (for example
        // one left running in a closed tab). They send the opaque reference
        // from the Bulk page, never the other user's process token.
        if ($process_id === '' && $cancel_ref !== '') {
            if (!current_user_can('manage_options')) {
                AltTextPro::send_permission_error();
            }

            $marker = $this->get_live_active_run();
            if (!$marker || !hash_equals(self::get_cancel_reference((string) $marker['process_id']), $cancel_ref)) {
                wp_send_json_error(esc_html__('This bulk run has already finished.', 'alt-text-pro'));
            }

            $this->cancel_bulk_process((string) $marker['process_id'], true);
            wp_send_json_success(array('status' => 'cancelled', 'cancelled_by_admin' => true));
        }

        if (!$this->cancel_bulk_process($process_id)) {
            wp_send_json_error(esc_html__('Process not found.', 'alt-text-pro'));
        }

        wp_send_json_success($this->get_bulk_process_status($process_id));
    }

    /**
     * "Selected" mode picker: one page of images, searchable, including
     * images that already have alt text so they can be regenerated.
     */
    public function ajax_list_images()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            AltTextPro::send_permission_error();
        }

        global $wpdb;

        $page = isset($_POST['page']) ? max(1, absint($_POST['page'])) : 1;
        $search = isset($_POST['search']) ? trim(sanitize_text_field(wp_unslash($_POST['search']))) : '';
        $filter = isset($_POST['filter']) ? sanitize_key(wp_unslash($_POST['filter'])) : 'missing';
        $offset = ($page - 1) * self::SELECTION_PAGE_SIZE;
        // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- each field is sanitized in parse_filters()
        $filters = self::parse_filters(isset($_POST['filters']) ? wp_unslash($_POST['filters']) : array());

        $where = "p.post_type = 'attachment'"
            . AltTextPro_API_Client::get_supported_mime_sql_clause('p')
            . self::get_editable_media_sql_clause('p')
            . self::get_filter_sql($filters, 'p');

        if ($search !== '') {
            $like = '%' . $wpdb->esc_like($search) . '%';
            $where .= $wpdb->prepare(' AND (p.post_title LIKE %s OR alt.meta_value LIKE %s)', $like, $like);
        }

        if ($filter === 'missing') {
            $where .= " AND (alt.meta_value IS NULL OR TRIM(alt.meta_value) = '')";
        } elseif ($filter === 'has_alt') {
            $where .= " AND alt.meta_value IS NOT NULL AND TRIM(alt.meta_value) != ''";
        }

        $from = "FROM {$wpdb->posts} p
             LEFT JOIN {$wpdb->postmeta} alt ON (p.ID = alt.post_id AND alt.meta_key = '_wp_attachment_image_alt')
             WHERE {$where}";

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- every variable fragment is prepared above
        $total = (int) $wpdb->get_var("SELECT COUNT(DISTINCT p.ID) {$from}");

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT p.ID, p.post_title, MAX(alt.meta_value) AS alt_text {$from}
             GROUP BY p.ID, p.post_title, p.post_date
             ORDER BY p.post_date DESC, p.ID DESC
             LIMIT %d OFFSET %d",
            self::SELECTION_PAGE_SIZE,
            $offset
        ));

        $images = array();
        foreach ((array) $rows as $row) {
            $alt_text = trim((string) $row->alt_text);
            $images[] = array(
                'id' => intval($row->ID),
                'title' => $row->post_title !== ''
                    ? wp_strip_all_tags(html_entity_decode((string) $row->post_title, ENT_QUOTES | ENT_HTML5, 'UTF-8'))
                    /* translators: %d: attachment ID */
                    : sprintf(__('Image #%d', 'alt-text-pro'), intval($row->ID)),
                'thumb' => (string) wp_get_attachment_image_url(intval($row->ID), 'thumbnail'),
                'alt' => $alt_text,
                'has_alt' => $alt_text !== '',
            );
        }

        wp_send_json_success(array(
            'images' => $images,
            'page' => $page,
            'total' => $total,
            'total_pages' => max(1, (int) ceil($total / self::SELECTION_PAGE_SIZE)),
        ));
    }

    /**
     * What a run with the current Bulk page choices would cost: images it
     * would process, how many of them already have alt text (replaced when
     * overwriting), and the time estimate. Read-only; no credits involved.
     */
    public function ajax_estimate()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            AltTextPro::send_permission_error();
        }

        $process_type = isset($_POST['process_type']) ? sanitize_key(wp_unslash($_POST['process_type'])) : 'missing';
        $overwrite = !empty($_POST['overwrite_existing']);
        // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- each field is sanitized in parse_filters()
        $filters = self::parse_filters(isset($_POST['filters']) ? wp_unslash($_POST['filters']) : array());
        // Credits a run may use, as shown on the page (display only; the
        // run itself checks the account again when it starts).
        $credit_limit = isset($_POST['credit_limit']) && $_POST['credit_limit'] !== '' ? max(0, intval($_POST['credit_limit'])) : null;

        $counts = self::count_images($filters);
        $with_alt = 0;

        if ($process_type === 'selected') {
            $selected = isset($_POST['selected_images']) ? array_slice(array_map('intval', (array) $_POST['selected_images']), 0, self::MAX_BULK_QUEUE) : array();
            $ids = !empty($selected) ? $this->get_selected_images($selected, true) : array();
            $images = count($ids);
            $with_alt = $this->count_images_with_alt($ids);
        } elseif ($process_type === 'all' && $overwrite) {
            $images = $counts['all'];
            $with_alt = max(0, $counts['all'] - $counts['missing']);
        } else {
            $images = $counts['missing'];
        }

        $images = min($images, self::MAX_BULK_QUEUE);
        $with_alt = min($with_alt, $images);
        $will_process = $credit_limit === null ? $images : min($images, $credit_limit);

        wp_send_json_success(array(
            'counts' => $counts,
            'images' => $images,
            'with_alt' => $with_alt,
            'will_process' => $will_process,
            'credit_limit' => $credit_limit,
            'estimated_time' => $this->estimate_processing_time($will_process),
            'queue_capped' => $images >= self::MAX_BULK_QUEUE,
            'review_mode' => class_exists('AltTextPro_Review') && AltTextPro_Review::is_enabled(),
        ));
    }

    /**
     * How many of these images already have alt text.
     *
     * @param int[] $image_ids Attachment IDs.
     */
    private function count_images_with_alt(array $image_ids)
    {
        global $wpdb;

        $count = 0;
        foreach (array_chunk(array_values(array_filter(array_map('intval', $image_ids))), 1000) as $chunk) {
            $placeholders = implode(',', array_fill(0, count($chunk), '%d'));
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- placeholders match the values
            $count += (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(DISTINCT post_id) FROM {$wpdb->postmeta}
                 WHERE meta_key = '_wp_attachment_image_alt' AND TRIM(meta_value) != '' AND post_id IN ({$placeholders})",
                $chunk
            ));
        }

        return $count;
    }

    /**
     * Switch the current user's run between "keep going in the background"
     * (WP-Cron) and this tab.
     */
    public function ajax_set_mode()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            AltTextPro::send_permission_error();
        }

        $process_id = isset($_POST['process_id']) ? sanitize_text_field(wp_unslash($_POST['process_id'])) : '';
        $mode = isset($_POST['mode']) ? sanitize_key(wp_unslash($_POST['mode'])) : '';
        $process_data = $this->get_bulk_process_data($process_id, true);

        if (!$process_data || !in_array($mode, array('background', 'foreground'), true)) {
            wp_send_json_error(esc_html__('Process not found.', 'alt-text-pro'));
        }

        if (($process_data['status'] ?? '') !== 'running') {
            wp_send_json_error(esc_html__('This bulk run has already finished.', 'alt-text-pro'));
        }

        $this->set_background_mode($process_id, $mode === 'background');
        wp_send_json_success($this->get_bulk_process_status($process_id));
    }

    /**
     * Latest finished runs the current user may see: their own, or every
     * run for administrators. Counts come from the logs table.
     *
     * @return array[]
     */
    public static function get_recent_runs_for_page()
    {
        global $wpdb;

        $history = get_option(self::RUN_HISTORY_OPTION, array());
        $history = is_array($history) ? $history : array();
        $runs = array();

        foreach ($history as $entry) {
            if (is_array($entry) && !empty($entry['ref']) && self::can_access_run($entry)) {
                $runs[$entry['ref']] = $entry;
            }
        }

        if (empty($runs)) {
            return array();
        }

        $counts = array();
        if (self::log_columns_ready()) {
            $refs = array_keys($runs);
            $placeholders = implode(',', array_fill(0, count($refs), '%s'));
            $logs_table = $wpdb->prefix . 'alt_text_pro_logs';
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- placeholders match the values
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT run_ref, outcome, COUNT(*) AS total FROM {$logs_table} WHERE run_ref IN ({$placeholders}) GROUP BY run_ref, outcome",
                $refs
            ));
            foreach ((array) $rows as $row) {
                $counts[(string) $row->run_ref][(string) $row->outcome] = (int) $row->total;
            }
        }

        $active_ref = self::get_active_run_ref();
        foreach ($runs as $ref => $entry) {
            $run_counts = wp_parse_args($counts[$ref] ?? array(), array(
                'generated' => 0,
                'suggested' => 0,
                'failed' => 0,
                'skipped' => 0,
                'undone' => 0,
                'rejected' => 0,
            ));
            $owner = get_userdata(intval($entry['user_id'] ?? 0));
            $runs[$ref]['counts'] = $run_counts;
            $runs[$ref]['started_by'] = $owner ? $owner->display_name : '';
            $runs[$ref]['can_undo'] = $ref !== $active_ref && ($run_counts['generated'] + $run_counts['suggested']) > 0;
        }

        return array_values($runs);
    }

    /**
     * Reference of the run that holds the site's run slot, '' when none.
     */
    private static function get_active_run_ref()
    {
        $marker = get_option(self::ACTIVE_RUN_OPTION, null);

        return is_array($marker) && !empty($marker['process_id'])
            ? substr(hash('sha256', (string) $marker['process_id']), 0, 20)
            : '';
    }

    /**
     * The run's owner and administrators may see and undo a run.
     *
     * @param array $entry Run history entry.
     */
    private static function can_access_run(array $entry)
    {
        return current_user_can('upload_files')
            && (current_user_can('manage_options') || intval($entry['user_id'] ?? 0) === get_current_user_id());
    }

    /**
     * Run history entry by reference, when the current user may access it.
     *
     * @return array|null
     */
    private static function find_accessible_run($ref)
    {
        if (!is_string($ref) || !preg_match('/^[a-f0-9]{20}$/', $ref)) {
            return null;
        }

        $history = get_option(self::RUN_HISTORY_OPTION, array());
        foreach (is_array($history) ? $history : array() as $entry) {
            if (is_array($entry) && ($entry['ref'] ?? '') === $ref) {
                return self::can_access_run($entry) ? $entry : null;
            }
        }

        return null;
    }

    /**
     * Failed and skipped images of a finished run, with the reason.
     */
    public function ajax_run_items()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            AltTextPro::send_permission_error();
        }

        $ref = isset($_POST['run_ref']) ? sanitize_key(wp_unslash($_POST['run_ref'])) : '';
        if (!self::find_accessible_run($ref)) {
            AltTextPro::send_permission_error();
        }

        if (!self::log_columns_ready()) {
            wp_send_json_success(array('items' => array(), 'limit' => self::RUN_ITEMS_LIMIT));
        }

        global $wpdb;
        $logs_table = $wpdb->prefix . 'alt_text_pro_logs';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table names come from $wpdb
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT l.attachment_id, l.outcome, l.outcome_reason, p.post_title
             FROM {$logs_table} l
             LEFT JOIN {$wpdb->posts} p ON p.ID = l.attachment_id
             WHERE l.run_ref = %s AND l.outcome IN ('failed', 'skipped')
             ORDER BY l.outcome ASC, l.id ASC
             LIMIT %d",
            $ref,
            self::RUN_ITEMS_LIMIT
        ));

        $items = array();
        foreach ((array) $rows as $row) {
            $attachment_id = intval($row->attachment_id);
            $title = trim(wp_strip_all_tags(html_entity_decode((string) $row->post_title, ENT_QUOTES | ENT_HTML5, 'UTF-8')));
            $items[] = array(
                'id' => $attachment_id,
                /* translators: %d: attachment ID */
                'title' => $title !== '' ? $title : sprintf(__('Image #%d', 'alt-text-pro'), $attachment_id),
                'outcome' => (string) $row->outcome,
                'reason' => (string) $row->outcome_reason,
                'edit_url' => current_user_can('edit_post', $attachment_id) ? get_edit_post_link($attachment_id, 'raw') : '',
            );
        }

        wp_send_json_success(array('items' => $items, 'limit' => self::RUN_ITEMS_LIMIT));
    }

    /**
     * Undo a finished run in chunks: put back the alt text each image had
     * before the run, only where the alt text is still exactly what the run
     * wrote. Suggestions of the run still waiting for review are withdrawn.
     * No credits are involved.
     */
    public function ajax_undo_run()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            AltTextPro::send_permission_error();
        }

        $ref = isset($_POST['run_ref']) ? sanitize_key(wp_unslash($_POST['run_ref'])) : '';
        $after_id = isset($_POST['after_id']) ? absint($_POST['after_id']) : 0;

        if (!self::find_accessible_run($ref)) {
            AltTextPro::send_permission_error();
        }

        if ($ref === self::get_active_run_ref()) {
            wp_send_json_error(esc_html__('This run is still active. Stop it or let it finish before undoing it.', 'alt-text-pro'));
        }

        if (!self::log_columns_ready()) {
            wp_send_json_error(esc_html__('This run cannot be undone because its history was not saved.', 'alt-text-pro'));
        }

        global $wpdb;
        $logs_table = $wpdb->prefix . 'alt_text_pro_logs';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name comes from $wpdb
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, attachment_id, alt_text, previous_alt, outcome
             FROM {$logs_table}
             WHERE run_ref = %s AND outcome IN ('generated', 'suggested') AND id > %d
             ORDER BY id ASC
             LIMIT %d",
            $ref,
            $after_id,
            self::UNDO_CHUNK
        ));
        $rows = (array) $rows;

        $result = array('restored' => 0, 'changed' => 0, 'not_allowed' => 0, 'withdrawn' => 0);
        $last_id = $after_id;

        foreach ($rows as $row) {
            $log_id = intval($row->id);
            $attachment_id = intval($row->attachment_id);
            $last_id = max($last_id, $log_id);

            if (!current_user_can('edit_post', $attachment_id)) {
                $result['not_allowed']++;
                continue;
            }

            if ($row->outcome === 'suggested') {
                // Still waiting for review: withdraw the suggestion.
                $suggestion = class_exists('AltTextPro_Review') ? AltTextPro_Review::get_suggestion($attachment_id) : null;
                if ($suggestion && intval($suggestion['log_id'] ?? 0) === $log_id) {
                    delete_post_meta($attachment_id, AltTextPro_Review::META);
                    self::update_log_outcome($log_id, 'rejected', __('Withdrawn by undoing the run.', 'alt-text-pro'));
                    $result['withdrawn']++;
                }
                continue;
            }

            if ($row->previous_alt === null) {
                $result['changed']++;
                continue;
            }

            $current_alt = (string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
            if ($current_alt !== (string) $row->alt_text) {
                // Edited since the run: keep the newer alt text.
                $result['changed']++;
                continue;
            }

            if ((string) $row->previous_alt === '') {
                delete_post_meta($attachment_id, '_wp_attachment_image_alt');
            } else {
                update_post_meta($attachment_id, '_wp_attachment_image_alt', wp_slash((string) $row->previous_alt));
            }
            self::update_log_outcome($log_id, 'undone', '');
            $result['restored']++;
        }

        $done = count($rows) < self::UNDO_CHUNK;
        $this->record_undo($ref, $result, $done);

        wp_send_json_success(array_merge($result, array(
            'done' => $done,
            'after_id' => $last_id,
        )));
    }

    /**
     * Change the outcome of one log row (approve, reject, undo).
     *
     * @param int    $log_id  Log row ID.
     * @param string $outcome New outcome.
     * @param string $reason  Reason shown in Logs and the CSV.
     * @param array  $fields  Other columns to set (alt_text, previous_alt).
     */
    public static function update_log_outcome($log_id, $outcome, $reason = '', array $fields = array())
    {
        global $wpdb;

        if (!$log_id || !self::log_columns_ready()) {
            return;
        }

        $data = array('outcome' => sanitize_key($outcome), 'outcome_reason' => (string) $reason);
        foreach (array('alt_text', 'previous_alt') as $column) {
            if (array_key_exists($column, $fields)) {
                $data[$column] = (string) $fields[$column];
            }
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->update($wpdb->prefix . 'alt_text_pro_logs', $data, array('id' => intval($log_id)), array_fill(0, count($data), '%s'), array('%d'));
    }

    /**
     * Add one undo request's counts to the run's history entry.
     */
    private function record_undo($ref, array $result, $done)
    {
        $history = get_option(self::RUN_HISTORY_OPTION, array());
        if (!is_array($history)) {
            return;
        }

        foreach ($history as $index => $entry) {
            if (!is_array($entry) || ($entry['ref'] ?? '') !== $ref) {
                continue;
            }
            foreach ($result as $key => $count) {
                $history[$index]['undo_' . $key] = intval($entry['undo_' . $key] ?? 0) + intval($count);
            }
            if ($done) {
                $history[$index]['undone_at'] = current_time('mysql');
            }
            update_option(self::RUN_HISTORY_OPTION, $history, false);
            return;
        }
    }

    /**
     * Process batch synchronously (for immediate processing)
     */
    public function process_batch_sync($process_id, $batch_offset)
    {
        $run_ref = $this->get_run_ref_for($process_id);
        $batch_results = $this->process_batch_background($process_id, $batch_offset);

        // Failed and skipped images go to the logs table with the run, so the
        // Bulk page, the Logs page and the CSV keep them after a reload.
        $this->log_batch_outcomes($run_ref, is_array($batch_results) ? $batch_results : array());

        return $batch_results;
    }

    /**
     * Run reference of a run the current user can read, '' when unknown.
     */
    private function get_run_ref_for($process_id)
    {
        $process_data = $this->get_bulk_process_data($process_id, true);
        return is_array($process_data) ? self::get_run_ref($process_data) : '';
    }

    /**
     * Short, non-secret reference of a run, stored with its log rows. Runs
     * started before 1.7.28 get the same value from their ID.
     */
    private static function get_run_ref(array $process_data)
    {
        if (!empty($process_data['run_ref']) && is_string($process_data['run_ref'])) {
            return $process_data['run_ref'];
        }

        return substr(hash('sha256', (string) ($process_data['id'] ?? '')), 0, 20);
    }

    /**
     * Record failed and skipped images of one batch in the logs table.
     *
     * @param string  $run_ref       Run reference.
     * @param array[] $batch_results Results returned to the browser.
     */
    private function log_batch_outcomes($run_ref, array $batch_results)
    {
        foreach ($batch_results as $result) {
            $status = is_array($result) ? (string) ($result['status'] ?? '') : '';
            $image_id = is_array($result) ? intval($result['id'] ?? 0) : 0;
            if ($image_id <= 0 || !in_array($status, array('error', 'skipped'), true)) {
                continue;
            }

            self::write_log($image_id, '', 0, array(
                'outcome' => $status === 'error' ? 'failed' : 'skipped',
                'outcome_reason' => (string) ($status === 'error' ? ($result['error'] ?? '') : ($result['reason'] ?? '')),
                'run_ref' => $run_ref,
            ));
        }
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
            $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS * 2);
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
            // wp_attachment_is_image() is false for SVG and other non-raster files.
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
                    'filename' => basename((string) get_attached_file($image_id)),
                    'status' => 'skipped',
                    'reason' => __('Already done earlier in this run.', 'alt-text-pro')
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
                        'filename' => basename((string) get_attached_file($image_id)),
                        'status' => 'skipped',
                        'reason' => __('Already has alt text.', 'alt-text-pro')
                    );
                    continue;
                }
            }

            // Marked decorative (empty alt on purpose) or waiting on the
            // Review page since the run was queued: never describe or bill
            // it again.
            $skip_reason = '';
            if ((string) get_post_meta($image_id, self::DECORATIVE_META, true) === '1') {
                $skip_reason = __('Marked as decorative.', 'alt-text-pro');
            } elseif (class_exists('AltTextPro_Review') && AltTextPro_Review::has_suggestion($image_id)) {
                $skip_reason = __('Suggested alt text is waiting for review.', 'alt-text-pro');
            }
            if ($skip_reason !== '') {
                $skipped++;
                $processed++;
                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename((string) get_attached_file($image_id)),
                    'status' => 'skipped',
                    'reason' => $skip_reason
                );
                continue;
            }

            // The automatic generation of a fresh upload is describing this
            // image right now: let it finish instead of paying twice.
            if (class_exists('AltTextPro_Media_Handler') && AltTextPro_Media_Handler::is_upload_generation_running($image_id)) {
                $skipped++;
                $processed++;
                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename((string) get_attached_file($image_id)),
                    'status' => 'skipped',
                    'reason' => __('Being described by automatic generation for the upload.', 'alt-text-pro')
                );
                continue;
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

            // This run describes the image now, so a queued upload job for it
            // must not bill it again.
            if (class_exists('AltTextPro_Media_Handler')) {
                AltTextPro_Media_Handler::claim_pending_upload($image_id);
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
                    'filename' => basename((string) get_attached_file($image_id)),
                    'status' => 'cancelled'
                );
                break;
            }

            // The API client refuses images marked decorative (no request,
            // no credit): a skip, not a failure.
            if (empty($result['success']) && ($result['code'] ?? '') === 'decorative_image') {
                $skipped++;
                $processed++;
                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename((string) get_attached_file($image_id)),
                    'status' => 'skipped',
                    'reason' => __('Marked as decorative.', 'alt-text-pro')
                );
                continue;
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
                    'filename' => basename((string) get_attached_file($image_id)),
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

                    // The service itself keeps failing (or cannot be reached):
                    // every later image would fail the same way, so stop the
                    // run instead of trying each one three times.
                    $status_code = intval($result['status_code'] ?? 0);
                    if (!empty($result['server_error']) || $status_code === 0) {
                        $error_message = $result['message'] ?? __('The Alt Text Pro service is not responding.', 'alt-text-pro');
                        $errors[] = array(
                            'image_id' => $image_id,
                            'error' => $error_message
                        );
                        $batch_results[] = array(
                            'id' => $image_id,
                            'filename' => basename((string) get_attached_file($image_id)),
                            'status' => 'error',
                            'error' => $error_message
                        );
                        $processed++;

                        return $this->stop_bulk_process_with_error(
                            $process_id,
                            $process_data,
                            $batch_offset + $processed,
                            array_unique(array_merge($successful_image_ids, $new_successful_ids)),
                            $errors,
                            $batch_results,
                            'service_unavailable',
                            __('Bulk processing stopped because the Alt Text Pro service kept failing. The images done so far are saved; start a new run later to continue.', 'alt-text-pro')
                        );
                    }

                    $error_message = esc_html__('The Alt Text Pro service could not process this image after three attempts.', 'alt-text-pro');
                    $errors[] = array(
                        'image_id' => $image_id,
                        'error' => $error_message
                    );
                    $batch_results[] = array(
                        'id' => $image_id,
                        'filename' => basename((string) get_attached_file($image_id)),
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
                    'filename' => basename((string) get_attached_file($image_id)),
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

                $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS * 2);

                return $batch_results;
            }

            // Check if credits ran out (402 error)
            if (isset($result['no_credits']) && $result['no_credits'] === true) {
                // Credits exhausted - stop processing immediately
                $error_message = $result['message'] ?? esc_html__('No credits remaining. Buy a credit pack or upgrade your plan at alt-text.pro.', 'alt-text-pro');
                $errors[] = array(
                    'image_id' => $image_id,
                    'error' => $error_message
                );
                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename((string) get_attached_file($image_id)),
                    'status' => 'error',
                    'error' => $error_message
                );
                $processed++;

                // Mark process as stopped due to credits - MUST be set before updating progress
                $process_data['status'] = 'stopped_no_credits';
                $process_data['stopped_reason'] = sprintf(
                    // translators: %1$d: Number of processed images, %2$d: Number of successfully processed images
                    __('Credits exhausted after processing %1$d images. %2$d images successfully processed. Buy a credit pack or upgrade your plan at alt-text.pro, or wait for your next credit refill.', 'alt-text-pro'),
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
                $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS * 2);

                // Update progress
                $this->update_bulk_process_progress($process_id, $total_processed, $all_errors, $total_successful);

                // Complete process immediately
                $this->complete_bulk_process($process_id, true);

                // Return current batch results up to this point
                return $batch_results;
            }

            // Invalid key, suspended or deleted account, or forbidden: nothing
            // else in the queue can succeed, so stop the run.
            if (empty($result['success']) && !empty($result['stop_bulk'])) {
                $error_message = $result['message'] ?? __('Alt Text Pro could not use your account.', 'alt-text-pro');
                $errors[] = array(
                    'image_id' => $image_id,
                    'error' => $error_message
                );
                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename((string) get_attached_file($image_id)),
                    'status' => 'error',
                    'error' => $error_message
                );
                $processed++;

                return $this->stop_bulk_process_with_error(
                    $process_id,
                    $process_data,
                    $batch_offset + $processed,
                    array_unique(array_merge($successful_image_ids, $new_successful_ids)),
                    $errors,
                    $batch_results,
                    sanitize_key((string) ($result['code'] ?? 'account_error')),
                    $error_message
                );
            }

            if ($result['success'] && !empty($result['alt_text'])) {
                $alt_text = sanitize_text_field((string) $result['alt_text']);
                $run_ref = self::get_run_ref($process_data);
                $suggested = $alt_text !== '' && class_exists('AltTextPro_Review') && AltTextPro_Review::is_enabled();

                if ($suggested) {
                    // "Review alt text before it goes live": keep it as a
                    // suggestion; the live alt text is unchanged until approved.
                    AltTextPro_Review::store_suggestion($image_id, $alt_text, 'bulk', $run_ref, $result['credits_used'] ?? 1);
                } else {
                    // Keep the alt text this run replaces so the run can be undone.
                    $previous_alt = (string) get_post_meta($image_id, '_wp_attachment_image_alt', true);
                    update_post_meta($image_id, '_wp_attachment_image_alt', $alt_text);

                    // Log generation (only if alt_text exists)
                    if ($alt_text !== '') {
                        $this->log_generation($image_id, $alt_text, $result['credits_used'] ?? 1, array(
                            'run_ref' => $run_ref,
                            'previous_alt' => $previous_alt,
                        ));
                    }
                }

                $processed++;
                $successful++; // Only count as successful when alt-text is actually generated
                $new_successful_ids[] = $image_id; // Track this image as successfully processed in this batch

                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename((string) get_attached_file($image_id)),
                    'status' => 'success',
                    'suggested' => $suggested
                );

            } else {
                $error_message = $result['message'] ?? 'Unknown error';
                $errors[] = array(
                    'image_id' => $image_id,
                    'error' => $error_message
                );
                $batch_results[] = array(
                    'id' => $image_id,
                    'filename' => basename((string) get_attached_file($image_id)),
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
        $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS * 2);

        if ($cancelled_mid_batch) {
            $this->delete_bulk_process_state($process_id);
            return $batch_results;
        }

        // Now update progress (this will also save, but we've already saved above)
        $this->update_bulk_process_progress($process_id, $total_processed, $all_errors, $total_successful);

        // Check if processing was stopped due to credits (should not happen here as we return early, but safety check)
        if (isset($process_data['status']) && $process_data['status'] === 'stopped_no_credits') {
            // Complete process early due to credits exhaustion
            $process_data['needs_next_batch'] = false;
            $process_data['next_batch_offset'] = null;
            $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS);
            $this->complete_bulk_process($process_id, true);
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

            $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS * 2);
        } elseif ($process_data['status'] === 'running') {
            $process_data['status'] = 'completed';
            $process_data['needs_next_batch'] = false;
            $process_data['next_batch_offset'] = null;
            $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS * 2);
            $this->complete_bulk_process($process_id);
        }

        return $batch_results;
    }

    /**
     * End a run early because of an account or service problem, keeping
     * everything generated so far.
     *
     * @return array Batch results for the browser.
     */
    private function stop_bulk_process_with_error($process_id, array $process_data, $total_processed, array $successful_ids, array $new_errors, array $batch_results, $code, $reason)
    {
        $existing_errors = isset($process_data['errors']) && is_array($process_data['errors']) ? $process_data['errors'] : array();
        $all_errors = array_merge($existing_errors, $new_errors);
        $successful_ids = array_values(array_unique(array_map('intval', $successful_ids)));

        $process_data['status'] = 'stopped_error';
        $process_data['stopped_code'] = $code;
        $process_data['stopped_reason'] = (string) $reason;
        $process_data['processed'] = intval($total_processed);
        $process_data['successful'] = count($successful_ids);
        $process_data['successful_image_ids'] = $successful_ids;
        $process_data['errors'] = $all_errors;
        unset($process_data['retry_attempts'], $process_data['retry_after_seconds'], $process_data['retry_message']);
        $process_data['needs_next_batch'] = false;
        $process_data['next_batch_offset'] = null;
        $process_data['last_updated'] = current_time('mysql');

        $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS * 2);
        $this->complete_bulk_process($process_id, true);

        return $batch_results;
    }

    /**
     * Get images without alt text
     */
    private function get_images_without_alt_text($include_existing = false, array $filters = array())
    {
        global $wpdb;
        // Editable media only, without decorative or pending-review images,
        // narrowed by the Bulk page filters.
        $editable_clause = self::get_editable_media_sql_clause('p') . self::get_filter_sql($filters, 'p');
        // SVG and other non-raster files are never queued.
        $supported_mime_clause = AltTextPro_API_Client::get_supported_mime_sql_clause('p');

        if ($include_existing) {
            // Include all images regardless of alt text
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is prepared immediately after assignment
            $query = $wpdb->prepare(
                "SELECT p.ID 
                 FROM {$wpdb->posts} p 
                 WHERE p.post_type = 'attachment' 
                 {$supported_mime_clause}
                 {$editable_clause}
                 ORDER BY p.post_date DESC
                 LIMIT %d",
                self::MAX_BULK_QUEUE
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
                 {$supported_mime_clause}
                 AND pm.post_id IS NULL
                 {$editable_clause}
                 ORDER BY p.post_date DESC
                 LIMIT %d",
                self::MAX_BULK_QUEUE
            );
        }

        // The query is already limited to editable image attachments, so no
        // per-image capability check (and no loading of every post) is needed.
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery
        return array_map('intval', (array) $wpdb->get_col($query));
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
        $prepared_values = $ids_escaped;
        // Decorative and pending-review images are never queued, even when
        // picked one by one.
        $supported_mime_clause = AltTextPro_API_Client::get_supported_mime_sql_clause('p') . self::get_filter_sql(array(), 'p');

        if ($include_existing) {
            // Include all selected images regardless of alt text
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $sql = "SELECT p.ID 
                 FROM {$wpdb->posts} p 
                 WHERE p.ID IN ($ids_placeholders) 
                 AND p.post_type = 'attachment' 
                 {$supported_mime_clause}";
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
                 {$supported_mime_clause}
                 AND pm.post_id IS NULL";
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            $query = $wpdb->prepare($sql, ...$prepared_values);
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery
        return $this->filter_editable_images($wpdb->get_col($query));
    }

    /**
     * True when the current user may edit every attachment. Library-wide
     * queries can then be scoped in SQL instead of loading every post to run
     * a per-image capability check; other users are limited to their own
     * uploads, which is what they may edit.
     */
    public static function user_can_edit_all_media()
    {
        return current_user_can('edit_others_posts')
            && current_user_can('edit_published_posts')
            && current_user_can('edit_private_posts');
    }

    /**
     * SQL fragment that limits attachment queries to media the current user
     * may edit. Empty for users who can edit all media.
     */
    public static function get_editable_media_sql_clause($table_alias = 'p')
    {
        global $wpdb;

        if (self::user_can_edit_all_media()) {
            return '';
        }

        return $wpdb->prepare(" AND {$table_alias}.post_author = %d", get_current_user_id());
    }

    /**
     * Normalize the Bulk page filters: uploaded from/to (Y-m-d), the post
     * type the image is attached to, and a category of that post
     * ("taxonomy:term_id"). Anything invalid is dropped.
     *
     * @param mixed $input Raw filters (already unslashed).
     * @return array{date_from: string, date_to: string, parent_type: string, term: string}
     */
    public static function parse_filters($input)
    {
        $input = is_array($input) ? $input : array();
        $filters = array('date_from' => '', 'date_to' => '', 'parent_type' => '', 'term' => '');

        foreach (array('date_from', 'date_to') as $key) {
            $value = isset($input[$key]) ? sanitize_text_field((string) $input[$key]) : '';
            if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $parts) && checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) {
                $filters[$key] = $value;
            }
        }

        $parent_type = isset($input['parent_type']) ? sanitize_key((string) $input['parent_type']) : '';
        if ($parent_type !== '' && array_key_exists($parent_type, self::get_parent_type_options())) {
            $filters['parent_type'] = $parent_type;
        }

        $term = isset($input['term']) ? sanitize_text_field((string) $input['term']) : '';
        if (preg_match('/^([a-z_]+):(\d+)$/', $term, $parts) && array_key_exists($parts[1], self::get_filter_taxonomies()) && (int) $parts[2] > 0) {
            $filters['term'] = $parts[1] . ':' . (int) $parts[2];
        }

        return $filters;
    }

    /**
     * True when WooCommerce products can be used as a filter.
     */
    private static function has_products()
    {
        return class_exists('WooCommerce') && post_type_exists('product');
    }

    /**
     * "Attached to" choices: post type => label.
     *
     * @return array<string, string>
     */
    public static function get_parent_type_options()
    {
        $options = array(
            'post' => __('Posts', 'alt-text-pro'),
            'page' => __('Pages', 'alt-text-pro'),
        );
        if (self::has_products()) {
            $options['product'] = __('WooCommerce products', 'alt-text-pro');
        }

        return $options;
    }

    /**
     * Taxonomies offered in the category filter: taxonomy => label.
     *
     * @return array<string, string>
     */
    public static function get_filter_taxonomies()
    {
        $taxonomies = array('category' => __('Post categories', 'alt-text-pro'));
        if (self::has_products() && taxonomy_exists('product_cat')) {
            $taxonomies['product_cat'] = __('Product categories', 'alt-text-pro');
        }

        return $taxonomies;
    }

    /**
     * Category choices for the filter, grouped by taxonomy label.
     *
     * @return array<string, array<string, string>> label => ("taxonomy:id" => name)
     */
    public static function get_term_filter_options()
    {
        $groups = array();
        foreach (self::get_filter_taxonomies() as $taxonomy => $label) {
            $terms = get_terms(array(
                'taxonomy' => $taxonomy,
                'hide_empty' => true,
                'number' => 300,
                'orderby' => 'name',
            ));
            if (is_wp_error($terms) || empty($terms)) {
                continue;
            }
            foreach ($terms as $term) {
                $groups[$label][$taxonomy . ':' . (int) $term->term_id] = $term->name;
            }
        }

        return $groups;
    }

    /**
     * SQL (prepared, starting with " AND") that applies the Bulk page
     * filters to attachments aliased $alias, and always leaves out images
     * marked decorative and images whose suggested alt text waits for review.
     *
     * @param array  $filters Output of parse_filters().
     * @param string $alias   Attachment table alias.
     */
    public static function get_filter_sql(array $filters, $alias = 'p')
    {
        global $wpdb;

        $sql = $wpdb->prepare(
            " AND NOT EXISTS (SELECT 1 FROM {$wpdb->postmeta} atp_dec WHERE atp_dec.post_id = {$alias}.ID AND atp_dec.meta_key = %s AND atp_dec.meta_value = %s)",
            self::DECORATIVE_META,
            '1'
        );
        if (class_exists('AltTextPro_Review')) {
            $sql .= $wpdb->prepare(
                " AND NOT EXISTS (SELECT 1 FROM {$wpdb->postmeta} atp_sug WHERE atp_sug.post_id = {$alias}.ID AND atp_sug.meta_key = %s)",
                AltTextPro_Review::META
            );
        }

        if (!empty($filters['date_from'])) {
            $sql .= $wpdb->prepare(" AND {$alias}.post_date >= %s", $filters['date_from'] . ' 00:00:00');
        }
        if (!empty($filters['date_to'])) {
            $sql .= $wpdb->prepare(" AND {$alias}.post_date <= %s", $filters['date_to'] . ' 23:59:59');
        }
        if (!empty($filters['parent_type'])) {
            $sql .= $wpdb->prepare(
                " AND EXISTS (SELECT 1 FROM {$wpdb->posts} atp_parent WHERE atp_parent.ID = {$alias}.post_parent AND atp_parent.post_type = %s)",
                $filters['parent_type']
            );
        }
        if (!empty($filters['term']) && strpos($filters['term'], ':') !== false) {
            list($taxonomy, $term_id) = explode(':', $filters['term'], 2);
            // The category and its subcategories.
            $term_ids = array((int) $term_id);
            $children = get_term_children((int) $term_id, $taxonomy);
            if (is_array($children)) {
                $term_ids = array_merge($term_ids, array_map('intval', $children));
            }
            $term_ids = array_values(array_unique(array_filter($term_ids)));
            $placeholders = implode(',', array_fill(0, count($term_ids), '%d'));
            // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- placeholders match the values
            $sql .= $wpdb->prepare(
                " AND EXISTS (SELECT 1 FROM {$wpdb->term_relationships} atp_tr
                     INNER JOIN {$wpdb->term_taxonomy} atp_tt ON atp_tt.term_taxonomy_id = atp_tr.term_taxonomy_id
                     WHERE atp_tr.object_id = {$alias}.post_parent AND {$alias}.post_parent > 0
                     AND atp_tt.taxonomy = %s AND atp_tt.term_id IN ({$placeholders}))",
                array_merge(array($taxonomy), $term_ids)
            );
        }

        return $sql;
    }

    /**
     * Image counts for the Bulk page and the run estimate, with the same
     * scope, exclusions and filters as the run itself.
     *
     * @param array $filters Output of parse_filters().
     * @return array{missing: int, all: int}
     */
    public static function count_images(array $filters = array())
    {
        global $wpdb;

        $where = "p.post_type = 'attachment'"
            . AltTextPro_API_Client::get_supported_mime_sql_clause('p')
            . self::get_editable_media_sql_clause('p')
            . self::get_filter_sql($filters, 'p');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- every variable fragment is prepared above
        $all = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} p WHERE {$where}");
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $missing = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->posts} p
             LEFT JOIN {$wpdb->postmeta} pm ON (
                 p.ID = pm.post_id
                 AND pm.meta_key = '_wp_attachment_image_alt'
                 AND pm.meta_value IS NOT NULL
                 AND TRIM(pm.meta_value) != ''
             )
             WHERE {$where} AND pm.post_id IS NULL"
        );

        return array(
            'missing' => $missing,
            'all' => $all,
        );
    }

    /**
     * Credits one run may use, from the account's usage data. Plans with a
     * monthly allowance stop at what is left of it this cycle.
     *
     * @param array $usage Usage data returned by the service.
     * @return array{credits_remaining: int, plan_allowance: int, plan_credits_used: int, run_limit: int}
     */
    public static function get_run_credit_limits(array $usage)
    {
        $credits_remaining = isset($usage['credits_remaining']) ? intval($usage['credits_remaining']) : 0;
        $credits_used = isset($usage['credits_used']) ? intval($usage['credits_used']) : 0;
        $total_credits = isset($usage['total_credits']) ? intval($usage['total_credits']) : 0;
        $monthly_credit_allowance = isset($usage['monthly_credit_allowance']) ? intval($usage['monthly_credit_allowance']) : 0;
        $monthly_credit_limit = isset($usage['monthly_credit_limit']) ? intval($usage['monthly_credit_limit']) : 0;
        $monthly_credits_remaining = isset($usage['monthly_credits_remaining']) ? intval($usage['monthly_credits_remaining']) : null;
        $monthly_credits_used = isset($usage['monthly_credits_used']) ? intval($usage['monthly_credits_used']) : $credits_used;
        $subscription_plan = isset($usage['subscription_plan']) ? sanitize_text_field($usage['subscription_plan']) : 'free';
        $subscription_plans = array('free', 'tier1', 'tier2', 'tier3', 'tier4', 'lite', 'standard', 'pro', 'agency');

        $plan_allowance = $monthly_credit_limit > 0 ? $monthly_credit_limit : ($monthly_credit_allowance > 0 ? $monthly_credit_allowance : $total_credits);
        $plan_remaining = $monthly_credits_remaining !== null
            ? $monthly_credits_remaining
            : ($plan_allowance > 0 ? max(0, $plan_allowance - $monthly_credits_used) : $credits_remaining);
        $run_limit = in_array($subscription_plan, $subscription_plans, true)
            ? min($credits_remaining, $plan_remaining)
            : $credits_remaining;

        return array(
            'credits_remaining' => $credits_remaining,
            'plan_allowance' => $plan_allowance,
            'plan_credits_used' => $monthly_credits_used,
            'run_limit' => max(0, $run_limit),
        );
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
    private function create_bulk_process_record($images, $batch_size, $overwrite_existing, $credits_remaining_at_start = 0, $processable_images = null, $plan_allowance = null, $plan_credits_used = null, array $options = array())
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
            'user_id' => get_current_user_id(),
            // Non-secret reference stored with the run's log rows.
            'run_ref' => substr(hash('sha256', $process_id), 0, 20),
            'filters' => isset($options['filters']) && is_array($options['filters']) ? $options['filters'] : array()
        );

        // Store durable process data; the transient is only the fast cache.
        $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS);

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
                $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS * 2);
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
            'retry_message' => isset($process_data['retry_message']) ? $process_data['retry_message'] : null,
            // Driven by WP-Cron ("background") or by the open tab.
            'mode' => $this->is_background_run($process_id) ? 'background' : 'foreground',
            'run_ref' => self::get_run_ref($process_data),
            'idle_seconds' => $this->get_idle_seconds($process_data)
        );

        // Add stopped_reason if process was stopped due to credits
        if (isset($process_data['status']) && $process_data['status'] === 'stopped_no_credits') {
            $status_data['stopped_reason'] = $process_data['stopped_reason'] ?? __('Credits exhausted. Buy a credit pack or upgrade your plan at alt-text.pro, or wait for your next credit refill.', 'alt-text-pro');
            $status_data['stopped_code'] = 'no_credits';
        } elseif (isset($process_data['status']) && $process_data['status'] === 'stopped_error') {
            $status_data['stopped_reason'] = $process_data['stopped_reason'] ?? __('Bulk processing stopped because of an account or service problem.', 'alt-text-pro');
            $status_data['stopped_code'] = $process_data['stopped_code'] ?? 'account_error';
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
            if (!in_array($current_status, array('cancelled', 'completed', 'stopped_no_credits', 'stopped_error'), true)) {
                $process_data['status'] = 'running';
            }
            $process_data['last_updated'] = current_time('mysql');
            unset($process_data['retry_after_seconds'], $process_data['retry_message']);

            // Update durable state and refresh the transient with extended expiry.
            $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS * 2);
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
                $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS);
                $this->delete_bulk_process_state($process_id);
                return;
            }

            // Check if email was already sent to prevent duplicates
            if (isset($process_data['email_sent']) && $process_data['email_sent'] === true) {
                $this->delete_bulk_process_state($process_id);
                return;
            }

            if ($early_stop && isset($process_data['status']) && in_array($process_data['status'], array('stopped_no_credits', 'stopped_error'), true)) {
                // Keep the reason the run stopped.
            } else {
                $process_data['status'] = 'completed';
            }

            $process_data['completed_at'] = current_time('mysql');
            $process_data['email_sent'] = true; // Mark email as sent to prevent duplicates

            $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS);

            // Send completion notification (only once, and only when the
            // "Email me when a bulk run finishes" setting is on)
            if (AltTextPro_Settings::is_enabled('email_bulk_complete')) {
                $this->send_completion_notification($process_data);
            }
            $this->delete_bulk_process_state($process_id);
        }
    }

    /**
     * Cancel bulk process
     */
    private function cancel_bulk_process($process_id, $any_owner = false)
    {
        $process_data = $this->get_bulk_process_data($process_id, true, $any_owner);

        if (!$process_data) {
            return false;
        }

        $current_status = $process_data['status'] ?? 'running';
        if (in_array($current_status, array('completed', 'stopped_no_credits', 'stopped_error'), true)) {
            $this->delete_bulk_process_state($process_id);
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

        $this->save_bulk_process_data($process_id, $process_data, DAY_IN_SECONDS);
        if ($process_data['status'] === 'cancelled') {
            $this->delete_bulk_process_state($process_id);
        }
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
     * Get the durable options-table key for a bulk process.
     *
     * The transient remains the fast path, but it may be evicted by an
     * external object cache before its expiration time. Keeping the option
     * name hashed avoids exposing the process token in the options table.
     */
    private function get_bulk_process_option_name($process_id)
    {
        return 'alt_text_pro_bulk_state_' . hash('sha256', $process_id);
    }

    /**
     * Persist active process state in the database and refresh its transient.
     */
    private function save_bulk_process_data($process_id, $process_data, $transient_expiration)
    {
        update_option(
            $this->get_bulk_process_option_name($process_id),
            $process_data,
            false
        );

        set_transient(
            'alt_text_pro_bulk_' . $process_id,
            $process_data,
            $transient_expiration
        );
    }

    /**
     * Remove the durable copy once the short-lived result is terminal.
     */
    private function delete_bulk_process_state($process_id)
    {
        // Keep a summary of a run that did something, for "Recent runs".
        $process_data = get_option($this->get_bulk_process_option_name($process_id), false);
        if (is_array($process_data)) {
            $this->record_run_history($process_data, $this->is_background_run($process_id));
        }

        delete_option($this->get_bulk_process_option_name($process_id));
        delete_option($this->get_background_option_name($process_id));
        $this->release_active_run($process_id);
    }

    /**
     * Add or update the summary of a finished run in the run history.
     *
     * @param array $process_data  Saved run state.
     * @param bool  $is_background Whether it ran in the background.
     */
    private function record_run_history(array $process_data, $is_background)
    {
        $status = (string) ($process_data['status'] ?? '');
        if (intval($process_data['processed'] ?? 0) <= 0 || !in_array($status, array('completed', 'cancelled', 'cancelling', 'stopped_no_credits', 'stopped_error'), true)) {
            return;
        }

        $ref = self::get_run_ref($process_data);
        $history = get_option(self::RUN_HISTORY_OPTION, array());
        $history = is_array($history) ? $history : array();

        $entry = array(
            'ref' => $ref,
            'user_id' => intval($process_data['user_id'] ?? 0),
            'started_at' => (string) ($process_data['started_at'] ?? ''),
            'finished_at' => (string) ($process_data['completed_at'] ?? ($process_data['cancelled_at'] ?? current_time('mysql'))),
            'status' => $status === 'cancelling' ? 'cancelled' : $status,
            'mode' => $is_background ? 'background' : 'foreground',
            'processable' => intval($process_data['processable_images'] ?? 0),
            'processed' => intval($process_data['processed'] ?? 0),
            'successful' => intval($process_data['successful'] ?? 0),
            'failed' => is_array($process_data['errors'] ?? null) ? count($process_data['errors']) : 0,
            'overwrite' => !empty($process_data['overwrite_existing']),
        );

        foreach ($history as $index => $existing) {
            if (is_array($existing) && ($existing['ref'] ?? '') === $ref) {
                // Keep what an undo recorded.
                $entry = array_merge($existing, $entry);
                unset($history[$index]);
            }
        }

        array_unshift($history, $entry);
        update_option(self::RUN_HISTORY_OPTION, array_slice(array_values($history), 0, self::RUN_HISTORY_LIMIT), false);
    }

    /**
     * Daily WP-Cron task: delete saved state of bulk runs that are finished
     * or have been idle for more than three days.
     *
     * The run named by the site-wide active-run marker is never deleted, and
     * a run that made progress within the retention window is kept.
     *
     * @return int Number of saved runs deleted.
     */
    public static function cleanup_stale_bulk_states()
    {
        global $wpdb;

        $state_prefix = 'alt_text_pro_bulk_state_';

        wp_cache_delete(self::ACTIVE_RUN_OPTION, 'options');
        wp_cache_delete('notoptions', 'options');
        $marker = get_option(self::ACTIVE_RUN_OPTION, null);
        $live_option = '';
        if (is_array($marker) && !empty($marker['process_id']) && is_string($marker['process_id'])) {
            $live_option = $state_prefix . hash('sha256', $marker['process_id']);
        }

        // Names only: a saved run holds its whole queue, so values are read
        // one at a time below.
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $option_names = $wpdb->get_col($wpdb->prepare(
            "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s ORDER BY option_id ASC LIMIT %d",
            $wpdb->esc_like($state_prefix) . '%',
            self::CLEANUP_BATCH
        ));

        if (empty($option_names)) {
            return 0;
        }

        $now = strtotime(current_time('mysql'));
        $terminal_statuses = array('completed', 'cancelled', 'stopped_no_credits', 'stopped_error');
        $deleted = 0;

        foreach ((array) $option_names as $option_name) {
            if (!is_string($option_name) || strpos($option_name, $state_prefix) !== 0 || $option_name === $live_option) {
                continue;
            }

            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $raw_value = $wpdb->get_var($wpdb->prepare(
                "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s",
                $option_name
            ));
            if ($raw_value === null) {
                continue;
            }

            $process_data = maybe_unserialize($raw_value);
            unset($raw_value);

            $is_stale = true;
            if (is_array($process_data)) {
                $status = (string) ($process_data['status'] ?? '');
                $last_activity = '';
                foreach (array('last_updated', 'cancelled_at', 'completed_at', 'started_at') as $time_key) {
                    if (!empty($process_data[$time_key]) && is_string($process_data[$time_key])) {
                        $last_activity = $process_data[$time_key];
                        break;
                    }
                }
                $last_timestamp = $last_activity !== '' ? strtotime($last_activity) : false;
                $is_idle = !$last_timestamp || ($now - $last_timestamp) > self::STATE_RETENTION_SECONDS;

                $is_stale = in_array($status, $terminal_statuses, true) || $is_idle;
            }

            if (!$is_stale) {
                continue;
            }

            delete_option($option_name);
            // The run's process lock and background flag use the same hash
            // as its state.
            delete_option('alt_text_pro_bulk_lock_' . substr($option_name, strlen($state_prefix)));
            delete_option(self::BACKGROUND_OPTION_PREFIX . substr($option_name, strlen($state_prefix)));
            if (is_array($process_data) && !empty($process_data['id']) && is_string($process_data['id'])) {
                delete_transient('alt_text_pro_bulk_' . $process_data['id']);
                delete_transient('alt_text_pro_bulk_active_' . $process_data['id']);
            }
            $deleted++;
        }

        return $deleted;
    }

    /**
     * Return the marker of a bulk run that is still making progress, or null.
     */
    private function get_live_active_run()
    {
        $this->clear_lock_option_cache(self::ACTIVE_RUN_OPTION);
        $marker = get_option(self::ACTIVE_RUN_OPTION, null);

        if (!is_array($marker) || empty($marker['process_id'])) {
            return null;
        }

        $process_data = $this->get_bulk_process_data($marker['process_id'], true, true);
        $status = is_array($process_data) ? ($process_data['status'] ?? '') : '';

        if (!in_array($status, array('running', 'cancelling'), true)) {
            $this->atomic_delete_lock_option(self::ACTIVE_RUN_OPTION, $marker);
            return null;
        }

        $last_activity = $process_data['last_updated'] ?? ($process_data['started_at'] ?? '');
        $idle_seconds = strtotime(current_time('mysql')) - strtotime((string) $last_activity);

        // A running run that stopped moving (closed tab, or WP-Cron not
        // firing) is paused: it keeps the slot and stays resumable for a
        // week. A run that is stopping is released sooner.
        $stale_after = $status === 'running' ? self::RESUMABLE_RUN_SECONDS : self::ACTIVE_RUN_STALE_SECONDS;

        if (!$last_activity || $idle_seconds > $stale_after) {
            $this->atomic_delete_lock_option(self::ACTIVE_RUN_OPTION, $marker);
            return null;
        }

        return $marker;
    }

    /**
     * Seconds since the run last made progress.
     */
    private function get_idle_seconds(array $process_data)
    {
        $last_activity = (string) ($process_data['last_updated'] ?? ($process_data['started_at'] ?? ''));
        $last_timestamp = $last_activity !== '' ? strtotime($last_activity) : false;
        if (!$last_timestamp) {
            return 0;
        }

        return max(0, strtotime(current_time('mysql')) - $last_timestamp);
    }

    /**
     * Option that marks a run as continuing in the background.
     */
    private function get_background_option_name($process_id)
    {
        return self::BACKGROUND_OPTION_PREFIX . hash('sha256', (string) $process_id);
    }

    /**
     * True when WP-Cron, not a browser tab, drives this run.
     */
    private function is_background_run($process_id)
    {
        $option_name = $this->get_background_option_name($process_id);
        $this->clear_lock_option_cache($option_name);

        return get_option($option_name, '') === '1';
    }

    /**
     * Switch a run between the background (WP-Cron) and this tab.
     */
    private function set_background_mode($process_id, $background)
    {
        $option_name = $this->get_background_option_name($process_id);

        if ($background) {
            update_option($option_name, '1', false);
            self::schedule_background_tick(0);
            // Start right after this request instead of waiting for a visitor.
            if (!wp_doing_cron() && !(defined('DISABLE_WP_CRON') && DISABLE_WP_CRON)) {
                add_action('shutdown', array(__CLASS__, 'spawn_cron_after_request'));
            }
        } else {
            delete_option($option_name);
            wp_clear_scheduled_hook(self::BACKGROUND_HOOK);
        }
        $this->clear_lock_option_cache($option_name);
    }

    /**
     * Ask WP-Cron to run due events after this request.
     */
    public static function spawn_cron_after_request()
    {
        if (function_exists('spawn_cron')) {
            spawn_cron();
        }
    }

    /**
     * Queue the next background tick (one at a time).
     *
     * @param int $delay Seconds from now.
     */
    private static function schedule_background_tick($delay)
    {
        $next = wp_next_scheduled(self::BACKGROUND_HOOK);
        $when = time() + max(0, intval($delay));

        if ($next !== false && $next <= $when) {
            return;
        }
        if ($next !== false) {
            // Replace a later tick with this sooner one.
            wp_clear_scheduled_hook(self::BACKGROUND_HOOK);
        }

        wp_schedule_single_event($when, self::BACKGROUND_HOOK);
    }

    /**
     * WP-Cron callback: continue the site's background run for a short
     * slice of time, then queue the next tick.
     */
    public static function run_background_tick()
    {
        $processor = new self(false);
        $processor->process_background_tick();
    }

    /**
     * One background tick. Works on the run named by the site's active-run
     * marker, as the user who started it, under the same process lock as
     * tab-driven batches, so a run is never processed twice at once.
     */
    private function process_background_tick()
    {
        $marker = $this->get_live_active_run();
        if (!$marker) {
            return;
        }

        $process_id = (string) $marker['process_id'];
        $process_data = $this->get_bulk_process_data($process_id, true, true);
        if (!is_array($process_data) || !$this->is_background_run($process_id)) {
            return;
        }

        $owner_id = intval($process_data['user_id'] ?? 0);
        $previous_user_id = get_current_user_id();
        // Capability checks (and the owner check on the run) use the user
        // who started the run.
        wp_set_current_user($owner_id);

        try {
            if (!$owner_id || !current_user_can('upload_files')) {
                $this->stop_bulk_process_with_error(
                    $process_id,
                    $process_data,
                    intval($process_data['processed'] ?? 0),
                    is_array($process_data['successful_image_ids'] ?? null) ? $process_data['successful_image_ids'] : array(),
                    array(),
                    array(),
                    'owner_unavailable',
                    __('The background run stopped because the user who started it can no longer upload files.', 'alt-text-pro')
                );
                return;
            }

            if (($process_data['status'] ?? '') === 'cancelling') {
                // Finish a stop once the image in flight has settled.
                $this->cancel_bulk_process($process_id);
                $process_data = $this->get_bulk_process_data($process_id, true);
                if (is_array($process_data) && ($process_data['status'] ?? '') === 'cancelling') {
                    self::schedule_background_tick(30);
                }
                return;
            }

            $lock_token = $this->acquire_process_lock($process_id);
            if (!$lock_token) {
                // A tab or another tick is working on this run right now.
                self::schedule_background_tick(15);
                return;
            }

            $next_delay = 1;
            $budget = $this->get_background_tick_budget();
            $started = time();

            try {
                do {
                    $process_data = $this->get_bulk_process_data($process_id, true);
                    if (
                        !is_array($process_data)
                        || ($process_data['status'] ?? '') !== 'running'
                        || empty($process_data['needs_next_batch'])
                        || !$this->is_background_run($process_id)
                    ) {
                        break;
                    }

                    // Wait out a rate-limit window instead of retrying early.
                    if (!empty($process_data['retry_after_seconds'])) {
                        $ready_at = strtotime((string) ($process_data['last_updated'] ?? '')) + intval($process_data['retry_after_seconds']);
                        $now = strtotime(current_time('mysql'));
                        if ($ready_at > $now) {
                            $next_delay = $ready_at - $now;
                            break;
                        }
                    }

                    $offset = isset($process_data['next_batch_offset'])
                        ? intval($process_data['next_batch_offset'])
                        : intval($process_data['processed'] ?? 0);
                    $this->process_batch_sync($process_id, $offset);
                } while ((time() - $started) < $budget);
            } finally {
                $this->release_process_lock($process_id, $lock_token);
            }

            $process_data = $this->get_bulk_process_data($process_id, true);
            if (
                is_array($process_data)
                && $this->is_background_run($process_id)
                && ($process_data['status'] ?? '') === 'running'
                && !empty($process_data['needs_next_batch'])
            ) {
                self::schedule_background_tick($next_delay);
            }
        } finally {
            wp_set_current_user($previous_user_id);
        }
    }

    /**
     * Seconds one tick keeps starting images. One image can take up to
     * about 80 seconds (image download plus the service), which must fit in
     * the 120-second process lock and in PHP's time limit.
     */
    private function get_background_tick_budget()
    {
        if (function_exists('set_time_limit')) {
            // phpcs:ignore Squiz.PHP.DiscouragedFunctions.Discouraged, WordPress.PHP.NoSilencedErrors.Discouraged -- a background tick needs room for the image in flight
            @set_time_limit(150);
        }

        $limit = (int) ini_get('max_execution_time');
        if ($limit <= 0) {
            return self::BACKGROUND_TICK_BUDGET;
        }

        // Leave room for the image that is still in flight at the deadline.
        return max(1, min(self::BACKGROUND_TICK_BUDGET, $limit - 90));
    }

    /**
     * Atomically record this run as the site's active bulk run.
     */
    private function claim_active_run($process_id)
    {
        $marker = array(
            'process_id' => $process_id,
            'user_id' => get_current_user_id(),
            'claimed_at' => time(),
        );

        if ($this->atomic_insert_lock_option(self::ACTIVE_RUN_OPTION, $marker)) {
            return true;
        }

        // A finished or abandoned run may still hold the marker.
        if ($this->get_live_active_run() === null) {
            return $this->atomic_insert_lock_option(self::ACTIVE_RUN_OPTION, $marker);
        }

        return false;
    }

    /**
     * Release the site-wide marker if it still belongs to this run.
     */
    private function release_active_run($process_id)
    {
        $this->clear_lock_option_cache(self::ACTIVE_RUN_OPTION);
        $marker = get_option(self::ACTIVE_RUN_OPTION, null);

        if (is_array($marker) && ($marker['process_id'] ?? '') === $process_id) {
            $this->atomic_delete_lock_option(self::ACTIVE_RUN_OPTION, $marker);
        }
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
    private function get_bulk_process_data($process_id, $force_refresh = false, $any_owner = false)
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

        // Transients can be evicted by an external object cache at any time.
        // Recover active jobs from the options table and repopulate the fast
        // cache so the next request follows the normal path again.
        if ($process_data === false) {
            $process_data = get_option($this->get_bulk_process_option_name($process_id), false);
            if (is_array($process_data)) {
                set_transient($transient_key, $process_data, DAY_IN_SECONDS * 2);
            }
        }

        // Jobs belong to the user who started them. $any_owner is only used by
        // the site-wide run lock, which reads the status and last-update time
        // and never returns another user's job to the browser.
        if (
            !$process_data ||
            !is_array($process_data) ||
            (!$any_owner && intval($process_data['user_id'] ?? 0) !== get_current_user_id())
        ) {
            return false;
        }

        return $process_data;
    }

    /**
     * Send completion notification
     *
     * Plain text: wp_mail() sends text/plain by default, so no HTML escaping
     * (which would show &quot; and &#039; in the mail).
     */
    private function send_completion_notification($process_data)
    {
        $user = get_user_by('id', $process_data['user_id']);

        if (!$user || !$user->user_email) {
            return;
        }

        $status = $process_data['status'] ?? '';
        $stopped_reason = isset($process_data['stopped_reason']) ? (string) $process_data['stopped_reason'] : '';
        $total = intval($process_data['processable_images'] ?? $process_data['total_images'] ?? 0);
        $processed = intval($process_data['processed'] ?? 0);
        $successful = intval($process_data['successful'] ?? 0);
        $error_count = count($process_data['errors'] ?? array());
        $site_name = self::plain_text(get_bloginfo('name'));

        if ($status === 'stopped_no_credits') {
            /* translators: %s: site name */
            $subject = sprintf(__('[%s] Alt Text Pro: bulk run stopped, no credits left', 'alt-text-pro'), $site_name);
            $message = sprintf(
                // translators: %1$d: Total images, %2$d: Processed images, %3$d: Successfully processed images, %4$d: Error count, %5$s: Stopped reason, %6$s: pricing URL
                __("Your bulk alt text run stopped because the account ran out of credits.\n\nResults:\n- Images in this run: %1\$d\n- Processed: %2\$d\n- Alt text written: %3\$d\n- Errors: %4\$d\n\nReason: %5\$s\n\nBuy credits or upgrade your plan to continue: %6\$s", 'alt-text-pro'),
                $total,
                $processed,
                $successful,
                $error_count,
                $stopped_reason !== '' ? $stopped_reason : __('No credits remaining', 'alt-text-pro'),
                ALT_TEXT_PRO_PRICING_URL
            );
        } elseif ($status === 'stopped_error') {
            /* translators: %s: site name */
            $subject = sprintf(__('[%s] Alt Text Pro: bulk run stopped', 'alt-text-pro'), $site_name);
            $message = sprintf(
                // translators: %1$d: Total images, %2$d: Processed images, %3$d: Successfully processed images, %4$d: Error count, %5$s: Stopped reason
                __("Your bulk alt text run stopped early.\n\nResults:\n- Images in this run: %1\$d\n- Processed: %2\$d\n- Alt text written: %3\$d\n- Errors: %4\$d\n\nReason: %5\$s", 'alt-text-pro'),
                $total,
                $processed,
                $successful,
                $error_count,
                $stopped_reason
            );
        } else {
            /* translators: %s: site name */
            $subject = sprintf(__('[%s] Alt Text Pro: bulk run finished', 'alt-text-pro'), $site_name);
            $message = sprintf(
                // translators: %1$d: Total images, %2$d: Successfully processed images, %3$d: Error count
                __("Your bulk alt text run has finished.\n\nResults:\n- Images in this run: %1\$d\n- Alt text written: %2\$d\n- Errors: %3\$d", 'alt-text-pro'),
                $total,
                $successful,
                $error_count
            );
        }

        $message .= "\n\n" . sprintf(
            /* translators: %s: URL of the Alt Text Pro logs page */
            __('Details: %s', 'alt-text-pro'),
            admin_url('admin.php?page=alt-text-pro-logs')
        );
        $message .= "\n\n" . sprintf(
            /* translators: %s: URL of the Alt Text Pro settings page */
            __('You get this email because "Email me when a bulk run finishes" is on. Turn it off in Alt Text Pro > Settings: %s', 'alt-text-pro'),
            admin_url('admin.php?page=alt-text-pro-settings')
        );

        wp_mail($user->user_email, self::plain_text($subject), self::plain_text($message, true));
    }

    /**
     * Strip tags and decode entities for a plain-text email.
     */
    private static function plain_text($text, $keep_newlines = false)
    {
        $text = html_entity_decode(wp_strip_all_tags((string) $text, !$keep_newlines), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return $keep_newlines ? $text : trim(preg_replace('/\s+/u', ' ', $text));
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
    private function log_generation($attachment_id, $alt_text, $credits_used = 1, array $extra = array())
    {
        // Don't log if alt_text is empty
        if (empty($alt_text)) {
            return;
        }

        self::write_log($attachment_id, $alt_text, $credits_used, $extra);
    }

    /**
     * Insert one row in the logs table.
     *
     * $extra may hold outcome (generated, suggested, failed, skipped),
     * outcome_reason, run_ref and previous_alt. Those columns are added by
     * upgrade_log_table(); until it has run, only generations are logged,
     * in the original columns.
     *
     * @return int Row ID, or 0 when nothing was written.
     */
    public static function write_log($attachment_id, $alt_text, $credits_used = 1, array $extra = array())
    {
        global $wpdb;

        $outcome = isset($extra['outcome']) ? sanitize_key((string) $extra['outcome']) : 'generated';
        $data = array(
            'attachment_id' => absint($attachment_id),
            'alt_text' => (string) $alt_text,
            'credits_used' => intval($credits_used),
            'created_at' => current_time('mysql'),
        );
        $formats = array('%d', '%s', '%d', '%s');

        if (self::log_columns_ready()) {
            $data['outcome'] = $outcome !== '' ? $outcome : 'generated';
            $formats[] = '%s';
            foreach (array('outcome_reason', 'run_ref', 'previous_alt') as $column) {
                if (!isset($extra[$column])) {
                    continue;
                }
                $value = (string) $extra[$column];
                // An empty previous alt text is kept: the run filled an image
                // that had none, and undo empties it again.
                if ($value === '' && $column !== 'previous_alt') {
                    continue;
                }
                $data[$column] = $value;
                $formats[] = '%s';
            }
        } elseif (in_array($outcome, self::NOT_GENERATED_OUTCOMES, true)) {
            return 0;
        }

        $table_name = $wpdb->prefix . 'alt_text_pro_logs';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $inserted = $wpdb->insert($table_name, $data, $formats);

        if (!$inserted) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                error_log('Alt Text Pro Bulk: Generation history could not be saved.');
            }
            return 0;
        }

        return (int) $wpdb->insert_id;
    }

    /**
     * True once the bulk-run log columns exist on this site.
     */
    public static function log_columns_ready()
    {
        return get_option(self::LOG_SCHEMA_OPTION) === self::LOG_SCHEMA_VERSION;
    }

    /**
     * Readable names of log outcomes, for the Logs page and the CSV.
     *
     * @return array<string, string>
     */
    public static function get_outcome_labels()
    {
        return array(
            'generated' => __('Generated', 'alt-text-pro'),
            'suggested' => __('Waiting for review', 'alt-text-pro'),
            'failed' => __('Failed', 'alt-text-pro'),
            'skipped' => __('Skipped', 'alt-text-pro'),
            'undone' => __('Undone', 'alt-text-pro'),
            'rejected' => __('Rejected', 'alt-text-pro'),
        );
    }

    /**
     * Logs page / CSV filter on one outcome (" AND ..."), '' for all rows.
     *
     * @param string $outcome Outcome key, validated here.
     * @param string $alias   Logs table alias.
     */
    public static function outcome_filter_sql($outcome, $alias = 'l')
    {
        global $wpdb;

        if ($outcome === '' || !self::log_columns_ready() || !array_key_exists($outcome, self::get_outcome_labels())) {
            return '';
        }

        return $wpdb->prepare(" AND {$alias}.outcome = %s", $outcome);
    }

    /**
     * SQL condition (" AND ...") keeping log rows that are generations, so
     * failed and skipped rows do not count as generated.
     *
     * @param string $alias Logs table alias, '' for none.
     */
    public static function generated_logs_sql($alias = 'l')
    {
        if (!self::log_columns_ready()) {
            return '';
        }

        $column = ($alias !== '' ? $alias . '.' : '') . 'outcome';
        return " AND ({$column} IS NULL OR {$column} NOT IN ('failed', 'skipped'))";
    }

    /**
     * Add the bulk-run columns to the logs table: outcome (generated,
     * suggested, failed, skipped, undone, rejected), its reason, the run
     * reference and the alt text the run replaced.
     *
     * Kept apart from AltTextPro::create_tables(): dbDelta() only adds what
     * is missing and never drops a column, so this step and changes to the
     * base table do not interfere. Old rows default to "generated".
     */
    public static function upgrade_log_table()
    {
        global $wpdb;

        $table_name = $wpdb->prefix . 'alt_text_pro_logs';
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            attachment_id bigint(20) NOT NULL,
            alt_text text NOT NULL,
            credits_used int(11) DEFAULT 1,
            processing_time float DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            outcome varchar(20) NOT NULL DEFAULT 'generated',
            outcome_reason text NULL,
            run_ref varchar(40) NULL,
            previous_alt text NULL,
            PRIMARY KEY  (id),
            KEY attachment_id (attachment_id),
            KEY run_ref (run_ref)
        ) $charset_collate;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);

        // Only mark the step done when the columns are really there.
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name comes from $wpdb
        $columns = (array) $wpdb->get_col("SHOW COLUMNS FROM {$table_name}", 0);
        if (in_array('outcome', $columns, true) && in_array('run_ref', $columns, true) && in_array('previous_alt', $columns, true) && in_array('outcome_reason', $columns, true)) {
            update_option(self::LOG_SCHEMA_OPTION, self::LOG_SCHEMA_VERSION, true);
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
