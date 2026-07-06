/**
 * Alt-Text AI Admin JavaScript
 * Handles all admin interface interactions
 */

(function ($) {
    'use strict';

    function debugLog() {
        if (window.altTextAI && window.altTextAI.debug && window.console && window.console.log) {
            window.console.log.apply(window.console, arguments);
        }
    }

    debugLog('Alt Text Pro: admin.js loading...');

    // Main Admin Object
    window.AltTextProAdmin = {

        // Initialize admin interface
        init: function () {
            this.bindEvents();
            this.initTooltips();
            this.initMediaFields();
            this.initOnboarding();
            this.updateSelectionCount();
        },

        // Bind all event handlers
        bindEvents: function () {
            // Generate alt-text buttons
            $(document).on('click', '.alt-text-pro-generate-btn', this.generateAltText);
            $(document).on('click', '.alt-text-pro-apply-btn', this.applyAltText);

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
        bindSettingsEvents: function () {
            // API key visibility toggle
            $(document).on('click', '#toggle-api-key', function (e) {
                e.preventDefault();
                e.stopPropagation();

                var $input = $('#api_key');
                var $button = $(this);
                var $icon = $button.find('.dashicons');

                if ($input.attr('type') === 'password') {
                    $input.attr('type', 'text');
                    $icon.removeClass('dashicons-visibility').addClass('dashicons-hidden');
                    $button.attr('aria-label', 'Hide API key');
                } else {
                    $input.attr('type', 'password');
                    $icon.removeClass('dashicons-hidden').addClass('dashicons-visibility');
                    $button.attr('aria-label', 'Show API key');
                }

                return false;
            });

            // Test API connection
            $(document).on('click', '#test-connection', this.testAPIConnection);

            // Settings form validation
            $(document).on('submit', '.alt-text-pro-settings-form', this.validateSettingsForm);

            // Onboarding save (manual key entry)
            $(document).on('click', '#onboarding-save', this.handleOnboardingSave);
            $(document).on('keydown', '#onboarding_api_key', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    AltTextProAdmin.handleOnboardingSave(e);
                }
            });

            // Auto-connect button (opens popup)
            $(document).on('click', '#auto-connect-btn', this.handleAutoConnect);

            // Listen for postMessage from the connect popup
            window.addEventListener('message', function (event) {
                var expectedOrigin = '';
                if (altTextAI.onboarding && altTextAI.onboarding.connectUrl) {
                    try {
                        expectedOrigin = new URL(altTextAI.onboarding.connectUrl).origin;
                    } catch (urlError) {
                        expectedOrigin = '';
                    }
                }

                if (expectedOrigin && event.origin && event.origin !== expectedOrigin) {
                    return;
                }

                if (event.data && event.data.type === 'ALT_TEXT_PRO_CONNECTED' && event.data.api_key) {
                    var storedState = sessionStorage.getItem('alt_text_pro_connect_state');
                    if (event.data.state && storedState && event.data.state !== storedState) {
                        console.warn('Alt Text Pro: state mismatch, ignoring postMessage callback');
                        return;
                    }

                    AltTextProAdmin.handleConnectCallback(event.data.api_key);
                }
            });

            // Check if we're receiving a callback via URL params (redirect flow)
            this.checkConnectCallback();
        },


        // Bulk processing event bindings - UI helpers only (start/cancel handled by inline script)
        bindBulkProcessEvents: function () {
            // Process type selection
            $(document).on('change', 'input[name="process_type"]', function () {
                var val = $(this).val();
                if (val === 'selected') {
                    $('#image-selection-sidebar').slideDown();
                } else {
                    $('#image-selection-sidebar').slideUp();
                }

                if (val === 'all') {
                    $('#overwrite-option-container').slideDown();
                } else {
                    $('#overwrite-option-container').slideUp();
                }

                AltTextProAdmin.updateSelectionCount();
            });

            // Select all/deselect all images
            $(document).on('click', '#select-all-images', function () {
                $('#image-list input[type="checkbox"]').prop('checked', true);
                AltTextProAdmin.updateSelectionCount();
            });

            $(document).on('click', '#deselect-all-images', function () {
                $('#image-list input[type="checkbox"]').prop('checked', false);
                AltTextProAdmin.updateSelectionCount();
            });

            // Individual image selection
            $(document).on('change', '#image-list input[type="checkbox"]', this.updateSelectionCount);
        },

        // General UI event bindings
        bindUIEvents: function () {
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
        generateAltText: function (e) {
            e.preventDefault();

            var $button = $(this);
            var $container = $button.closest('.alt-text-pro-media-field');
            var attachmentId = $button.data('attachment-id');
            // Try multiple selectors to ensure we get the context
            var context = $container.find('.alt-text-pro-context input').val();
            if (context === undefined || context === null) {
                context = $container.find('input[name*="[alt_text_pro_context]"]').val();
            }
            if (context === undefined || context === null) {
                context = $('#alt_text_pro_context_' + attachmentId).val();
            }
            context = context || '';

            debugLog('Alt Text Pro: Generating with context:', context);

            if (!attachmentId) {
                AltTextProAdmin.showError('Invalid attachment ID', $container);
                return;
            }

            // Show loading state
            AltTextProAdmin.showLoading($container);
            $button.prop('disabled', true);

            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_generate',
                    attachment_id: attachmentId,
                    context: context,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
                    if (response.success) {
                        AltTextProAdmin.showSuccess($container, response.data);
                    } else {
                        AltTextProAdmin.showError(response.data || altTextAI.strings.error, $container);
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Alt Text Pro AJAX Error:', {
                        status: status,
                        error: error,
                        response: xhr.responseText
                    });
                    AltTextProAdmin.showError(altTextAI.strings.error + ' (Check console for details)', $container);
                },
                complete: function () {
                    AltTextProAdmin.hideLoading($container);
                    $button.prop('disabled', false);
                }
            });
        },

        // Apply generated alt-text to the image
        applyAltText: function (e) {
            e.preventDefault();

            var $button = $(this);
            var $container = $button.closest('.alt-text-pro-media-field');
            var altText = $button.data('alt-text');

            // Update WordPress alt-text field
            var $altField = $('input[name*="[alt]"], textarea[name*="[alt]"]').first();
            if ($altField.length) {
                $altField.val(altText).trigger('change');
            }

            // Update current alt-text display
            $container.find('.current-alt-text').text(altText);

            // Hide the success message
            $container.find('.alt-text-pro-success').slideUp();

            AltTextProAdmin.showNotification(altTextAI.strings.success, 'success');
        },

        // Regenerate alt-text for existing image
        regenerateAltText: function (e) {
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
                    action: 'alt_text_pro_regenerate',
                    attachment_id: attachmentId,
                    context: context,
                    force_overwrite: true,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
                    if (response.success) {
                        // Update alt-text display if present
                        var $altTextDisplay = $button.closest('tr').find('.alt-text-preview');
                        if ($altTextDisplay.length) {
                            $altTextDisplay.text(response.data.alt_text);
                        }

                        $button.html('<span class="dashicons dashicons-yes"></span> Updated!');
                        setTimeout(function () {
                            $button.html(originalHtml);
                        }, 3000);

                        AltTextProAdmin.showNotification('Alt-text updated successfully!', 'success');
                    } else {
                        AltTextProAdmin.showNotification(response.data || 'Failed to regenerate alt-text', 'error');
                        $button.html(originalHtml);
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Alt Text Pro Regenerate Error:', {
                        status: status,
                        error: error,
                        response: xhr.responseText
                    });
                    AltTextProAdmin.showNotification('Failed to regenerate alt-text. Check console for details.', 'error');
                    $button.html(originalHtml).prop('disabled', false);
                },
                complete: function () {
                    $button.prop('disabled', false);
                }
            });
        },

        // Test API connection
        testAPIConnection: function (e) {
            e.preventDefault();

            var $button = $(this);
            var $result = $('#connection-test-result');
            var $input = $('#api_key');
            var apiKey = $.trim($input.val());
            var hasStoredKey = String($input.data('has-key')) === '1';
            var useSavedKey = !apiKey && hasStoredKey;

            if (!apiKey && !useSavedKey) {
                $result.html('<div class="notice notice-error"><p>Please enter an API key first.</p></div>');
                return;
            }

            var originalHtml = $button.html();
            $button.html('<span class="dashicons dashicons-update rotating"></span> Testing...').prop('disabled', true);
            $result.html('<div class="notice notice-info"><p>' + (useSavedKey ? 'Testing saved connection...' : 'Testing connection...') + '</p></div>');

            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_test_connection',
                    api_key: apiKey,
                    use_saved_key: useSavedKey ? 1 : 0,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
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
                error: function () {
                    $result.html('<div class="notice notice-error"><p>Connection test failed</p></div>');
                },
                complete: function () {
                    $button.html(originalHtml).prop('disabled', false);
                }
            });
        },

        // Validate settings form before submission
        validateSettingsForm: function (e) {
            var $input = $('#api_key');
            var apiKey = $.trim($input.val());
            $input.val(apiKey);

            // Empty is OK (will preserve existing)
            if (apiKey === '') {
                return true;
            }

            if (!AltTextProAdmin.validateAPIKeyFormat(apiKey)) {
                e.preventDefault();
                AltTextProAdmin.showNotification('Invalid API key format. API keys should start with "alt_" or "altai_".', 'error');
                $input.focus();
                return false;
            }

            return true;
        },

        // Validate API key format - accepts both alt_ and altai_ formats
        validateAPIKeyFormat: function (apiKey) {
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
        updateSelectionCount: function () {
            var selectedCount = $('#image-list input[type="checkbox"]:checked').length;
            $('.selection-count').text(selectedCount > 0 ? selectedCount + ' selected' : '');

            // Enable/disable start button based on selection
            var processType = $('input[name="process_type"]:checked').val();
            if (processType === 'selected') {
                $('#start-bulk-process').prop('disabled', selectedCount === 0).css('opacity', selectedCount === 0 ? '0.5' : '1');
            } else {
                $('#start-bulk-process').prop('disabled', false).css('opacity', '1');
            }
        },


        // Show loading state
        showLoading: function ($container) {
            // Show result container first, then show loading
            $container.find('.alt-text-pro-result').css('display', 'block').show();
            $container.find('.alt-text-pro-loading').css('display', 'block').show();
            $container.find('.alt-text-pro-success, .alt-text-pro-error').hide();
        },

        // Hide loading state
        hideLoading: function ($container) {
            $container.find('.alt-text-pro-loading').hide();
            // Only hide result container if there's no success or error message
            if (!$container.find('.alt-text-pro-success:visible, .alt-text-pro-error:visible').length) {
                $container.find('.alt-text-pro-result').hide();
            }
        },

        // Show success message with generated alt-text
        showSuccess: function ($container, data) {
            // Ensure result container is visible
            $container.find('.alt-text-pro-result').css('display', 'block').show();

            var $success = $container.find('.alt-text-pro-success');
            $success.find('.generated-alt-text').text(data.alt_text);
            $success.find('.alt-text-pro-apply-btn').data('alt-text', data.alt_text);
            $success.css('display', 'block').show();

            // Update credits display if present
            if (data.credits_remaining !== undefined) {
                $('.credits-remaining').text(data.credits_remaining + ' credits remaining');
            }
        },

        // Show error message
        showError: function (message, $container) {
            // If container is provided, show error in that container
            if ($container && $container.length) {
                $container.find('.alt-text-pro-result').css('display', 'block').show();
                $container.find('.alt-text-pro-error').text(message).css('display', 'block').show();
                $container.find('.alt-text-pro-success, .alt-text-pro-loading').hide();
            } else {
                // Fallback to global error display
                $('.alt-text-pro-error').text(message).show();
            }
        },

        // Show notification
        showNotification: function (message, type) {
            type = type || 'info';

            var $notification = $('<div class="alt-text-pro-notification notice notice-' + type + ' is-dismissible">')
                .html('<p>' + message + '</p>')
                .hide();

            $('.wrap').prepend($notification);
            $notification.slideDown();

            // Auto-hide after 5 seconds
            setTimeout(function () {
                $notification.slideUp(function () {
                    $(this).remove();
                });
            }, 5000);

            // Make dismissible
            $notification.on('click', '.notice-dismiss', function () {
                $notification.slideUp(function () {
                    $(this).remove();
                });
            });
        },

        // Initialize tooltips
        initTooltips: function () {
            $('[data-tooltip]').each(function () {
                var $element = $(this);
                var tooltipText = $element.data('tooltip');

                $element.on('mouseenter', function () {
                    var $tooltip = $('<div class="alt-text-pro-tooltip">')
                        .text(tooltipText)
                        .appendTo('body');

                    var offset = $element.offset();
                    $tooltip.css({
                        top: offset.top - $tooltip.outerHeight() - 10,
                        left: offset.left + ($element.outerWidth() / 2) - ($tooltip.outerWidth() / 2)
                    }).fadeIn();

                    $element.data('tooltip-element', $tooltip);
                });

                $element.on('mouseleave', function () {
                    var $tooltip = $element.data('tooltip-element');
                    if ($tooltip) {
                        $tooltip.fadeOut(function () {
                            $(this).remove();
                        });
                    }
                });
            });
        },

        // Initialize media field interactions
        initMediaFields: function () {
            // Ensure all result containers are hidden on page load
            $('.alt-text-pro-result').hide();
            $('.alt-text-pro-loading').hide();
            $('.alt-text-pro-success').hide();
            $('.alt-text-pro-error').hide();

            // Auto-resize textareas
            $(document).on('input', '.alt-text-pro-context input', function () {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });

            // Context suggestions
            $(document).on('focus', '.alt-text-pro-context input', function () {
                var $input = $(this);
                var attachmentId = $input.closest('.alt-text-pro-media-field').find('.alt-text-pro-generate-btn').data('attachment-id');

                // Load context suggestions if not already loaded
                if (!$input.data('suggestions-loaded')) {
                    AltTextProAdmin.loadContextSuggestions($input, attachmentId);
                }
            });
        },

        // Load context suggestions for an image
        loadContextSuggestions: function ($input, attachmentId) {
            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_get_context_suggestions',
                    attachment_id: attachmentId,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
                    if (response.success && response.data.length > 0) {
                        var $suggestions = $('<div class="context-suggestions">');

                        response.data.forEach(function (suggestion) {
                            var $suggestion = $('<button type="button" class="context-suggestion">')
                                .text(suggestion)
                                .on('click', function (e) {
                                    e.preventDefault();
                                    $input.val(suggestion);
                                    $suggestions.remove();
                                });
                            $suggestions.append($suggestion);
                        });

                        $input.after($suggestions);
                        $input.data('suggestions-loaded', true);

                        // Hide suggestions when clicking outside
                        $(document).on('click.context-suggestions', function (e) {
                            if (!$(e.target).closest('.context-suggestions, .alt-text-pro-context input').length) {
                                $suggestions.remove();
                                $(document).off('click.context-suggestions');
                            }
                        });
                    }
                }
            });
        },

        // Toggle collapsible sections
        toggleSection: function (e) {
            e.preventDefault();

            var $toggle = $(this);
            var $section = $toggle.closest('.collapsible-section');
            var $content = $section.find('.section-content');

            $content.slideToggle();
            $toggle.find('.dashicons').toggleClass('dashicons-arrow-down dashicons-arrow-up');
            $section.toggleClass('collapsed');
        },

        // Copy text to clipboard
        copyToClipboard: function (e) {
            e.preventDefault();

            var $button = $(this);
            var textToCopy = $button.data('copy-text') || $button.closest('.copy-container').find('.copy-target').text();

            if (navigator.clipboard) {
                navigator.clipboard.writeText(textToCopy).then(function () {
                    AltTextProAdmin.showCopySuccess($button);
                });
            } else {
                // Fallback for older browsers
                var textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                AltTextProAdmin.showCopySuccess($button);
            }
        },

        // Show copy success feedback
        showCopySuccess: function ($button) {
            var originalHtml = $button.html();
            $button.html('<span class="dashicons dashicons-yes"></span> Copied!');

            setTimeout(function () {
                $button.html(originalHtml);
            }, 2000);
        },

        // Refresh data
        refreshData: function (e) {
            e.preventDefault();

            var $button = $(this);
            var dataType = $button.data('refresh-type') || 'usage';

            var originalHtml = $button.html();
            $button.html('<span class="dashicons dashicons-update rotating"></span> Refreshing...').prop('disabled', true);

            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_refresh_' + dataType,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
                    if (response.success) {
                        // Reload the page to show updated data
                        location.reload();
                    } else {
                        AltTextProAdmin.showNotification(response.data || 'Failed to refresh data', 'error');
                    }
                },
                error: function () {
                    AltTextProAdmin.showNotification('Failed to refresh data', 'error');
                },
                complete: function () {
                    $button.html(originalHtml).prop('disabled', false);
                }
            });
        },

        // Open modal dialog
        openModal: function (e) {
            e.preventDefault();

            var modalId = $(this).data('modal');
            var $modal = $('#' + modalId);

            if ($modal.length) {
                $modal.addClass('active');
                $('body').addClass('modal-open');
                $modal.find('input, button, a').first().trigger('focus');
            }
        },

        // Close modal dialog
        closeModal: function (e) {
            if ($(e.target).hasClass('modal-overlay') || $(e.target).hasClass('close-modal')) {
                $('.modal').removeClass('active');
                $('body').removeClass('modal-open');
            }
        },

        // Init onboarding modal logic
        initOnboarding: function () {
            if (typeof altTextAI === 'undefined' || !altTextAI.onboarding) {
                return;
            }

            var modalId = altTextAI.onboarding.modalId || 'alt-text-pro-onboarding-modal';
            var $modal = $('#' + modalId);

            if (!$modal.length) {
                return;
            }

            // Auto-open if no API key is set
            if (altTextAI.onboarding.show) {
                // Scroll to top to ensure modal is visible
                window.scrollTo({ top: 0, behavior: 'smooth' });
                // Small delay to ensure scroll completes
                var self = this;
                setTimeout(function () {
                    self.showModalById(modalId);
                    $('#onboarding_api_key').trigger('focus');
                }, 100);
            }
        },

        showModalById: function (modalId) {
            var $modal = $('#' + modalId);
            if ($modal.length) {
                // Ensure page is scrolled to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
                $modal.addClass('active');
                $('body').addClass('modal-open');
                // Focus management for accessibility
                $modal.find('.modal-content').attr('tabindex', '-1').focus();
            }
        },

        setOnboardingMessage: function (message, type) {
            var $msg = $('#onboarding-message');
            $msg.removeClass('success error').addClass(type || '');
            $msg.text(message);
        },

        handleOnboardingSave: function (e) {
            e.preventDefault();

            var apiKey = $('#onboarding_api_key').val();
            if (!AltTextProAdmin.validateAPIKeyFormat(apiKey)) {
                AltTextProAdmin.setOnboardingMessage(altTextAI.strings.onboardingInvalidFormat || 'Invalid API key format.', 'error');
                $('#onboarding_api_key').focus();
                return;
            }

            AltTextProAdmin.setOnboardingMessage(altTextAI.strings.generating || 'Validating...', '');

            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_validate_key',
                    api_key: apiKey,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
                    if (response.success) {
                        AltTextProAdmin.setOnboardingMessage(altTextAI.strings.onboardingSaved || 'API key saved successfully!', 'success');
                        // Mirror into settings field if present
                        $('#api_key').val(apiKey);
                        altTextAI.onboarding.show = false;
                        setTimeout(function () {
                            $('.modal').removeClass('active');
                            $('body').removeClass('modal-open');
                            location.reload();
                        }, 800);
                    } else {
                        AltTextProAdmin.setOnboardingMessage(response.data || altTextAI.strings.invalidKey, 'error');
                    }
                },
                error: function () {
                    AltTextProAdmin.setOnboardingMessage(altTextAI.strings.connectionTestFailed || 'Validation failed.', 'error');
                }
            });
        },

        // Auto-connect: open popup to alt-text.pro/connect
        handleAutoConnect: function (e) {
            if (e) e.preventDefault();

            var connectUrl = (altTextAI.onboarding && altTextAI.onboarding.connectUrl)
                ? altTextAI.onboarding.connectUrl
                : 'https://www.alt-text.pro/connect';
            var settingsUrl = (altTextAI.onboarding && altTextAI.onboarding.settingsUrl)
                ? altTextAI.onboarding.settingsUrl
                : window.location.href;

            // Generate a random state for CSRF protection
            var state = 'atp_' + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('alt_text_pro_connect_state', state);

            // Build connect URL with callback
            var url = connectUrl
                + '?callback_url=' + encodeURIComponent(settingsUrl)
                + '&state=' + encodeURIComponent(state)
                + '&source=wordpress_plugin'
                + '&plugin_version=' + encodeURIComponent(altTextAI.version || '');

            // Update button state
            var $btn = $('#auto-connect-btn');
            $btn.prop('disabled', true).text('Connecting...');
            $('#auto-connect-status').show().html(
                '<span style="color: var(--text-secondary);">&#8987; Waiting for you to sign in...</span>'
            );

            // Open popup
            var w = 500, h = 700;
            var left = (screen.width / 2) - (w / 2);
            var top = (screen.height / 2) - (h / 2);
            var popup = window.open(
                url,
                'alt_text_pro_connect',
                'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',scrollbars=yes,resizable=yes'
            );

            // Poll to detect if popup was closed without completing
            var pollTimer = setInterval(function () {
                if (popup && popup.closed) {
                    clearInterval(pollTimer);
                    $btn.prop('disabled', false).html(
                        '<span class="dashicons dashicons-admin-links" style="margin-right: 6px; line-height: inherit;"></span> Connect Account'
                    );
                    // Only show "cancelled" if we didn't get a key
                    var storedState = sessionStorage.getItem('alt_text_pro_connect_state');
                    if (storedState) {
                        $('#auto-connect-status').html(
                            '<span style="color: var(--text-secondary);">Popup closed. Try again or use manual entry.</span>'
                        );
                    }
                }
            }, 1000);
        },

        // Handle API key received from connect popup or redirect
        handleConnectCallback: function (apiKey) {
            if (!apiKey) return;

            // Clear state
            sessionStorage.removeItem('alt_text_pro_connect_state');

            // Show connecting status
            $('#auto-connect-status').show().html(
                '<span style="color: var(--primary-color);">&#10003; Key received! Saving...</span>'
            );

            // Save via AJAX (reuses existing validate_key action)
            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_validate_key',
                    api_key: apiKey,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
                    if (response.success) {
                        $('#auto-connect-status').html(
                            '<span style="color: var(--success-color, #16a34a); font-weight: 600;">&#10003; Connected successfully!</span>'
                        );
                        // Mirror into settings field
                        $('#api_key').val(apiKey);
                        $('#onboarding_api_key').val(apiKey);
                        altTextAI.onboarding.show = false;

                        AltTextProAdmin.showNotification('Connected successfully! Your API key has been saved.', 'success');

                        setTimeout(function () {
                            $('.modal').removeClass('active');
                            $('body').removeClass('modal-open');
                            location.reload();
                        }, 1500);
                    } else {
                        $('#auto-connect-status').html(
                            '<span style="color: var(--error-color, #dc2626);">&#10007; ' + (response.data || 'Invalid API key') + '</span>'
                        );
                    }
                },
                error: function () {
                    $('#auto-connect-status').html(
                        '<span style="color: var(--error-color, #dc2626);">&#10007; Failed to save. Please try manual entry.</span>'
                    );
                }
            });
        },

        // Check URL for callback params (redirect flow fallback)
        checkConnectCallback: function () {
            var urlParams = new URLSearchParams(window.location.search);
            var apiKey = urlParams.get('alt_text_pro_api_key');
            var state = urlParams.get('state');

            if (!apiKey) return;

            // Verify CSRF state
            var storedState = sessionStorage.getItem('alt_text_pro_connect_state');
            if (state && storedState && state !== storedState) {
                console.warn('Alt Text Pro: state mismatch, ignoring callback');
                return;
            }

            // Clean URL (remove API key from address bar)
            var cleanUrl = window.location.href.split('?')[0] + '?page=alt-text-pro-settings';
            window.history.replaceState({}, document.title, cleanUrl);

            // Process the key
            this.handleConnectCallback(apiKey);
        },

        // Utility function to format numbers
        formatNumber: function (num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        },

        // Utility function to format file sizes
        formatFileSize: function (bytes) {
            if (bytes === 0) return '0 Bytes';

            var k = 1024;
            var sizes = ['Bytes', 'KB', 'MB', 'GB'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));

            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        // Utility function to debounce function calls
        debounce: function (func, wait, immediate) {
            var timeout;
            return function () {
                var context = this, args = arguments;
                var later = function () {
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

    // Handle media modal events
    $(document).on('DOMNodeInserted', function (e) {
        if ($(e.target).hasClass('media-modal') || $(e.target).find('.media-modal').length) {
            // Re-initialize for dynamically loaded media modals
            setTimeout(function () {
                AltTextProAdmin.initMediaFields();
            }, 100);
        }
    });

    // Export for global access
    window.AltTextProAdmin = AltTextProAdmin;

    // Bulk Processor Object (Migrated from inline script)
    window.bulkProcessor = {
        processId: null,
        isProcessing: false,
        cancelRequested: false,
        pendingCancel: false,
        startRequest: null,
        pendingBatchRequests: [],
        statusInterval: null,
        processingBatches: {},
        notificationsShown: {},
        nextBatchTimer: null,
        scheduledBatchOffset: null,
        batchDelayMs: 15000,

        init: function () {
            debugLog('Alt Text Pro: Initializing bulk processor');
        },

        startProcessing: function () {
            if (this.isProcessing) return;

            var self = this;
            var processType = $('input[name="process_type"]:checked').val();
            var overwriteExisting = $('#overwrite_existing').is(':checked');
            var selectedImages = [];
            var batchSize = 1;

            if (processType === 'selected') {
                $('input[name="selected_images[]"]:checked').each(function () {
                    selectedImages.push($(this).val());
                });

                if (selectedImages.length === 0) {
                    alert('Please select at least one image.');
                    return;
                }
            }

            debugLog('Alt Text Pro: Starting bulk process', { type: processType, overwrite: overwriteExisting });

            this.isProcessing = true;
            this.cancelRequested = false;
            this.pendingCancel = false;
            this.processId = null;
            this.pendingBatchRequests = [];
            this.processingBatches = {};
            this.clearScheduledBatch();

            // UI setup
            $('#start-bulk-process').hide();
            $('#cancel-bulk-process').attr('style', 'display: inline-flex !important;').show();
            $('#progress-card').slideDown();
            $('#results-card').hide();
            $('#progress-status').text('Initializing...').removeClass('success error').addClass('warning');
            $('#progress-fill').css('width', '0%');
            $('#progress-text').text('0%');
            $('#processed-count').text('0 / 0');
            $('#successful-count').text('0');
            $('#error-count').text('0');
            $('#progress-log').empty().append('<div>Starting bulk optimization...</div>');

            this.startRequest = $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_bulk_start',
                    process_type: processType,
                    overwrite_existing: overwriteExisting ? 1 : 0,
                    selected_images: selectedImages,
                    batch_size: batchSize,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
                    if (response.success) {
                        self.processId = response.data.process_id;
                        var total = response.data.total_images || 0;
                        var queueTotal = response.data.queue_total_images || total;
                        var processableTotal = response.data.processable_images || total;
                        var creditsRemaining = response.data.credits_remaining;

                        $('#processed-count').text('0 / ' + processableTotal);
                        self.updateProcessLimitNote({
                            queue_total_images: queueTotal,
                            processable_images: processableTotal,
                            credits_remaining: creditsRemaining,
                            plan_allowance: response.data.plan_allowance,
                            plan_credits_used_at_start: response.data.plan_credits_used
                        });

                        $('#progress-log').append('<div>Initialized process #' + self.processId + ' (up to ' + processableTotal + ' images can run with available plan credits)</div>');

                        if (total === 0) {
                            self.finishProcess({ success: true, processed: 0, successful: 0, errors: 0 });
                            return;
                        }

                        if (self.cancelRequested) {
                            self.sendCancelRequest();
                            return;
                        }

                        self.startStatusPolling();
                    } else {
                        self.showError(response.data || 'Failed to start bulk process');
                        self.resetUI();
                    }
                },
                error: function (xhr, status, error) {
                    if (status !== 'abort') {
                        console.error('Alt Text Pro: Bulk start error', error);
                        self.showError('Failed to connect to server');
                        self.resetUI();
                    }
                }
            });
        },

        cancelProcessing: function () {
            if (!this.isProcessing || this.cancelRequested) return;

            debugLog('Alt Text Pro: Cancel requested');
            this.cancelRequested = true;
            this.pendingCancel = true;
            this.isProcessing = false;
            this.clearScheduledBatch();

            if (this.statusInterval) {
                clearInterval(this.statusInterval);
                this.statusInterval = null;
            }

            if (this.startRequest && this.processId) {
                this.startRequest.abort();
            }

            if (this.statusRequest) {
                this.statusRequest.abort();
            }

            // If we have any pending batch requests, abort them
            this.pendingBatchRequests.forEach(function (req) {
                if (req && req.abort) req.abort();
            });
            this.pendingBatchRequests = [];
            this.processingBatches = {};

            if (!this.processId) {
                $('#progress-status').text('Cancelling...').removeClass('success').addClass('warning');
                return;
            }

            this.sendCancelRequest();
        },

        sendCancelRequest: function () {
            var self = this;
            if (!this.processId) {
                this.resetUI();
                $('#progress-status').text('Cancelled').removeClass('warning success').addClass('error');
                return;
            }

            $('#progress-status').text('Cancelling...').removeClass('success').addClass('warning');

            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_bulk_cancel',
                    process_id: this.processId,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
                    if (response.success) {
                        self.finishProcess(response.data || { status: 'cancelled' });
                    } else {
                        self.resetUI();
                    }
                },
                error: function () {
                    self.resetUI();
                }
            });
        },

        startStatusPolling: function () {
            var self = this;
            this.pollStatus();
            this.statusInterval = setInterval(function () {
                self.pollStatus();
            }, 1000);
        },

        pollStatus: function () {
            var self = this;
            if (!this.processId || !this.isProcessing || this.cancelRequested) return;

            this.statusRequest = $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_bulk_status',
                    process_id: this.processId,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
                    if (response.success) {
                        if (self.cancelRequested || self.pendingCancel) return;

                        self.updateProgress(response.data);

                        if (response.data.status === 'completed' || response.data.status === 'cancelled' || response.data.status === 'error' || response.data.status === 'stopped_no_credits') {
                            self.finishProcess(response.data);
                            return;
                        }

                        // Schedule the next billable request after the UI has rendered the latest count.
                        if (response.data.needs_next_batch && response.data.next_batch_offset !== null) {
                            self.scheduleNextBatch(response.data.next_batch_offset, response.data.retry_after_seconds);
                        }
                    }
                }
            });
        },

        scheduleNextBatch: function (offset, retryAfterSeconds) {
            var self = this;
            if (this.cancelRequested || this.pendingCancel || !this.isProcessing || !this.processId) return;
            if (this.processingBatches[offset]) return;
            if (this.nextBatchTimer && this.scheduledBatchOffset === offset) return;

            var delayMs = this.batchDelayMs;
            if (retryAfterSeconds) {
                delayMs = Math.max(delayMs, parseInt(retryAfterSeconds, 10) * 1000);
                $('#progress-status').text('Waiting for AI rate limit reset...');
            }

            this.clearScheduledBatch();
            this.scheduledBatchOffset = offset;
            this.nextBatchTimer = setTimeout(function () {
                self.nextBatchTimer = null;
                self.scheduledBatchOffset = null;

                if (self.cancelRequested || self.pendingCancel || !self.isProcessing) return;
                self.triggerNextBatch(offset);
            }, delayMs);
        },

        clearScheduledBatch: function () {
            if (this.nextBatchTimer) {
                clearTimeout(this.nextBatchTimer);
                this.nextBatchTimer = null;
            }
            this.scheduledBatchOffset = null;
        },

        triggerNextBatch: function (offset) {
            var self = this;
            if (this.cancelRequested || this.pendingCancel || !this.isProcessing || !this.processId) return;

            // Prevent duplicate requests for same offset
            if (this.processingBatches[offset]) return;
            this.processingBatches[offset] = true;

            debugLog('Alt Text Pro: Triggering batch at offset ' + offset);

            var batchReq = $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_bulk_process_batch',
                    process_id: this.processId,
                    batch_offset: offset,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
                    // Remove from pending list
                    var idx = self.pendingBatchRequests.indexOf(batchReq);
                    if (idx > -1) self.pendingBatchRequests.splice(idx, 1);
                    delete self.processingBatches[offset];
                    if (self.cancelRequested || self.pendingCancel) return;

                    if (response.success && response.data && response.data.batch_results) {
                        self.appendBatchResults(response.data.batch_results);
                    }

                    if (response.success && response.data) {
                        self.updateProgress(response.data);

                        if (response.data.status === 'completed' || response.data.status === 'cancelled' || response.data.status === 'stopped_no_credits') {
                            self.finishProcess(response.data);
                            return;
                        }

                        if (response.data.needs_next_batch && response.data.next_batch_offset !== null) {
                            self.scheduleNextBatch(response.data.next_batch_offset, response.data.retry_after_seconds);
                        }
                    } else {
                        self.pollStatus();
                    }
                },
                error: function () {
                    var idx = self.pendingBatchRequests.indexOf(batchReq);
                    if (idx > -1) self.pendingBatchRequests.splice(idx, 1);
                    delete self.processingBatches[offset];
                },
                complete: function () {
                    // Remove from pending list
                    var idx = self.pendingBatchRequests.indexOf(batchReq);
                    if (idx > -1) self.pendingBatchRequests.splice(idx, 1);
                }
            });

            this.pendingBatchRequests.push(batchReq);
        },

        updateProgress: function (data) {
            var total = data.total_images || 0;
            var displayTotal = data.processable_images || total;
            var processed = data.processed_count !== undefined ? data.processed_count : (data.processed || 0);
            var percent = displayTotal > 0 ? Math.round((processed / displayTotal) * 100) : 100;
            percent = Math.min(percent, 100);

            $('#progress-fill').css('width', percent + '%');
            $('#progress-text').text(percent + '%');
            $('#processed-count').text(processed + ' / ' + displayTotal);
            $('#successful-count').text(data.successful_count !== undefined ? data.successful_count : (data.successful || 0));
            $('#error-count').text(data.error_count !== undefined ? data.error_count : (data.errors ? data.errors.length : 0));
            this.updateProcessLimitNote(data);

            if (data.retry_after_seconds) {
                $('#progress-status').text('Waiting for AI rate limit reset...');
                return;
            }

            if (data.status === 'processing' || data.status === 'running') {
                $('#progress-status').text('Processing...');
            }
        },

        appendBatchResults: function (results) {
            if (!results || !results.length) return;

            var $log = $('#progress-log');
            var self = this;

            results.forEach(function (result) {
                var icon = 'dashicons-yes';
                var statusClass = 'success';
                var statusText = 'Success';

                if (result.status === 'error') {
                    icon = 'dashicons-no-alt';
                    statusClass = 'error';
                    statusText = 'Failed';
                } else if (result.status === 'retrying') {
                    icon = 'dashicons-clock';
                    statusClass = 'skipped';
                    statusText = 'Waiting to retry';
                } else if (result.status === 'skipped') {
                    icon = 'dashicons-warning';
                    statusClass = 'skipped';
                    statusText = 'Skipped';
                }

                var html = '<div class="log-item ' + statusClass + '">' +
                    '<span class="dashicons ' + icon + '"></span>' +
                    '<span class="log-filename" title="' + result.filename + '">' + result.filename + '</span>';

                if ((result.status === 'error' || result.status === 'retrying') && result.error) {
                    html += '<span class="log-error">' + result.error + '</span>';
                }

                html += '</div>';

                $log.append(html);
            });

            // Auto-scroll to bottom
            $log.scrollTop($log[0].scrollHeight);
        },

        finishProcess: function (data) {
            this.isProcessing = false;
            this.clearScheduledBatch();
            if (this.statusInterval) {
                clearInterval(this.statusInterval);
                this.statusInterval = null;
            }

            $('#start-bulk-process').show();
            $('#cancel-bulk-process').attr('style', 'display: none !important;').hide();

            this.updateProcessLimitNote(data);

            var processed = data.processed_count !== undefined ? data.processed_count : (data.processed || 0);
            var successful = data.successful_count !== undefined ? data.successful_count : (data.successful || 0);
            var errors = data.error_count !== undefined ? data.error_count : (data.errors ? data.errors.length : 0);

            if (data.success || data.status === 'completed') {
                $('#progress-status').text('Completed').removeClass('warning error').addClass('success');
                $('#progress-log').append('<div style="color: var(--success-color); font-weight: bold;">Bulk optimization completed!</div>');
            } else if (data.status === 'cancelled') {
                $('#progress-status').text('Cancelled').removeClass('warning success').addClass('error');

                // Show summary instead of progress bar
                $('#process-progress-container').hide();
                $('#process-summary-container').show();
                $('#process-summary-text').text('Process Cancelled');
                $('#process-summary-details').text('Processed ' + processed + ' images (' + successful + ' successful, ' + errors + ' errors) before stopping.');
                $('#progress-log').append('<div style="color: var(--danger-color); font-weight: bold;">Bulk optimization cancelled by user.</div>');
            } else if (data.status === 'stopped_no_credits') {
                $('#progress-status').text('Credits Exhausted').removeClass('warning success').addClass('error');
                $('#process-progress-container').hide();
                $('#process-summary-container').show();
                $('#process-summary-text').text('Credits Used Up');
                $('#process-summary-details').text(data.stopped_reason || ('Processed ' + processed + ' images before available credits ran out.'));
                $('#progress-log').append('<div style="color: var(--danger-color); font-weight: bold;">Bulk optimization stopped because the account ran out of credits.</div>');
            } else {
                $('#progress-status').text('Error').removeClass('warning success').addClass('error');
                $('#progress-log').append('<div style="color: var(--danger-color);">Process ended with errors or was interrupted.</div>');
            }
        },

        resetUI: function () {
            $('#start-bulk-process').show();
            $('#cancel-bulk-process').attr('style', 'display: none !important;').hide();
            $('#progress-card').hide();
            $('#process-progress-container').show();
            $('#process-summary-container').hide();
            $('#process-limit-note').hide().text('');
            this.isProcessing = false;
            this.cancelRequested = false;
            this.pendingCancel = false;
            this.processingBatches = {};
            this.clearScheduledBatch();
            if (this.statusInterval) {
                clearInterval(this.statusInterval);
                this.statusInterval = null;
            }
        },

        showError: function (msg) {
            $('#progress-log').append('<div style="color: var(--danger-color);">Error: ' + msg + '</div>');
        },

        updateProcessLimitNote: function (data) {
            var queueTotal = data && data.queue_total_images !== undefined ? parseInt(data.queue_total_images, 10) : NaN;
            var processableTotal = data && data.processable_images !== undefined ? parseInt(data.processable_images, 10) : NaN;
            var creditsRemaining = data && data.credits_remaining !== undefined ? parseInt(data.credits_remaining, 10) :
                (data && data.credits_remaining_at_start !== undefined ? parseInt(data.credits_remaining_at_start, 10) : NaN);

            if (!Number.isFinite(queueTotal) || !Number.isFinite(processableTotal) || queueTotal <= processableTotal) {
                $('#process-limit-note').hide().text('');
                return;
            }

            var planAllowance = data && data.plan_allowance !== undefined ? parseInt(data.plan_allowance, 10) : NaN;
            var planCreditsUsed = data && data.plan_credits_used_at_start !== undefined ? parseInt(data.plan_credits_used_at_start, 10) : NaN;
            var note = 'This run can process up to ' + processableTotal + ' images with available plan credits';
            if (Number.isFinite(planAllowance) && Number.isFinite(planCreditsUsed)) {
                note += ' (' + planCreditsUsed + ' used of ' + planAllowance + ')';
            } else if (Number.isFinite(creditsRemaining)) {
                note += ' (' + creditsRemaining + ' credits at start)';
            }
            note += '.';

            $('#process-limit-note').text(note).show();
        }
    };

    debugLog('Alt Text Pro: admin.js loaded fully');

    // Initialize admin interface when DOM is ready
    jQuery(document).ready(function () {
        if (typeof AltTextProAdmin !== 'undefined' && typeof AltTextProAdmin.init === 'function') {
            AltTextProAdmin.init();
        }

        // Safety-net: relocate any stray admin notices into our dedicated container.
        // This catches notices that escaped PHP suppression (e.g., late-hooked or AJAX-injected notices).
        var $container = $('.alt-text-pro-notices-container');
        if ($container.length) {
            // Find notices that are direct children of .wrap or siblings of .wrap
            var $wrap = $container.closest('.wrap');
            $wrap.children('.notice, .updated, .error, .update-nag').not($container.find('*')).each(function () {
                $container.append($(this));
            });

            // Also check for notices injected by WordPress before .wrap (siblings above)
            $wrap.prevAll('.notice, .updated, .error, .update-nag').each(function () {
                $container.append($(this));
            });
        }
    });
})(jQuery);
