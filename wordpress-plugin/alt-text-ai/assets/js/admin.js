/**
 * Alt-Text AI Admin JavaScript
 * Handles all admin interface interactions
 */

(function($) {
    'use strict';

    // Main Admin Object
    window.AltTextAIAdmin = {
        
        // Initialize the admin interface
        init: function() {
            this.bindEvents();
            this.initTooltips();
            this.initMediaFields();
        },

        // Bind all event handlers
        bindEvents: function() {
            // Generate alt-text buttons
            $(document).on('click', '.alt-text-ai-generate-btn', this.generateAltText);
            $(document).on('click', '.alt-text-ai-apply-btn', this.applyAltText);
            
            // Media library integration
            $(document).on('click', '.regenerate-alt-text', this.regenerateAltText);
            
            // Settings page interactions
            this.bindSettingsEvents();
            
            // Bulk processing
            this.bindBulkProcessEvents();
            
            // General UI interactions
            this.bindUIEvents();
        },

        // Settings page event bindings
        bindSettingsEvents: function() {
            // API key visibility toggle - use event delegation for reliability
            $(document).on('click', '#toggle-api-key', function(e) {
                e.preventDefault();
                var $input = $('#api_key');
                var $icon = $(this).find('.dashicons');
                
                if ($input.length === 0) {
                    console.error('Alt Text Pro: API key input field not found');
                    return;
                }
                
                if ($input.attr('type') === 'password') {
                    $input.attr('type', 'text');
                    $icon.removeClass('dashicons-visibility').addClass('dashicons-hidden');
                } else {
                    $input.attr('type', 'password');
                    $icon.removeClass('dashicons-hidden').addClass('dashicons-visibility');
                }
            });

            // Test API connection
            $(document).on('click', '#test-connection', this.testAPIConnection);
            
            // Settings form validation
            $(document).on('submit', '.alt-text-ai-settings-form', this.validateSettingsForm);
        },

        // Bulk processing event bindings
        bindBulkProcessEvents: function() {
            // Process type selection
            $(document).on('change', 'input[name="process_type"]', function() {
                if ($(this).val() === 'selected') {
                    $('#image-selection-sidebar').slideDown();
                } else {
                    $('#image-selection-sidebar').slideUp();
                }
            });

            // Select all/deselect all images
            $(document).on('click', '#select-all-images', function() {
                $('#image-list input[type="checkbox"]').prop('checked', true);
                AltTextAIAdmin.updateSelectionCount();
            });

            $(document).on('click', '#deselect-all-images', function() {
                $('#image-list input[type="checkbox"]').prop('checked', false);
                AltTextAIAdmin.updateSelectionCount();
            });

            // Individual image selection
            $(document).on('change', '#image-list input[type="checkbox"]', this.updateSelectionCount);
        },

        // General UI event bindings
        bindUIEvents: function() {
            // Collapsible sections
            $(document).on('click', '.section-toggle', this.toggleSection);
            
            // Copy to clipboard functionality
            $(document).on('click', '.copy-to-clipboard', this.copyToClipboard);
            
            // Refresh buttons
            $(document).on('click', '.refresh-data', this.refreshData);
            
            // Modal dialogs
            $(document).on('click', '.open-modal', this.openModal);
            $(document).on('click', '.close-modal, .modal-overlay', this.closeModal);
        },

        // Generate alt-text for a single image
        generateAltText: function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var $container = $button.closest('.alt-text-ai-media-field');
            var attachmentId = $button.data('attachment-id');
            var context = $container.find('input[name*="[alt_text_ai_context]"]').val() || '';
            
            if (!attachmentId) {
                AltTextAIAdmin.showError('Invalid attachment ID');
                return;
            }

            // Show loading state
            AltTextAIAdmin.showLoading($container);
            $button.prop('disabled', true);

            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_ai_generate',
                    attachment_id: attachmentId,
                    context: context,
                    nonce: altTextAI.nonce
                },
                success: function(response) {
                    if (response.success) {
                        AltTextAIAdmin.showSuccess($container, response.data);
                    } else {
                        AltTextAIAdmin.showError(response.data || altTextAI.strings.error);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Alt Text Pro AJAX Error:', {
                        status: status,
                        error: error,
                        response: xhr.responseText
                    });
                    AltTextAIAdmin.showError(altTextAI.strings.error + ' (Check console for details)');
                },
                complete: function() {
                    AltTextAIAdmin.hideLoading($container);
                    $button.prop('disabled', false);
                }
            });
        },

        // Apply generated alt-text to the image
        applyAltText: function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var $container = $button.closest('.alt-text-ai-media-field');
            var altText = $button.data('alt-text');
            
            // Update the WordPress alt-text field
            var $altField = $('input[name*="[alt]"], textarea[name*="[alt]"]').first();
            if ($altField.length) {
                $altField.val(altText).trigger('change');
            }
            
            // Update current alt-text display
            $container.find('.current-alt-text').text(altText);
            
            // Hide the success message
            $container.find('.alt-text-ai-success').slideUp();
            
            AltTextAIAdmin.showNotification(altTextAI.strings.success, 'success');
        },

        // Regenerate alt-text for existing image
        regenerateAltText: function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var attachmentId = $button.data('attachment-id');
            var context = $button.data('context') || '';
            
            if (!confirm('Are you sure you want to regenerate alt-text for this image? This will use 1 credit.')) {
                return;
            }
            
            var originalHtml = $button.html();
            $button.html('<span class="dashicons dashicons-update rotating"></span> Generating...').prop('disabled', true);
            
            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_ai_regenerate',
                    attachment_id: attachmentId,
                    context: context,
                    force_overwrite: true,
                    nonce: altTextAI.nonce
                },
                success: function(response) {
                    if (response.success) {
                        // Update alt-text display if present
                        var $altTextDisplay = $button.closest('tr').find('.alt-text-preview');
                        if ($altTextDisplay.length) {
                            $altTextDisplay.text(response.data.alt_text);
                        }
                        
                        $button.html('<span class="dashicons dashicons-yes"></span> Updated!');
                        setTimeout(function() {
                            $button.html(originalHtml);
                        }, 3000);
                        
                        AltTextAIAdmin.showNotification('Alt-text updated successfully!', 'success');
                    } else {
                        AltTextAIAdmin.showNotification(response.data || 'Failed to regenerate alt-text', 'error');
                        $button.html(originalHtml);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Alt Text Pro Regenerate Error:', {
                        status: status,
                        error: error,
                        response: xhr.responseText
                    });
                    AltTextAIAdmin.showNotification('Failed to regenerate alt-text. Check console for details.', 'error');
                    $button.html(originalHtml).prop('disabled', false);
                },
                complete: function() {
                    $button.prop('disabled', false);
                }
            });
        },

        // Test API connection
        testAPIConnection: function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var $result = $('#connection-test-result');
            var apiKey = $('#api_key').val();
            
            if (!apiKey) {
                $result.html('<div class="notice notice-error"><p>Please enter an API key first.</p></div>');
                return;
            }
            
            var originalHtml = $button.html();
            $button.html('<span class="dashicons dashicons-update rotating"></span> Testing...').prop('disabled', true);
            $result.html('<div class="notice notice-info"><p>Testing connection...</p></div>');
            
            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_ai_test_connection',
                    api_key: apiKey,
                    nonce: altTextAI.nonce
                },
                success: function(response) {
                    if (response.success) {
                        var message = '<strong>' + response.data.message + '</strong>';
                        if (response.data.user_info) {
                            var userInfo = response.data.user_info;
                            message += '<br><small>Plan: ' + userInfo.plan + ' | Credits: ' + userInfo.credits_remaining + '</small>';
                        }
                        $result.html('<div class="notice notice-success"><p>' + message + '</p></div>');
                    } else {
                        $result.html('<div class="notice notice-error"><p>' + response.data + '</p></div>');
                    }
                },
                error: function() {
                    $result.html('<div class="notice notice-error"><p>Connection test failed</p></div>');
                },
                complete: function() {
                    $button.html(originalHtml).prop('disabled', false);
                }
            });
        },

        // Validate settings form before submission
        validateSettingsForm: function(e) {
            var apiKey = $('#api_key').val();
            
            if (apiKey && !AltTextAIAdmin.validateAPIKeyFormat(apiKey)) {
                e.preventDefault();
                AltTextAIAdmin.showNotification('Invalid API key format. API keys should start with "alt_" or "altai_".', 'error');
                $('#api_key').focus();
                return false;
            }
            
            return true;
        },

        // Validate API key format - accepts both alt_ and altai_ formats
        validateAPIKeyFormat: function(apiKey) {
            if (!apiKey || apiKey.length === 0) {
                return false;
            }
            
            // New format: alt_ followed by base64-like string (minimum 20 chars total)
            if (apiKey.indexOf('alt_') === 0) {
                return apiKey.length > 20;
            }
            
            // Legacy format: altai_[hash]_[random]_[timestamp]
            if (apiKey.indexOf('altai_') === 0) {
                return /^altai_[a-zA-Z0-9]+_[a-zA-Z0-9]+_[a-zA-Z0-9]+$/.test(apiKey);
            }
            
            return false;
        },

        // Update selection count for bulk processing
        updateSelectionCount: function() {
            var selectedCount = $('#image-list input[type="checkbox"]:checked').length;
            var totalCount = $('#image-list input[type="checkbox"]').length;
            
            $('.selection-count').text(selectedCount + ' of ' + totalCount + ' selected');
            
            // Enable/disable start button based on selection
            var processType = $('input[name="process_type"]:checked').val();
            if (processType === 'selected') {
                $('#start-bulk-process').prop('disabled', selectedCount === 0);
            }
        },

        // Show loading state
        showLoading: function($container) {
            $container.find('.alt-text-ai-loading').show();
            $container.find('.alt-text-ai-success, .alt-text-ai-error').hide();
        },

        // Hide loading state
        hideLoading: function($container) {
            $container.find('.alt-text-ai-loading').hide();
        },

        // Show success message with generated alt-text
        showSuccess: function($container, data) {
            var $success = $container.find('.alt-text-ai-success');
            $success.find('.generated-alt-text').text(data.alt_text);
            $success.find('.alt-text-ai-apply-btn').data('alt-text', data.alt_text);
            $success.show();
            
            // Update credits display if present
            if (data.credits_remaining !== undefined) {
                $('.credits-remaining').text(data.credits_remaining + ' credits remaining');
            }
        },

        // Show error message
        showError: function(message) {
            $('.alt-text-ai-error').text(message).show();
        },

        // Show notification
        showNotification: function(message, type) {
            type = type || 'info';
            
            var $notification = $('<div class="alt-text-ai-notification notice notice-' + type + ' is-dismissible">')
                .html('<p>' + message + '</p>')
                .hide();
            
            $('.wrap').prepend($notification);
            $notification.slideDown();
            
            // Auto-hide after 5 seconds
            setTimeout(function() {
                $notification.slideUp(function() {
                    $(this).remove();
                });
            }, 5000);
            
            // Make dismissible
            $notification.on('click', '.notice-dismiss', function() {
                $notification.slideUp(function() {
                    $(this).remove();
                });
            });
        },

        // Initialize tooltips
        initTooltips: function() {
            $('[data-tooltip]').each(function() {
                var $element = $(this);
                var tooltipText = $element.data('tooltip');
                
                $element.on('mouseenter', function() {
                    var $tooltip = $('<div class="alt-text-ai-tooltip">')
                        .text(tooltipText)
                        .appendTo('body');
                    
                    var offset = $element.offset();
                    $tooltip.css({
                        top: offset.top - $tooltip.outerHeight() - 10,
                        left: offset.left + ($element.outerWidth() / 2) - ($tooltip.outerWidth() / 2)
                    }).fadeIn();
                    
                    $element.data('tooltip-element', $tooltip);
                });
                
                $element.on('mouseleave', function() {
                    var $tooltip = $element.data('tooltip-element');
                    if ($tooltip) {
                        $tooltip.fadeOut(function() {
                            $(this).remove();
                        });
                    }
                });
            });
        },

        // Initialize media field interactions
        initMediaFields: function() {
            // Auto-resize textareas
            $(document).on('input', '.alt-text-ai-context input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
            
            // Context suggestions
            $(document).on('focus', '.alt-text-ai-context input', function() {
                var $input = $(this);
                var attachmentId = $input.closest('.alt-text-ai-media-field').find('.alt-text-ai-generate-btn').data('attachment-id');
                
                // Load context suggestions if not already loaded
                if (!$input.data('suggestions-loaded')) {
                    AltTextAIAdmin.loadContextSuggestions($input, attachmentId);
                }
            });
        },

        // Load context suggestions for an image
        loadContextSuggestions: function($input, attachmentId) {
            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_ai_get_context_suggestions',
                    attachment_id: attachmentId,
                    nonce: altTextAI.nonce
                },
                success: function(response) {
                    if (response.success && response.data.length > 0) {
                        var $suggestions = $('<div class="context-suggestions">');
                        
                        response.data.forEach(function(suggestion) {
                            var $suggestion = $('<button type="button" class="context-suggestion">')
                                .text(suggestion)
                                .on('click', function(e) {
                                    e.preventDefault();
                                    $input.val(suggestion);
                                    $suggestions.remove();
                                });
                            $suggestions.append($suggestion);
                        });
                        
                        $input.after($suggestions);
                        $input.data('suggestions-loaded', true);
                        
                        // Hide suggestions when clicking outside
                        $(document).on('click.context-suggestions', function(e) {
                            if (!$(e.target).closest('.context-suggestions, .alt-text-ai-context input').length) {
                                $suggestions.remove();
                                $(document).off('click.context-suggestions');
                            }
                        });
                    }
                }
            });
        },

        // Toggle collapsible sections
        toggleSection: function(e) {
            e.preventDefault();
            
            var $toggle = $(this);
            var $section = $toggle.closest('.collapsible-section');
            var $content = $section.find('.section-content');
            
            $content.slideToggle();
            $toggle.find('.dashicons').toggleClass('dashicons-arrow-down dashicons-arrow-up');
            $section.toggleClass('collapsed');
        },

        // Copy text to clipboard
        copyToClipboard: function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var textToCopy = $button.data('copy-text') || $button.closest('.copy-container').find('.copy-target').text();
            
            if (navigator.clipboard) {
                navigator.clipboard.writeText(textToCopy).then(function() {
                    AltTextAIAdmin.showCopySuccess($button);
                });
            } else {
                // Fallback for older browsers
                var textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                AltTextAIAdmin.showCopySuccess($button);
            }
        },

        // Show copy success feedback
        showCopySuccess: function($button) {
            var originalHtml = $button.html();
            $button.html('<span class="dashicons dashicons-yes"></span> Copied!');
            
            setTimeout(function() {
                $button.html(originalHtml);
            }, 2000);
        },

        // Refresh data
        refreshData: function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var dataType = $button.data('refresh-type') || 'usage';
            
            var originalHtml = $button.html();
            $button.html('<span class="dashicons dashicons-update rotating"></span> Refreshing...').prop('disabled', true);
            
            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_ai_refresh_' + dataType,
                    nonce: altTextAI.nonce
                },
                success: function(response) {
                    if (response.success) {
                        // Reload the page to show updated data
                        location.reload();
                    } else {
                        AltTextAIAdmin.showNotification(response.data || 'Failed to refresh data', 'error');
                    }
                },
                error: function() {
                    AltTextAIAdmin.showNotification('Failed to refresh data', 'error');
                },
                complete: function() {
                    $button.html(originalHtml).prop('disabled', false);
                }
            });
        },

        // Open modal dialog
        openModal: function(e) {
            e.preventDefault();
            
            var modalId = $(this).data('modal');
            var $modal = $('#' + modalId);
            
            if ($modal.length) {
                $modal.addClass('active');
                $('body').addClass('modal-open');
            }
        },

        // Close modal dialog
        closeModal: function(e) {
            if ($(e.target).hasClass('modal-overlay') || $(e.target).hasClass('close-modal')) {
                $('.modal').removeClass('active');
                $('body').removeClass('modal-open');
            }
        },

        // Utility function to format numbers
        formatNumber: function(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        },

        // Utility function to format file sizes
        formatFileSize: function(bytes) {
            if (bytes === 0) return '0 Bytes';
            
            var k = 1024;
            var sizes = ['Bytes', 'KB', 'MB', 'GB'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        // Utility function to debounce function calls
        debounce: function(func, wait, immediate) {
            var timeout;
            return function() {
                var context = this, args = arguments;
                var later = function() {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                var callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
        }
    };

    // Initialize when document is ready
    $(document).ready(function() {
        AltTextAIAdmin.init();
    });

    // Handle media modal events
    $(document).on('DOMNodeInserted', function(e) {
        if ($(e.target).hasClass('media-modal') || $(e.target).find('.media-modal').length) {
            // Re-initialize for dynamically loaded media modals
            setTimeout(function() {
                AltTextAIAdmin.initMediaFields();
            }, 100);
        }
    });

    // Export for global access
    window.AltTextAIAdmin = AltTextAIAdmin;

})(jQuery);
