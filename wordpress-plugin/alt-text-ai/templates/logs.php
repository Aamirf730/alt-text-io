<?php
/**
 * Logs Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="wrap alt-text-ai-logs">
    <div class="alt-text-ai-header">
        <div class="alt-text-ai-header-content">
            <div class="alt-text-ai-logo">
                <span class="dashicons dashicons-list-view"></span>
                <h1><?php _e('Usage & Logs', 'alt-text-ai'); ?></h1>
            </div>
            <div class="alt-text-ai-header-actions">
                <a href="<?php echo admin_url('admin.php?page=alt-text-ai'); ?>" class="button button-secondary">
                    <span class="dashicons dashicons-arrow-left-alt"></span>
                    <?php _e('Back to Dashboard', 'alt-text-ai'); ?>
                </a>
                <button type="button" class="button button-secondary" id="export-logs">
                    <span class="dashicons dashicons-download"></span>
                    <?php _e('Export Logs', 'alt-text-ai'); ?>
                </button>
            </div>
        </div>
    </div>

    <!-- Statistics Summary -->
    <div class="logs-stats-grid">
        <div class="stats-card">
            <div class="stats-card-header">
                <h3><?php _e('Total Generated', 'alt-text-ai'); ?></h3>
                <span class="dashicons dashicons-format-image"></span>
            </div>
            <div class="stats-card-content">
                <div class="stat-number"><?php echo number_format($stats['total_generated']); ?></div>
                <div class="stat-label"><?php _e('alt-texts created', 'alt-text-ai'); ?></div>
            </div>
        </div>

        <div class="stats-card">
            <div class="stats-card-header">
                <h3><?php _e('Credits Used', 'alt-text-ai'); ?></h3>
                <span class="dashicons dashicons-chart-area"></span>
            </div>
            <div class="stats-card-content">
                <div class="stat-number"><?php echo number_format($stats['total_credits_used']); ?></div>
                <div class="stat-label"><?php _e('total credits', 'alt-text-ai'); ?></div>
            </div>
        </div>

        <div class="stats-card">
            <div class="stats-card-header">
                <h3><?php _e('Today', 'alt-text-ai'); ?></h3>
                <span class="dashicons dashicons-calendar-alt"></span>
            </div>
            <div class="stats-card-content">
                <div class="stat-number"><?php echo number_format($stats['today_generated']); ?></div>
                <div class="stat-label"><?php _e('generated today', 'alt-text-ai'); ?></div>
            </div>
        </div>

        <div class="stats-card">
            <div class="stats-card-header">
                <h3><?php _e('This Month', 'alt-text-ai'); ?></h3>
                <span class="dashicons dashicons-calendar"></span>
            </div>
            <div class="stats-card-content">
                <div class="stat-number"><?php echo number_format($stats['this_month_generated']); ?></div>
                <div class="stat-label"><?php _e('this month', 'alt-text-ai'); ?></div>
            </div>
        </div>
    </div>

    <!-- Logs Table -->
    <div class="logs-table-container">
        <div class="logs-table-header">
            <h2><?php _e('Generation History', 'alt-text-ai'); ?></h2>
            <div class="table-filters">
                <input type="text" id="search-logs" placeholder="<?php _e('Search alt-text...', 'alt-text-ai'); ?>" class="regular-text">
                <select id="filter-date" class="regular-text">
                    <option value=""><?php _e('All dates', 'alt-text-ai'); ?></option>
                    <option value="today"><?php _e('Today', 'alt-text-ai'); ?></option>
                    <option value="week"><?php _e('This week', 'alt-text-ai'); ?></option>
                    <option value="month"><?php _e('This month', 'alt-text-ai'); ?></option>
                </select>
            </div>
        </div>

        <?php if (!empty($logs)): ?>
            <div class="logs-table-wrapper">
                <table class="wp-list-table widefat fixed striped logs-table">
                    <thead>
                        <tr>
                            <th class="column-image"><?php _e('Image', 'alt-text-ai'); ?></th>
                            <th class="column-alt-text"><?php _e('Generated Alt-Text', 'alt-text-ai'); ?></th>
                            <th class="column-credits"><?php _e('Credits', 'alt-text-ai'); ?></th>
                            <th class="column-date"><?php _e('Date', 'alt-text-ai'); ?></th>
                            <th class="column-actions"><?php _e('Actions', 'alt-text-ai'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($logs as $log): ?>
                            <tr class="log-row" data-alt-text="<?php echo esc_attr(strtolower($log->alt_text)); ?>" data-date="<?php echo esc_attr($log->created_at); ?>">
                                <td class="column-image">
                                    <div class="image-info">
                                        <?php
                                        $image_url = wp_get_attachment_image_url($log->attachment_id, 'thumbnail');
                                        $image_title = $log->post_title ?: sprintf(__('Image #%d', 'alt-text-ai'), $log->attachment_id);
                                        ?>
                                        <div class="image-thumbnail">
                                            <?php if ($image_url): ?>
                                                <img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($log->alt_text); ?>">
                                            <?php else: ?>
                                                <span class="dashicons dashicons-format-image"></span>
                                            <?php endif; ?>
                                        </div>
                                        <div class="image-details">
                                            <strong><?php echo esc_html($image_title); ?></strong>
                                            <small>ID: <?php echo $log->attachment_id; ?></small>
                                        </div>
                                    </div>
                                </td>
                                <td class="column-alt-text">
                                    <div class="alt-text-content">
                                        <p class="alt-text-preview"><?php echo esc_html($log->alt_text); ?></p>
                                        <div class="alt-text-actions">
                                            <button type="button" class="button button-small copy-alt-text" data-alt-text="<?php echo esc_attr($log->alt_text); ?>">
                                                <span class="dashicons dashicons-admin-page"></span>
                                                <?php _e('Copy', 'alt-text-ai'); ?>
                                            </button>
                                        </div>
                                    </div>
                                </td>
                                <td class="column-credits">
                                    <span class="credits-used"><?php echo $log->credits_used; ?></span>
                                </td>
                                <td class="column-date">
                                    <div class="date-info">
                                        <strong><?php echo date_i18n(get_option('date_format'), strtotime($log->created_at)); ?></strong>
                                        <small><?php echo date_i18n(get_option('time_format'), strtotime($log->created_at)); ?></small>
                                        <div class="relative-time">
                                            <?php echo human_time_diff(strtotime($log->created_at), current_time('timestamp')); ?> <?php _e('ago', 'alt-text-ai'); ?>
                                        </div>
                                    </div>
                                </td>
                                <td class="column-actions">
                                    <div class="row-actions">
                                        <a href="<?php echo admin_url('post.php?post=' . $log->attachment_id . '&action=edit'); ?>" class="button button-small">
                                            <span class="dashicons dashicons-edit"></span>
                                            <?php _e('Edit', 'alt-text-ai'); ?>
                                        </a>
                                        <?php if ($log->guid): ?>
                                            <a href="<?php echo esc_url($log->guid); ?>" target="_blank" class="button button-small">
                                                <span class="dashicons dashicons-external"></span>
                                                <?php _e('View', 'alt-text-ai'); ?>
                                            </a>
                                        <?php endif; ?>
                                        <button type="button" class="button button-small regenerate-alt-text" data-attachment-id="<?php echo $log->attachment_id; ?>">
                                            <span class="dashicons dashicons-update"></span>
                                            <?php _e('Regenerate', 'alt-text-ai'); ?>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <?php if ($total_pages > 1): ?>
                <div class="logs-pagination">
                    <div class="pagination-info">
                        <?php
                        $start = ($current_page - 1) * $per_page + 1;
                        $end = min($current_page * $per_page, $total_logs);
                        printf(__('Showing %d-%d of %d entries', 'alt-text-ai'), $start, $end, $total_logs);
                        ?>
                    </div>
                    <div class="pagination-links">
                        <?php
                        $base_url = admin_url('admin.php?page=alt-text-ai-logs');
                        
                        if ($current_page > 1):
                        ?>
                            <a href="<?php echo $base_url . '&paged=1'; ?>" class="button">&laquo; <?php _e('First', 'alt-text-ai'); ?></a>
                            <a href="<?php echo $base_url . '&paged=' . ($current_page - 1); ?>" class="button">&lsaquo; <?php _e('Previous', 'alt-text-ai'); ?></a>
                        <?php endif; ?>
                        
                        <span class="current-page">
                            <?php printf(__('Page %d of %d', 'alt-text-ai'), $current_page, $total_pages); ?>
                        </span>
                        
                        <?php if ($current_page < $total_pages): ?>
                            <a href="<?php echo $base_url . '&paged=' . ($current_page + 1); ?>" class="button"><?php _e('Next', 'alt-text-ai'); ?> &rsaquo;</a>
                            <a href="<?php echo $base_url . '&paged=' . $total_pages; ?>" class="button"><?php _e('Last', 'alt-text-ai'); ?> &raquo;</a>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endif; ?>

        <?php else: ?>
            <!-- No Logs -->
            <div class="no-logs-message">
                <div class="no-logs-icon">
                    <span class="dashicons dashicons-list-view"></span>
                </div>
                <h3><?php _e('No logs found', 'alt-text-ai'); ?></h3>
                <p><?php _e('Alt-text generation logs will appear here once you start generating alt-text for your images.', 'alt-text-ai'); ?></p>
                <a href="<?php echo admin_url('admin.php?page=alt-text-ai-bulk'); ?>" class="button button-primary">
                    <?php _e('Start Generating Alt-Text', 'alt-text-ai'); ?>
                </a>
            </div>
        <?php endif; ?>
    </div>
</div>

<script type="text/javascript">
jQuery(document).ready(function($) {
    // Search functionality
    $('#search-logs').on('input', function() {
        var searchTerm = $(this).val().toLowerCase();
        $('.log-row').each(function() {
            var altText = $(this).data('alt-text');
            if (altText.includes(searchTerm)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    });

    // Date filter
    $('#filter-date').on('change', function() {
        var filterValue = $(this).val();
        var now = new Date();
        var filterDate;

        switch (filterValue) {
            case 'today':
                filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                filterDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            default:
                filterDate = null;
        }

        $('.log-row').each(function() {
            if (!filterDate) {
                $(this).show();
                return;
            }

            var logDate = new Date($(this).data('date'));
            if (logDate >= filterDate) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    });

    // Copy alt-text
    $('.copy-alt-text').on('click', function() {
        var altText = $(this).data('alt-text');
        var $button = $(this);
        
        navigator.clipboard.writeText(altText).then(function() {
            var originalText = $button.html();
            $button.html('<span class="dashicons dashicons-yes"></span> <?php _e("Copied!", "alt-text-ai"); ?>');
            setTimeout(function() {
                $button.html(originalText);
            }, 2000);
        }).catch(function() {
            // Fallback for older browsers
            var textArea = document.createElement('textarea');
            textArea.value = altText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            var originalText = $button.html();
            $button.html('<span class="dashicons dashicons-yes"></span> <?php _e("Copied!", "alt-text-ai"); ?>');
            setTimeout(function() {
                $button.html(originalText);
            }, 2000);
        });
    });

    // Regenerate alt-text
    $('.regenerate-alt-text').on('click', function() {
        var $button = $(this);
        var attachmentId = $button.data('attachment-id');
        var $row = $button.closest('.log-row');
        
        if (!confirm('<?php _e("Are you sure you want to regenerate alt-text for this image? This will use 1 credit.", "alt-text-ai"); ?>')) {
            return;
        }
        
        $button.prop('disabled', true).find('.dashicons').addClass('rotating');
        
        $.ajax({
            url: altTextAI.ajaxUrl,
            type: 'POST',
            data: {
                action: 'alt_text_ai_generate',
                attachment_id: attachmentId,
                context: '',
                nonce: altTextAI.nonce
            },
            success: function(response) {
                if (response.success) {
                    // Update the alt-text in the row
                    $row.find('.alt-text-preview').text(response.data.alt_text);
                    $row.find('.copy-alt-text').data('alt-text', response.data.alt_text);
                    
                    // Show success message
                    $button.html('<span class="dashicons dashicons-yes"></span> <?php _e("Updated!", "alt-text-ai"); ?>');
                    setTimeout(function() {
                        $button.html('<span class="dashicons dashicons-update"></span> <?php _e("Regenerate", "alt-text-ai"); ?>');
                    }, 3000);
                } else {
                    alert(response.data || '<?php _e("Failed to regenerate alt-text", "alt-text-ai"); ?>');
                }
            },
            error: function() {
                alert('<?php _e("Failed to regenerate alt-text", "alt-text-ai"); ?>');
            },
            complete: function() {
                $button.prop('disabled', false).find('.dashicons').removeClass('rotating');
            }
        });
    });

    // Export logs
    $('#export-logs').on('click', function() {
        var logs = [];
        $('.log-row:visible').each(function() {
            var $row = $(this);
            logs.push({
                attachment_id: $row.find('.regenerate-alt-text').data('attachment-id'),
                image_title: $row.find('.image-details strong').text(),
                alt_text: $row.find('.alt-text-preview').text(),
                credits_used: $row.find('.credits-used').text(),
                date: $row.data('date')
            });
        });

        var csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Image ID,Image Title,Alt-Text,Credits Used,Date\n";
        
        logs.forEach(function(log) {
            csvContent += '"' + log.attachment_id + '","' + log.image_title.replace(/"/g, '""') + '","' + log.alt_text.replace(/"/g, '""') + '","' + log.credits_used + '","' + log.date + '"\n';
        });

        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "alt-text-ai-logs-" + new Date().toISOString().split('T')[0] + ".csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});
</script>
