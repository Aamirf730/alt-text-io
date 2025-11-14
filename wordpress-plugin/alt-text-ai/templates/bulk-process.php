<?php
/**
 * Bulk Process Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="wrap alt-text-ai-bulk-process">
    <div class="alt-text-ai-header">
        <div class="alt-text-ai-header-content">
            <div class="alt-text-ai-logo">
                <img src="<?php echo esc_url(ALT_TEXT_AI_PLUGIN_URL . 'assets/images/logo-alt-text-pro.png'); ?>" alt="Alt Text Pro" />
                <h1><?php _e('Bulk Alt-Text Generation', 'alt-text-ai'); ?></h1>
            </div>
            <div class="alt-text-ai-header-actions">
                <a href="<?php echo admin_url('admin.php?page=alt-text-ai'); ?>" class="button button-secondary">
                    <span class="dashicons dashicons-arrow-left-alt"></span>
                    <?php _e('Back to Dashboard', 'alt-text-ai'); ?>
                </a>
            </div>
        </div>
    </div>

    <?php
    $settings = get_option('alt_text_ai_settings', array());
    if (empty($settings['api_key'])):
    ?>
        <!-- API Key Required -->
        <div class="alt-text-ai-notice-card">
            <div class="notice-icon">
                <span class="dashicons dashicons-warning"></span>
            </div>
            <div class="notice-content">
                <h3><?php _e('API Key Required', 'alt-text-ai'); ?></h3>
                <p><?php _e('You need to configure your API key before you can use bulk processing.', 'alt-text-ai'); ?></p>
                <a href="<?php echo admin_url('admin.php?page=alt-text-ai-settings'); ?>" class="button button-primary">
                    <?php _e('Configure API Key', 'alt-text-ai'); ?>
                </a>
            </div>
        </div>
    <?php else: ?>

    <!-- Statistics Overview -->
    <div class="bulk-stats-overview">
        <div class="stats-card">
            <div class="stat-number"><?php echo number_format($total_images); ?></div>
            <div class="stat-label"><?php _e('Total Images', 'alt-text-ai'); ?></div>
        </div>
        <div class="stats-card">
            <div class="stat-number"><?php echo number_format($total_without_alt); ?></div>
            <div class="stat-label"><?php _e('Missing Alt-Text', 'alt-text-ai'); ?></div>
        </div>
        <div class="stats-card">
            <div class="stat-number"><?php echo number_format($total_images - $total_without_alt); ?></div>
            <div class="stat-label"><?php _e('Have Alt-Text', 'alt-text-ai'); ?></div>
        </div>
        <div class="stats-card">
            <div class="stat-number"><?php echo $total_without_alt > 0 ? round((($total_images - $total_without_alt) / $total_images) * 100) : 100; ?>%</div>
            <div class="stat-label"><?php _e('Completion Rate', 'alt-text-ai'); ?></div>
        </div>
    </div>

    <!-- Bulk Processing Options -->
    <div class="bulk-process-container">
        <div class="bulk-process-main">
            <!-- Processing Options -->
            <div class="processing-options-card">
                <div class="card-header">
                    <h2><?php _e('Processing Options', 'alt-text-ai'); ?></h2>
                </div>
                <div class="card-content">
                    <form id="bulk-process-form">
                        <div class="option-group">
                            <label class="option-label">
                                <input type="radio" name="process_type" value="missing" checked>
                                <span class="radio-custom"></span>
                                <span class="option-text">
                                    <strong><?php _e('Process images missing alt-text', 'alt-text-ai'); ?></strong>
                                    <small><?php printf(__('(%d images)', 'alt-text-ai'), $total_without_alt); ?></small>
                                </span>
                            </label>
                        </div>
                        
                        <div class="option-group">
                            <label class="option-label">
                                <input type="radio" name="process_type" value="all">
                                <span class="radio-custom"></span>
                                <span class="option-text">
                                    <strong><?php _e('Process all images', 'alt-text-ai'); ?></strong>
                                    <small><?php printf(__('(%d images)', 'alt-text-ai'), $total_images); ?></small>
                                </span>
                            </label>
                        </div>
                        
                        <div class="option-group">
                            <label class="option-label">
                                <input type="radio" name="process_type" value="selected">
                                <span class="radio-custom"></span>
                                <span class="option-text">
                                    <strong><?php _e('Process selected images', 'alt-text-ai'); ?></strong>
                                    <small><?php _e('Choose specific images below', 'alt-text-ai'); ?></small>
                                </span>
                            </label>
                        </div>

                        <div class="processing-settings">
                            <div class="setting-row">
                                <label for="batch_size"><?php _e('Batch Size:', 'alt-text-ai'); ?></label>
                                <input type="number" id="batch_size" name="batch_size" value="<?php echo esc_attr($settings['batch_size'] ?? 10); ?>" min="1" max="50" class="small-text">
                                <span class="setting-description"><?php _e('images per batch', 'alt-text-ai'); ?></span>
                            </div>
                            
                            <div class="setting-row">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="overwrite_existing" name="overwrite_existing" <?php checked($settings['overwrite_existing'] ?? false); ?>>
                                    <span class="checkmark"></span>
                                    <span class="label-text"><?php _e('Overwrite existing alt-text', 'alt-text-ai'); ?></span>
                                </label>
                            </div>
                        </div>

                        <div class="processing-actions">
                            <button type="button" id="start-bulk-process" class="button button-primary button-large">
                                <span class="dashicons dashicons-controls-play"></span>
                                <?php _e('Start Processing', 'alt-text-ai'); ?>
                            </button>
                            <button type="button" id="cancel-bulk-process" class="button button-secondary" style="display: none;">
                                <span class="dashicons dashicons-no"></span>
                                <?php _e('Cancel', 'alt-text-ai'); ?>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Progress Card -->
            <div class="progress-card" id="progress-card" style="display: none;">
                <div class="card-header">
                    <h3><?php _e('Processing Progress', 'alt-text-ai'); ?></h3>
                    <div class="progress-status" id="progress-status"></div>
                </div>
                <div class="card-content">
                    <div class="progress-bar-container">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="progress-text" id="progress-text">0%</div>
                    </div>
                    
                    <div class="progress-details">
                        <div class="detail-item">
                            <span class="detail-label"><?php _e('Processed:', 'alt-text-ai'); ?></span>
                            <span class="detail-value" id="processed-count">0</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label"><?php _e('Successful:', 'alt-text-ai'); ?></span>
                            <span class="detail-value" id="successful-count">0</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label"><?php _e('Errors:', 'alt-text-ai'); ?></span>
                            <span class="detail-value" id="error-count">0</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label"><?php _e('Estimated Time:', 'alt-text-ai'); ?></span>
                            <span class="detail-value" id="estimated-time">-</span>
                        </div>
                    </div>
                    
                    <div class="progress-log" id="progress-log"></div>
                </div>
            </div>

            <!-- Results Card -->
            <div class="results-card" id="results-card" style="display: none;">
                <div class="card-header">
                    <h3><?php _e('Processing Results', 'alt-text-ai'); ?></h3>
                </div>
                <div class="card-content">
                    <div class="results-summary" id="results-summary"></div>
                    <div class="results-errors" id="results-errors"></div>
                </div>
            </div>
        </div>

        <!-- Image Selection Sidebar -->
        <div class="image-selection-sidebar" id="image-selection-sidebar" style="display: none;">
            <div class="sidebar-header">
                <h3><?php _e('Select Images', 'alt-text-ai'); ?></h3>
                <div class="selection-actions">
                    <button type="button" class="button button-small" id="select-all-images">
                        <?php _e('Select All', 'alt-text-ai'); ?>
                    </button>
                    <button type="button" class="button button-small" id="deselect-all-images">
                        <?php _e('Deselect All', 'alt-text-ai'); ?>
                    </button>
                </div>
            </div>
            
            <div class="image-list" id="image-list">
                <?php if (!empty($images_without_alt)): ?>
                    <?php foreach (array_slice($images_without_alt, 0, 50) as $image): ?>
                        <?php
                        $image_url = wp_get_attachment_image_url($image->ID, 'thumbnail');
                        $image_title = $image->post_title ?: sprintf(__('Image #%d', 'alt-text-ai'), $image->ID);
                        $upload_date = human_time_diff(strtotime($image->post_date), current_time('timestamp'));
                        ?>
                        <div class="image-item">
                            <label class="image-checkbox">
                                <input type="checkbox" name="selected_images[]" value="<?php echo $image->ID; ?>">
                                <span class="checkmark"></span>
                            </label>
                            <div class="image-thumbnail">
                                <?php if ($image_url): ?>
                                    <img src="<?php echo esc_url($image_url); ?>" alt="">
                                <?php else: ?>
                                    <span class="dashicons dashicons-format-image"></span>
                                <?php endif; ?>
                            </div>
                            <div class="image-info">
                                <div class="image-title"><?php echo esc_html($image_title); ?></div>
                                <div class="image-meta">
                                    <small><?php printf(__('Uploaded %s ago', 'alt-text-ai'), $upload_date); ?></small>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    
                    <?php if (count($images_without_alt) > 50): ?>
                        <div class="load-more-container">
                            <button type="button" class="button button-secondary" id="load-more-images">
                                <?php printf(__('Load More (%d remaining)', 'alt-text-ai'), count($images_without_alt) - 50); ?>
                            </button>
                        </div>
                    <?php endif; ?>
                <?php else: ?>
                    <div class="no-images-message">
                        <span class="dashicons dashicons-images-alt2"></span>
                        <p><?php _e('All your images already have alt-text!', 'alt-text-ai'); ?></p>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <?php endif; ?>
</div>

<script type="text/javascript">
jQuery(document).ready(function($) {
    var bulkProcessor = {
        processId: null,
        isProcessing: false,
        statusInterval: null,
        processingBatches: {}, // Track batches being processed to prevent duplicates
        notificationsShown: {}, // Track which notifications have been shown to prevent duplicates
        
        init: function() {
            this.bindEvents();
        },
        
        bindEvents: function() {
            var self = this;
            
            // Process type change
            $('input[name="process_type"]').on('change', function() {
                if ($(this).val() === 'selected') {
                    $('#image-selection-sidebar').show();
                } else {
                    $('#image-selection-sidebar').hide();
                }
            });
            
            // Start processing
            $('#start-bulk-process').on('click', function() {
                self.startProcessing();
            });
            
            // Cancel processing
            $('#cancel-bulk-process').on('click', function() {
                self.cancelProcessing();
            });
            
            // Select all/deselect all
            $('#select-all-images').on('click', function() {
                $('#image-list input[type="checkbox"]').prop('checked', true);
            });
            
            $('#deselect-all-images').on('click', function() {
                $('#image-list input[type="checkbox"]').prop('checked', false);
            });
        },
        
        startProcessing: function() {
            var self = this;
            var processType = $('input[name="process_type"]:checked').val();
            var batchSize = parseInt($('#batch_size').val());
            var overwriteExisting = $('#overwrite_existing').is(':checked');
            var selectedImages = [];
            
            if (processType === 'selected') {
                selectedImages = $('#image-list input[type="checkbox"]:checked').map(function() {
                    return parseInt($(this).val());
                }).get();
                
                if (selectedImages.length === 0) {
                    alert('<?php _e("Please select at least one image to process.", "alt-text-ai"); ?>');
                    return;
                }
            }
            
            // Show progress card
            $('#progress-card').show();
            $('#results-card').hide();
            this.isProcessing = true;
            this.notificationsShown = {}; // Reset notifications when starting new process
            
            // Update UI
            $('#start-bulk-process').hide();
            $('#cancel-bulk-process').show();
            $('#progress-status').text('<?php _e("Starting...", "alt-text-ai"); ?>');
            
            // Start processing
            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_ai_bulk_start',
                    process_type: processType,
                    batch_size: batchSize,
                    overwrite_existing: overwriteExisting,
                    selected_images: selectedImages,
                    nonce: altTextAI.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.processId = response.data.process_id;
                        $('#estimated-time').text(response.data.estimated_time);
                        self.startStatusPolling();
                    } else {
                        self.showError(response.data || '<?php _e("Failed to start processing", "alt-text-ai"); ?>');
                        self.resetUI();
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Alt Text Pro Bulk Process Error:', {
                        status: status,
                        error: error,
                        response: xhr.responseText
                    });
                    self.showError('<?php _e("Failed to start processing", "alt-text-ai"); ?> (Check console for details)');
                    self.resetUI();
                }
            });
        },
        
        startStatusPolling: function() {
            var self = this;
            
            this.statusInterval = setInterval(function() {
                if (!self.isProcessing) {
                    clearInterval(self.statusInterval);
                    return;
                }
                
                $.ajax({
                    url: altTextAI.ajaxUrl,
                    type: 'POST',
                    data: {
                        action: 'alt_text_ai_bulk_status',
                        process_id: self.processId,
                        nonce: altTextAI.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            self.updateProgress(response.data);
                            
                            // Check if processing is complete or stopped
                            if (response.data.status === 'completed' || 
                                response.data.status === 'cancelled' || 
                                response.data.status === 'stopped_no_credits') {
                                self.completeProcessing(response.data);
                            } else if (response.data.needs_next_batch && response.data.next_batch_offset !== null) {
                                // Only process next batch if status is still 'running'
                                if (response.data.status === 'running') {
                                    var batchKey = response.data.process_id + '_' + response.data.next_batch_offset;
                                    if (!self.processingBatches || !self.processingBatches[batchKey]) {
                                        self.processNextBatch(response.data.process_id, response.data.next_batch_offset);
                                    }
                                }
                            }
                        } else {
                            console.error('Bulk status check failed:', response);
                        }
                    },
                    error: function(xhr, status, error) {
                        console.error('Bulk status check error:', {
                            status: status,
                            error: error,
                            response: xhr.responseText
                        });
                    }
                });
            }, 2000);
        },
        
        processNextBatch: function(processId, batchOffset) {
            var self = this;
            
            // Prevent duplicate batch processing
            var batchKey = processId + '_' + batchOffset;
            if (self.processingBatches && self.processingBatches[batchKey]) {
                console.log('Batch already being processed, skipping:', batchKey);
                return;
            }
            
            // Mark this batch as being processed
            if (!self.processingBatches) {
                self.processingBatches = {};
            }
            self.processingBatches[batchKey] = true;
            
            // Clear the needs_next_batch flag by processing the batch
            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_ai_bulk_process_batch',
                    process_id: processId,
                    batch_offset: batchOffset,
                    nonce: altTextAI.nonce
                },
                success: function(response) {
                    // Remove batch from processing list
                    delete self.processingBatches[batchKey];
                    
                    if (response.success) {
                        self.updateProgress(response.data);
                        
                        // Continue processing if needed
                        if (response.data.needs_next_batch && response.data.next_batch_offset !== null) {
                            // Process next batch after a short delay
                            setTimeout(function() {
                                self.processNextBatch(processId, response.data.next_batch_offset);
                            }, 500);
                        } else if (response.data.status === 'completed' || response.data.status === 'cancelled') {
                            self.completeProcessing(response.data);
                        }
                    } else {
                        console.error('Batch processing failed:', response);
                    }
                },
                error: function(xhr, status, error) {
                    // Remove batch from processing list on error
                    delete self.processingBatches[batchKey];
                    
                    console.error('Batch processing error:', {
                        status: status,
                        error: error,
                        response: xhr.responseText
                    });
                }
            });
        },
        
        updateProgress: function(data) {
            var percentage = data.total_images > 0 ? Math.round((data.processed / data.total_images) * 100) : 0;
            
            $('#progress-fill').css('width', percentage + '%');
            $('#progress-text').text(percentage + '%');
            $('#processed-count').text(data.processed + ' / ' + data.total_images);
            $('#successful-count').text(data.successful || 0);
            $('#error-count').text(data.errors ? data.errors.length : 0);
            
            // Update status message based on current state
            if (data.status === 'running') {
                $('#progress-status').text('<?php _e("Processing...", "alt-text-ai"); ?>').css({
                    'font-weight': 'normal',
                    'font-size': '14px',
                    'color': '#333'
                });
            } else if (data.status === 'stopped_no_credits') {
                // Show error immediately during processing
                $('#progress-status').text('<?php _e("Stopped - Credits Exhausted", "alt-text-ai"); ?>').css({
                    'font-weight': 'bold',
                    'font-size': '16px',
                    'color': '#d63638'
                });
                
                // Show error notification immediately (only once)
                if (!this.notificationsShown['credits_exhausted']) {
                    this.showErrorNotification('<?php _e("Credits exhausted! Processing stopped. Please upgrade your plan or wait for next month\'s credit refill.", "alt-text-ai"); ?>');
                    this.notificationsShown['credits_exhausted'] = true;
                }
            }
            
            // Check for credit-related errors in the errors array and show notification
            if (data.errors && data.errors.length > 0) {
                var creditError = data.errors.find(function(error) {
                    return error.error && (
                        error.error.toLowerCase().indexOf('credit') !== -1 ||
                        error.error.toLowerCase().indexOf('no credits') !== -1 ||
                        error.error.toLowerCase().indexOf('credits remaining') !== -1
                    );
                });
                
                if (creditError && data.status === 'running' && !this.notificationsShown['credits_warning']) {
                    // Show error notification if credits run out during processing
                    this.showErrorNotification('<?php _e("Credits exhausted! Processing will stop after current batch.", "alt-text-ai"); ?>');
                    this.notificationsShown['credits_warning'] = true;
                }
            }
        },
        
        completeProcessing: function(data) {
            this.isProcessing = false;
            clearInterval(this.statusInterval);
            
            // Update final progress to 100%
            var percentage = data.total_images > 0 ? Math.round((data.processed / data.total_images) * 100) : 100;
            $('#progress-fill').css('width', '100%');
            $('#progress-text').text('100%');
            $('#processed-count').text(data.processed + ' / ' + data.total_images);
            $('#successful-count').text(data.successful || 0);
            $('#error-count').text(data.errors ? data.errors.length : 0);
            
            // Determine status message
            var statusMessage = '<?php _e("Completed", "alt-text-ai"); ?>';
            var isSuccess = true;
            if (data.status === 'stopped_no_credits') {
                statusMessage = '<?php _e("Stopped - Credits Exhausted", "alt-text-ai"); ?>';
                isSuccess = false;
            } else if (data.status === 'cancelled') {
                statusMessage = '<?php _e("Cancelled", "alt-text-ai"); ?>';
                isSuccess = false;
            }
            
            $('#progress-status').text(statusMessage).css({
                'font-weight': 'bold',
                'font-size': '16px',
                'color': isSuccess ? '#1AB5AC' : '#d63638'
            });
            
            // Show results card with animation
            $('#results-card').slideDown(400, function() {
                // Scroll to results card after it's shown
                $('html, body').animate({
                    scrollTop: $('#results-card').offset().top - 100
                }, 500);
            });
            
            // Build summary with better formatting
            var summary = '<div class="results-summary-item" style="padding: 20px; background: ' + (isSuccess ? '#f0fdf4' : '#fef2f2') + '; border-radius: 8px; border-left: 4px solid ' + (isSuccess ? '#1AB5AC' : '#d63638') + ';">';
            if (data.status === 'stopped_no_credits') {
                summary += '<strong style="color: #d63638; font-size: 18px; display: block; margin-bottom: 12px;"><?php _e("Processing Stopped - Credits Exhausted", "alt-text-ai"); ?></strong>';
                summary += '<p style="color: #d63638; font-weight: bold; margin-bottom: 16px;"><?php _e("You have run out of credits. Please upgrade your plan or wait for next month\'s credit refill to continue processing.", "alt-text-ai"); ?></p>';
            } else if (data.status === 'cancelled') {
                summary += '<strong style="color: #d63638; font-size: 18px; display: block; margin-bottom: 12px;"><?php _e("Processing Cancelled", "alt-text-ai"); ?></strong>';
            } else {
                summary += '<strong style="color: #1AB5AC; font-size: 18px; display: block; margin-bottom: 12px;">✓ <?php _e("Processing Complete!", "alt-text-ai"); ?></strong>';
            }
            summary += '<div style="margin-top: 16px; line-height: 1.8;">';
            summary += '<div><strong><?php _e("Total processed:", "alt-text-ai"); ?></strong> ' + data.processed + ' <?php _e("images", "alt-text-ai"); ?></div>';
            summary += '<div><strong style="color: #1AB5AC;"><?php _e("Successful:", "alt-text-ai"); ?></strong> ' + (data.successful || 0) + ' <?php _e("images", "alt-text-ai"); ?></div>';
            if (data.errors && data.errors.length > 0) {
                summary += '<div><strong style="color: #d63638;"><?php _e("Errors:", "alt-text-ai"); ?></strong> ' + data.errors.length + ' <?php _e("images", "alt-text-ai"); ?></div>';
            }
            summary += '</div>';
            summary += '</div>';
            
            $('#results-summary').html(summary);
            
            // Show errors if any
            if (data.errors && data.errors.length > 0) {
                var errorHtml = '<div style="margin-top: 20px; padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #d63638;">';
                errorHtml += '<h4 style="margin: 0 0 12px 0; color: #d63638;"><?php _e("Errors:", "alt-text-ai"); ?></h4><ul style="margin: 0; padding-left: 20px;">';
                data.errors.forEach(function(error) {
                    var errorClass = error.error && error.error.toLowerCase().indexOf('credit') !== -1 ? ' style="color: #d63638; font-weight: bold;"' : '';
                    errorHtml += '<li' + errorClass + ' style="margin-bottom: 8px;">Image #' + error.image_id + ': ' + error.error + '</li>';
                });
                errorHtml += '</ul></div>';
                $('#results-errors').html(errorHtml);
            } else {
                $('#results-errors').html('');
            }
            
            // Show completion notification for all statuses
            if (data.status === 'completed') {
                this.showSuccessNotification('<?php _e("Bulk processing completed successfully!", "alt-text-ai"); ?>');
            } else if (data.status === 'stopped_no_credits') {
                // Show error notification for credit exhaustion
                this.showErrorNotification('<?php _e("Processing stopped - Credits exhausted. Please upgrade your plan or wait for next month\'s credit refill.", "alt-text-ai"); ?>');
            } else if (data.status === 'cancelled') {
                // Show info notification for cancellation
                this.showInfoNotification('<?php _e("Processing cancelled by user.", "alt-text-ai"); ?>');
            }
            
            this.resetUI();
            
            // Refresh page stats after a longer delay to give users time to see results
            setTimeout(function() {
                location.reload();
            }, 8000);
        },
        
        showSuccessNotification: function(message) {
            // Create and show a prominent success notification
            var notification = $('<div>').css({
                'position': 'fixed',
                'top': '20px',
                'right': '20px',
                'background': 'linear-gradient(135deg, #1AB5AC 0%, #3AC8C4 100%)',
                'color': 'white',
                'padding': '20px 30px',
                'border-radius': '8px',
                'box-shadow': '0 4px 20px rgba(26, 181, 172, 0.3)',
                'z-index': '100000',
                'font-weight': '600',
                'font-size': '16px',
                'max-width': '400px',
                'animation': 'slideInRight 0.3s ease-out'
            }).html('✓ ' + message);
            
            $('body').append(notification);
            
            // Auto-hide after 5 seconds
            setTimeout(function() {
                notification.fadeOut(300, function() {
                    $(this).remove();
                });
            }, 5000);
        },
        
        showErrorNotification: function(message) {
            // Create and show a prominent error notification
            var notification = $('<div>').css({
                'position': 'fixed',
                'top': '20px',
                'right': '20px',
                'background': '#d63638',
                'color': 'white',
                'padding': '20px 30px',
                'border-radius': '8px',
                'box-shadow': '0 4px 20px rgba(214, 54, 56, 0.3)',
                'z-index': '100000',
                'font-weight': '600',
                'font-size': '16px',
                'max-width': '400px',
                'animation': 'slideInRight 0.3s ease-out'
            }).html('⚠ ' + message);
            
            $('body').append(notification);
            
            // Auto-hide after 8 seconds (longer for errors)
            setTimeout(function() {
                notification.fadeOut(300, function() {
                    $(this).remove();
                });
            }, 8000);
        },
        
        showInfoNotification: function(message) {
            // Create and show an info notification
            var notification = $('<div>').css({
                'position': 'fixed',
                'top': '20px',
                'right': '20px',
                'background': '#2271b1',
                'color': 'white',
                'padding': '20px 30px',
                'border-radius': '8px',
                'box-shadow': '0 4px 20px rgba(34, 113, 177, 0.3)',
                'z-index': '100000',
                'font-weight': '600',
                'font-size': '16px',
                'max-width': '400px',
                'animation': 'slideInRight 0.3s ease-out'
            }).html('ℹ ' + message);
            
            $('body').append(notification);
            
            // Auto-hide after 5 seconds
            setTimeout(function() {
                notification.fadeOut(300, function() {
                    $(this).remove();
                });
            }, 5000);
        },
        
        cancelProcessing: function() {
            var self = this;
            
            if (!this.processId) return;
            
            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_ai_bulk_cancel',
                    process_id: this.processId,
                    nonce: altTextAI.nonce
                },
                success: function(response) {
                    self.isProcessing = false;
                    $('#progress-status').text('<?php _e("Cancelling...", "alt-text-ai"); ?>');
                }
            });
        },
        
        resetUI: function() {
            $('#start-bulk-process').show();
            $('#cancel-bulk-process').hide();
            this.isProcessing = false;
        },
        
        showError: function(message) {
            $('#progress-log').append('<div class="error-message">' + message + '</div>');
        }
    };
    
    bulkProcessor.init();
});
</script>
