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

    // Translated UI text comes from PHP (altTextAI.strings); the English
    // fallback keeps the screen usable if a string is missing.
    function t(key, fallback) {
        var strings = window.altTextAI && window.altTextAI.strings;
        return strings && typeof strings[key] === 'string' && strings[key] !== '' ? strings[key] : fallback;
    }

    // Fill %s / %d and numbered %1$s placeholders in order.
    function sprintf(template) {
        var args = Array.prototype.slice.call(arguments, 1);
        var index = 0;
        return String(template).replace(/%(?:(\d+)\$)?[sd]/g, function (match, position) {
            var value = position ? args[parseInt(position, 10) - 1] : args[index++];
            return value === undefined || value === null ? '' : String(value);
        });
    }

    // Message of a failed AJAX response: the JSON error WordPress sent (for
    // example a 403 permission error), or the fallback.
    function ajaxErrorMessage(xhr, fallback) {
        var json = xhr && xhr.responseJSON;
        if (json && typeof json.data === 'string' && json.data) return json.data;
        if (json && json.data && typeof json.data.message === 'string') return json.data.message;
        return fallback;
    }

    // "Buy credits or upgrade" link to the pricing page.
    function upgradeLink() {
        return $('<a>', {
            'class': 'atp-upgrade-link',
            href: (window.altTextAI && altTextAI.pricingUrl) || 'https://www.alt-text.pro/#pricing',
            target: '_blank',
            rel: 'noopener noreferrer',
            text: t('buyCredits', 'Buy credits or upgrade')
        });
    }

    // Error codes for a rejected key or a deleted account: the fix is to
    // reconnect on the Settings page.
    function needsReconnect(code) {
        return code === 'invalid_api_key' || code === 'account_not_found';
    }

    // Link to the plugin Settings page ("Connect a different account"), or a
    // hint for users who cannot open Settings.
    function settingsLink() {
        var url = window.altTextAI && altTextAI.settingsUrl;
        if (!url) {
            return $('<span>', {
                'class': 'atp-settings-hint',
                text: t('askAdminReconnect', 'Ask a site administrator to reconnect Alt Text Pro in its Settings.')
            });
        }
        return $('<a>', {
            'class': 'atp-upgrade-link atp-settings-link',
            href: url,
            text: t('openSettingsReconnect', 'Open Settings to reconnect')
        });
    }

    window.AltTextProI18n = {
        t: t,
        sprintf: sprintf,
        ajaxErrorMessage: ajaxErrorMessage,
        upgradeLink: upgradeLink,
        needsReconnect: needsReconnect,
        settingsLink: settingsLink
    };

    // Main Admin Object
    window.AltTextProAdmin = {
        connectPopup: null,

        // Initialize admin interface
        init: function () {
            this.normalizeBulkHeaderStats();
            this.bindEvents();
            this.initMediaFields();
            this.initOnboarding();
            this.updateSelectionCount();
        },

        // Keep bulk-processing counters in the progress card, even if a site-level
        // customization or older template places one inside the shared header.
        normalizeBulkHeaderStats: function () {
            var $progressStats = $('#progress-card .bulk-progress-stats');
            if (!$progressStats.length) return;

            $('.alt-text-pro-header .bulk-progress-stat').each(function () {
                $progressStats.append(this);
            });
        },

        // Bind all event handlers
        bindEvents: function () {
            // Generate alt-text buttons
            $(document).on('click', '.alt-text-pro-generate-btn', this.generateAltText);
            $(document).on('click', '.alt-text-pro-apply-btn', this.applyAltText);

            // Media library integration

            // Settings page interactions
            this.bindSettingsEvents();

            // Bulk processing
            this.bindBulkProcessEvents();

            // General UI interactions
            this.bindUIEvents();
        },

        // Settings page event bindings
        bindSettingsEvents: function () {
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

            // Disconnect account: confirm before removing the saved key.
            $(document).on('submit', '#alt-text-pro-disconnect-form', function (e) {
                var message = $('#alt-text-pro-disconnect').data('confirm');
                if (message && !window.confirm(message)) {
                    e.preventDefault();
                }
            });

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

                if (!expectedOrigin || event.origin !== expectedOrigin) {
                    return;
                }

                if (event.data && event.data.type === 'ALT_TEXT_PRO_CONNECTED' && event.data.api_key) {
                    var storedState = sessionStorage.getItem('alt_text_pro_connect_state');
                    if (!AltTextProAdmin.connectPopup || event.source !== AltTextProAdmin.connectPopup) {
                        console.warn('Alt Text Pro: unexpected popup source, ignoring callback');
                        return;
                    }
                    if (!storedState || !event.data.state || event.data.state !== storedState) {
                        console.warn('Alt Text Pro: missing or mismatched state, ignoring postMessage callback');
                        return;
                    }

                    AltTextProAdmin.handleConnectCallback(event.data.api_key, {
                        sourceWindow: event.source,
                        sourceOrigin: event.origin,
                        requestId: event.data.request_id || '',
                        state: event.data.state || ''
                    });
                }
            });

        },


        // Bulk processing event bindings - UI helpers only (start/cancel handled by inline script)
        bindBulkProcessEvents: function () {
            // Process type selection
            $(document).on('change', 'input[name="process_type"]', function () {
                var val = $(this).val();
                if (val === 'selected') {
                    $('#image-selection-sidebar').slideDown();
                    if (window.bulkProcessor && !window.bulkProcessor.pickerLoaded) {
                        window.bulkProcessor.loadImagePage(1);
                    }
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

            // Select all/none on the visible page of the picker
            $(document).on('click', '#select-all-images', function () {
                $('#image-list input[type="checkbox"]').prop('checked', true).trigger('change');
            });

            $(document).on('click', '#deselect-all-images', function () {
                if (window.bulkProcessor) {
                    window.bulkProcessor.selectedImages = {};
                }
                $('#image-list input[type="checkbox"]').prop('checked', false);
                AltTextProAdmin.updateSelectionCount();
            });

            // Individual image selection; kept across pages and searches
            $(document).on('change', '#image-list input[type="checkbox"]', function () {
                if (window.bulkProcessor) {
                    var id = String($(this).val());
                    if (this.checked) {
                        window.bulkProcessor.selectedImages[id] = true;
                    } else {
                        delete window.bulkProcessor.selectedImages[id];
                    }
                }
                AltTextProAdmin.updateSelectionCount();
            });

            // Picker search, filter and paging
            var searchTimer = null;
            $(document).on('input', '#image-search', function () {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    if (window.bulkProcessor) window.bulkProcessor.loadImagePage(1);
                }, 350);
            });
            $(document).on('change', '#image-filter', function () {
                if (window.bulkProcessor) window.bulkProcessor.loadImagePage(1);
            });
            $(document).on('click', '#image-page-prev, #image-page-next', function () {
                if (!window.bulkProcessor) return;
                var page = window.bulkProcessor.pickerPage + ($(this).attr('id') === 'image-page-next' ? 1 : -1);
                window.bulkProcessor.loadImagePage(Math.max(1, page));
            });

            // Resume or stop a run found when the Bulk page loads
            $(document).on('click', '#resume-bulk-process', function () {
                if (window.bulkProcessor) window.bulkProcessor.resumeProcessing();
            });
            $(document).on('click', '#cancel-active-run', function () {
                if (window.bulkProcessor) window.bulkProcessor.cancelActiveRun($(this));
            });

            // Leaving the page while a run is going pauses it
            $(window).on('beforeunload', function (e) {
                if (window.bulkProcessor && window.bulkProcessor.isProcessing && !window.bulkProcessor.backgroundMode) {
                    var message = t('leaveWarning', 'A bulk run is in progress. Leaving this page pauses it; you can resume it from the Bulk page.');
                    e.preventDefault();
                    e.returnValue = message;
                    return message;
                }
            });
        },

        // General UI event bindings
        bindUIEvents: function () {
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

            debugLog('Alt Text Pro: Generating with context:', Boolean(context));

            if (!attachmentId) {
                AltTextProAdmin.showError(t('invalidAttachment', 'Invalid attachment ID'), $container);
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
                        var data = response.data;
                        var message = data && typeof data === 'object' ? data.message : data;
                        AltTextProAdmin.showError(message || altTextAI.strings.error, $container);
                        if (data && data.code === 'no_credits') {
                            $container.find('.alt-text-pro-error').append(' ').append(upgradeLink());
                        } else if (data && needsReconnect(data.code)) {
                            $container.find('.alt-text-pro-error').append(' ').append(settingsLink());
                        }
                    }
                },
                error: function (xhr, status, error) {
                    debugLog('Alt Text Pro AJAX Error:', status, error);
                    AltTextProAdmin.showError(ajaxErrorMessage(xhr, altTextAI.strings.error), $container);
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
            var attachmentId = $container.find('.alt-text-pro-generate-btn').data('attachment-id');

            // Target this attachment's WordPress alt field. Fall back to the
            // single attachment-edit field outside the media modal.
            var fieldSelector = 'input[name="attachments[' + attachmentId + '][alt]"], ' +
                'textarea[name="attachments[' + attachmentId + '][alt]"]';
            var $altField = $(fieldSelector).first();
            if (!$altField.length) {
                // Media modal and Media Library grid: the alt field of the
                // attachment details panel this button sits in.
                $altField = $container.closest('.attachment-details, .media-modal, .media-frame')
                    .find('[data-setting="alt"] textarea, [data-setting="alt"] input, textarea[data-setting="alt"]').first();
            }
            if (!$altField.length) {
                $altField = $('#attachment_alt, #attachment-details-alt-text, #attachment-details-two-column-alt-text').first();
            }
            if ($altField.length) {
                // In the media modal the change event saves the alt text.
                $altField.val(altText).trigger('input').trigger('change');
            } else {
                AltTextProAdmin.showNotification(t('altFieldMissing', 'The WordPress alt-text field could not be found. Copy the draft and paste it manually.'), 'error');
                return;
            }

            // Update current alt-text display
            $container.find('.current-alt-text').text(altText);

            // Hide the success message
            $container.find('.alt-text-pro-success').slideUp();

            AltTextProAdmin.showNotification(t('draftApplied', 'Draft placed in the WordPress alt-text field. Save or update the image to keep it.'), 'success');
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

            function notice(type, message) {
                return $('<div>').addClass('notice notice-' + type).append($('<p>').text(message));
            }

            if (!apiKey && !useSavedKey) {
                $result.empty().append(notice('error', t('enterKeyFirst', 'Please enter an API key first.')));
                return;
            }

            var originalHtml = $button.html();
            $button.empty()
                .append('<span class="dashicons dashicons-update rotating" aria-hidden="true"></span>')
                .append($('<span>').text(t('testing', 'Testing...')))
                .prop('disabled', true);
            $result.empty().append(notice('info', useSavedKey ? t('testingSaved', 'Testing saved connection...') : t('testingConnection', 'Testing connection...')));

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
                    var $notice = $('<div>').addClass('notice');
                    var $message = $('<p>');

                    if (response.success) {
                        $notice.addClass('notice-success');
                        $('<strong>').text(response.data && response.data.message ? response.data.message : '').appendTo($message);
                        if (response.data && response.data.user_info) {
                            var userInfo = response.data.user_info;
                            $('<br>').appendTo($message);
                            $('<small>').text(sprintf(
                                t('planCredits', 'Plan: %1$s | Credits: %2$s'),
                                userInfo.plan || '',
                                userInfo.credits_remaining !== undefined && userInfo.credits_remaining !== null ? userInfo.credits_remaining : ''
                            )).appendTo($message);
                        }
                    } else {
                        $notice.addClass('notice-error');
                        $message.text(typeof response.data === 'string' ? response.data : t('connectionTestFailed', 'Connection test failed'));
                    }

                    $result.empty().append($notice.append($message));
                },
                error: function (xhr) {
                    $result.empty().append(notice('error', ajaxErrorMessage(xhr, t('connectionTestFailed', 'Connection test failed'))));
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
                AltTextProAdmin.showNotification(t('onboardingInvalidFormat', 'Invalid API key format. API keys should start with "alt_" or "altai_".'), 'error');
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
            var selectedCount = window.bulkProcessor && window.bulkProcessor.selectedImages
                ? Object.keys(window.bulkProcessor.selectedImages).length
                : $('#image-list input[type="checkbox"]:checked').length;
            $('.selection-count').text(selectedCount > 0 ? sprintf(t('selectedCount', '%d selected'), selectedCount) : '');

            // Enable/disable start button based on selection
            var processType = $('input[name="process_type"]:checked').val();
            // Out of credits or another run in progress: Start stays off.
            var blocked = $('#start-bulk-process').data('blocked') === 1 || $('#start-bulk-process').data('blocked') === '1';
            if (blocked) {
                $('#start-bulk-process').prop('disabled', true).css('opacity', '0.5');
            } else if (processType === 'selected') {
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

            // Credits the customer can still spend, shown under this draft
            if (data.credits_remaining !== undefined && data.credits_remaining !== null) {
                $success.find('.credits-remaining')
                    .text(sprintf(t('creditsLeft', 'Credits left: %d'), parseInt(data.credits_remaining, 10) || 0))
                    .show();
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

            $('.alt-text-pro-notification').remove();

            var $notification = $('<div class="atp-ui alt-text-pro-notification notice notice-' + type + '" role="alert">')
                .append($('<p>').text(message))
                .append($('<button type="button" class="notice-dismiss">').append($('<span class="screen-reader-text">').text(t('dismissNotice', 'Dismiss this notice.'))))
                .hide();

            $('body').append($notification);
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

        // Open modal dialog
        openModal: function (e) {
            e.preventDefault();

            var modalId = $(this).data('modal');
            var $modal = $('#' + modalId);

            if ($modal.length) {
                $modal.addClass('active').attr('aria-hidden', 'false');
                $('body').addClass('modal-open');
                $modal.find('input, button, a').first().trigger('focus');
            }
        },

        // Close modal dialog
        closeModal: function (e) {
            if ($(e.target).closest('.close-modal').length) {
                // Closing the onboarding modal ("I'll do this later" or the
                // close button) is remembered so it stops opening by itself.
                if ($(e.target).closest('#alt-text-pro-onboarding-modal').length) {
                    AltTextProAdmin.dismissOnboarding();
                }
                AltTextProAdmin.closeAllModals();
            }
        },

        dismissOnboarding: function () {
            if (!altTextAI.onboarding || !altTextAI.onboarding.show) return;
            altTextAI.onboarding.show = false;
            $.post(altTextAI.ajaxUrl, {
                action: 'alt_text_pro_dismiss_onboarding',
                nonce: altTextAI.nonce
            });
        },

        closeAllModals: function () {
            $('.modal').removeClass('active').attr('aria-hidden', 'true');
            $('body').removeClass('modal-open');
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
                }, 100);
            }
        },

        showModalById: function (modalId) {
            var $modal = $('#' + modalId);
            if ($modal.length) {
                // Ensure page is scrolled to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
                $modal.addClass('active').attr('aria-hidden', 'false');
                $('body').addClass('modal-open');
                // Focus management for accessibility
                var modalContent = $modal.find('.modal-content').attr('tabindex', '-1').get(0);
                if (modalContent) {
                    modalContent.focus({ preventScroll: true });
                }
                $modal.scrollTop(0);
            }
        },

        setOnboardingMessage: function (message, type) {
            var $msg = $('#onboarding-message');
            $msg.removeClass('success error').addClass(type || '');
            $msg.text(message);
        },

        setAutoConnectButtonState: function (isLoading) {
            var $button = $('#auto-connect-btn');
            $button.prop('disabled', !!isLoading).toggleClass('is-loading', !!isLoading);

            if (isLoading) {
                $button.empty()
                    .append($('<span>').text(t('connecting', 'Connecting...')))
                    .append('<span class="dashicons dashicons-update" aria-hidden="true"></span>');
                return;
            }

            $button.empty()
                .append($('<span>').text(t('onboardingCta', 'Connect Account')))
                .append('<span class="dashicons dashicons-arrow-right-alt2" aria-hidden="true"></span>');
        },

        setAutoConnectStatus: function (message, type, iconClass) {
            var $status = $('#auto-connect-status');
            var $icon = $('<span>', {
                'class': 'dashicons ' + (iconClass || 'dashicons-info-outline'),
                'aria-hidden': 'true'
            });
            var $message = $('<span>').text(message || '');

            $status
                .removeClass('success error')
                .addClass('is-visible ' + (type || ''))
                .empty()
                .append($icon, $message);
        },

        handleOnboardingSave: function (e) {
            e.preventDefault();

            var apiKey = $('#onboarding_api_key').val();
            if (!AltTextProAdmin.validateAPIKeyFormat(apiKey)) {
                AltTextProAdmin.setOnboardingMessage(altTextAI.strings.onboardingInvalidFormat || 'Invalid API key format.', 'error');
                $('#onboarding_api_key').focus();
                return;
            }

            AltTextProAdmin.setOnboardingMessage(t('validating', 'Validating...'), '');

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
                        AltTextProAdmin.setOnboardingMessage(
                            response.data && response.data.verified === false && response.data.message
                                ? response.data.message
                                : t('onboardingSaved', 'API key saved successfully!'),
                            'success'
                        );
                        // Mirror into settings field if present
                        $('#api_key').val(apiKey);
                        altTextAI.onboarding.show = false;
                        setTimeout(function () {
                            AltTextProAdmin.closeAllModals();
                            location.reload();
                        }, 800);
                    } else {
                        AltTextProAdmin.setOnboardingMessage(response.data || altTextAI.strings.invalidKey, 'error');
                    }
                },
                error: function (xhr) {
                    AltTextProAdmin.setOnboardingMessage(ajaxErrorMessage(xhr, t('connectionTestFailed', 'Validation failed.')), 'error');
                }
            });
        },

        // The connect page posts the key back to the origin of this URL, so it
        // must be the address the browser is actually on (www/non-www, proxy
        // or custom admin host), not the site URL WordPress has stored.
        getConnectCallbackUrl: function () {
            var fallbackUrl = (altTextAI.onboarding && altTextAI.onboarding.settingsUrl)
                ? altTextAI.onboarding.settingsUrl
                : window.location.href;

            try {
                var current = new URL(window.location.href);
                if (current.protocol !== 'http:' && current.protocol !== 'https:') {
                    return fallbackUrl;
                }

                // Every plugin page lives in wp-admin; point at the settings
                // page next to the current admin script.
                var callback = new URL(current.pathname.replace(/[^\/]*$/, 'admin.php'), current.origin);
                callback.search = '?page=alt-text-pro-settings';
                return callback.toString();
            } catch (urlError) {
                return fallbackUrl;
            }
        },

        // Auto-connect: open popup to alt-text.pro/connect
        handleAutoConnect: function (e) {
            if (e) e.preventDefault();

            var connectUrl = (altTextAI.onboarding && altTextAI.onboarding.connectUrl)
                ? altTextAI.onboarding.connectUrl
                : 'https://www.alt-text.pro/connect';
            var settingsUrl = AltTextProAdmin.getConnectCallbackUrl();

            // Generate a cryptographically random state for CSRF protection.
            if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') {
                AltTextProAdmin.setAutoConnectStatus(
                    t('secureUnavailable', 'Secure connection is unavailable in this browser. Use manual API key entry.'),
                    'error',
                    'dashicons-warning'
                );
                return;
            }

            var stateBytes = new Uint8Array(24);
            window.crypto.getRandomValues(stateBytes);
            var state = 'atp_';
            for (var byteIndex = 0; byteIndex < stateBytes.length; byteIndex++) {
                state += stateBytes[byteIndex].toString(16).padStart(2, '0');
            }
            sessionStorage.setItem('alt_text_pro_connect_state', state);

            // Build connect URL with callback
            var url = connectUrl
                + '?callback_url=' + encodeURIComponent(settingsUrl)
                + '&state=' + encodeURIComponent(state)
                + '&source=wordpress_plugin'
                + '&plugin_version=' + encodeURIComponent(altTextAI.version || '');

            // Update button state
            AltTextProAdmin.setAutoConnectButtonState(true);
            AltTextProAdmin.setAutoConnectStatus(
                t('waitingSignIn', 'Waiting for you to sign in...'),
                '',
                'dashicons-clock'
            );

            // Open a fresh popup for every attempt. Reusing a fixed window name
            // can return a stale popup whose opener was lost by a previous
            // OAuth/browser navigation, so the connect page cannot message this
            // WordPress window back.
            if (AltTextProAdmin.connectPopup && !AltTextProAdmin.connectPopup.closed) {
                try {
                    AltTextProAdmin.connectPopup.close();
                } catch (error) {
                    console.warn('Alt Text Pro: could not close the previous connect popup', error);
                }
            }

            var w = 500, h = 700;
            var left = (screen.width / 2) - (w / 2);
            var top = (screen.height / 2) - (h / 2);
            var popupName = 'alt_text_pro_connect_' + state.slice(-12);
            var popup = window.open(
                url,
                popupName,
                'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',scrollbars=yes,resizable=yes'
            );
            AltTextProAdmin.connectPopup = popup;

            if (!popup) {
                AltTextProAdmin.connectPopup = null;
                sessionStorage.removeItem('alt_text_pro_connect_state');
                AltTextProAdmin.setAutoConnectButtonState(false);
                AltTextProAdmin.setAutoConnectStatus(
                    t('popupBlocked', 'Your browser blocked the sign-in window. Allow popups or use manual entry.'),
                    'error',
                    'dashicons-warning'
                );
                return;
            }

            // Poll to detect if popup was closed without completing
            var pollTimer = setInterval(function () {
                if (popup && popup.closed) {
                    clearInterval(pollTimer);
                    AltTextProAdmin.connectPopup = null;
                    AltTextProAdmin.setAutoConnectButtonState(false);
                    // Only show "cancelled" if we didn't get a key
                    var storedState = sessionStorage.getItem('alt_text_pro_connect_state');
                    if (storedState) {
                        AltTextProAdmin.setAutoConnectStatus(
                            t('popupClosed', 'Sign-in window closed. Try again or use manual entry.'),
                            '',
                            'dashicons-info-outline'
                        );
                    }
                }
            }, 1000);
        },

        // Acknowledge a connect popup only after the API key has been saved.
        sendConnectAcknowledgement: function (ackContext, success, message) {
            if (!ackContext || !ackContext.sourceWindow || !ackContext.sourceOrigin) return;

            try {
                ackContext.sourceWindow.postMessage({
                    type: 'ALT_TEXT_PRO_CONNECT_ACK',
                    request_id: ackContext.requestId || '',
                    state: ackContext.state || '',
                    success: !!success,
                    message: message || ''
                }, ackContext.sourceOrigin);
            } catch (error) {
                console.warn('Alt Text Pro: could not acknowledge connect popup', error);
            }
        },

        // Handle an API key received from the verified connect popup.
        handleConnectCallback: function (apiKey, ackContext) {
            if (!apiKey) return;

            // Clear state
            sessionStorage.removeItem('alt_text_pro_connect_state');

            // Show connecting status
            AltTextProAdmin.setAutoConnectButtonState(true);
            AltTextProAdmin.setAutoConnectStatus(
                t('savingKey', 'Account connected. Saving your key...'),
                '',
                'dashicons-update'
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
                        AltTextProAdmin.sendConnectAcknowledgement(ackContext, true);
                        AltTextProAdmin.setAutoConnectStatus(
                            t('connectedSuccess', 'Connected successfully!'),
                            'success',
                            'dashicons-yes-alt'
                        );
                        // Mirror into settings field
                        $('#api_key').val(apiKey);
                        $('#onboarding_api_key').val(apiKey);
                        altTextAI.onboarding.show = false;

                        AltTextProAdmin.showNotification(
                            response.data && response.data.verified === false && response.data.message
                                ? response.data.message
                                : t('connectedSaved', 'Connected successfully! Your API key has been saved.'),
                            'success'
                        );

                        setTimeout(function () {
                            AltTextProAdmin.closeAllModals();
                            location.reload();
                        }, 1500);
                    } else {
                        AltTextProAdmin.setAutoConnectButtonState(false);
                        AltTextProAdmin.sendConnectAcknowledgement(
                            ackContext,
                            false,
                            response.data || t('saveKeyFailed', 'WordPress could not save the API key.')
                        );
                        AltTextProAdmin.setAutoConnectStatus(
                            response.data || t('invalidKey', 'Invalid API key'),
                            'error',
                            'dashicons-warning'
                        );
                    }
                },
                error: function (xhr) {
                    AltTextProAdmin.setAutoConnectButtonState(false);
                    AltTextProAdmin.sendConnectAcknowledgement(
                        ackContext,
                        false,
                        t('saveKeyFailed', 'WordPress could not save the API key.')
                    );
                    AltTextProAdmin.setAutoConnectStatus(
                        ajaxErrorMessage(xhr, t('saveFailedManual', 'Failed to save. Please try manual entry.')),
                        'error',
                        'dashicons-warning'
                    );
                }
            });
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
        cancelRequest: null,
        pendingBatchRequests: [],
        statusInterval: null,
        processingBatches: {},
        notificationsShown: {},
        nextBatchTimer: null,
        scheduledBatchOffset: null,
        // Keep bulk jobs sequential for credit-accurate cancellation, but do not
        // impose a provider-agnostic 15-second pause after every successful image.
        // Provider 429 responses still supply the longer delay when it is needed.
        batchDelayMs: 750,
        // "Selected" picker: chosen IDs (kept across pages) and current page.
        selectedImages: {},
        pickerPage: 1,
        pickerLoaded: false,
        pickerRequest: null,
        // True while WP-Cron drives the run ("Keep going in the background");
        // this tab then only shows progress.
        backgroundMode: false,

        init: function () {
            debugLog('Alt Text Pro: Initializing bulk processor');
        },

        isTerminalStatus: function (status) {
            return status === 'completed' ||
                status === 'cancelled' ||
                status === 'error' ||
                status === 'stopped_no_credits' ||
                status === 'stopped_error';
        },

        // Pick up the run this user started before the page was reloaded.
        resumeProcessing: function () {
            var run = window.altTextAI && altTextAI.bulk;
            if (this.isProcessing || !run || !run.is_owner || !run.process_id) return;

            this.processId = run.process_id;
            this.isProcessing = true;
            this.cancelRequested = false;
            this.pendingCancel = false;
            this.finishedProcessId = null;
            this.pendingBatchRequests = [];
            this.processingBatches = {};
            this.clearScheduledBatch();

            $('#active-run-card').hide();
            // Start was only blocked by this run; allow a new run afterwards.
            var $start = $('#start-bulk-process');
            if ($start.attr('data-blocked-reason') === 'run') {
                $start.attr('data-blocked', '0').data('blocked', 0).prop('disabled', false).css('opacity', '1');
            }
            $start.hide();
            $('#cancel-bulk-process').attr('style', 'display: inline-flex !important;').show();
            $('#progress-card').slideDown();
            $('#results-card').hide();
            $('#process-progress-container, #bulk-current-task, .bulk-progress-stats, .bulk-stop-hint').show();
            $('#process-summary-container').hide();
            $('#progress-status').text(t('initializing', 'Initializing...')).removeClass('success error').addClass('warning');
            $('#progress-log').empty().append($('<div>').text(t('resumeRun', 'Resuming your bulk run...')));
            this.updateLiveTask(null, t('readyNext', 'Ready to start after the latest update.'), t('queued', 'Queued'));
            this.setMode(run.mode);

            // The run was being stopped when the page was left. It will never
            // schedule another image, so finish the stop instead of polling
            // it forever.
            if (run.status === 'cancelling') {
                this.isProcessing = false;
                this.cancelRequested = true;
                this.pendingCancel = true;
                $('#cancel-bulk-process').prop('disabled', true);
                this.startStatusPolling();
                this.sendCancelRequest();
                return;
            }

            this.startStatusPolling();
        },

        // Stop a run found on page load. Another administrator's run is
        // referenced by an opaque value, never by its process token.
        cancelActiveRun: function ($button) {
            var run = window.altTextAI && altTextAI.bulk;
            if (!run) return;

            var question = run.is_owner
                ? t('cancelOwnConfirm', 'Stop this bulk run? Images already done keep their alt text.')
                : sprintf(t('cancelOtherConfirm', 'Stop the bulk run started by %s? Images already done keep their alt text.'), run.started_by || '');
            if (!window.confirm(question)) return;

            $button.prop('disabled', true);
            var data = { action: 'alt_text_pro_bulk_cancel', nonce: altTextAI.nonce };
            if (run.is_owner && run.process_id) {
                data.process_id = run.process_id;
            } else {
                data.cancel_ref = run.cancel_ref || '';
            }

            $.post(altTextAI.ajaxUrl, data).done(function (response) {
                if (response && response.success) {
                    AltTextProAdmin.showNotification(t('runCancelled', 'The bulk run was stopped.'), 'success');
                    setTimeout(function () { window.location.reload(); }, 800);
                } else {
                    $button.prop('disabled', false);
                    AltTextProAdmin.showNotification((response && response.data) || t('error', 'Something went wrong.'), 'error');
                }
            }).fail(function (xhr) {
                $button.prop('disabled', false);
                AltTextProAdmin.showNotification(ajaxErrorMessage(xhr, t('error', 'Something went wrong.')), 'error');
            });
        },

        // "Selected" picker: one page of images, searchable, with or without
        // alt text, so images can be chosen for regeneration.
        loadImagePage: function (page) {
            var self = this;
            var $list = $('#image-list');
            if (!$list.length) return;

            if (this.pickerRequest) {
                this.pickerRequest.abort();
            }

            this.pickerLoaded = true;
            $list.empty().append($('<p class="atp-muted">').text(t('loadingImages', 'Loading images...')));

            this.pickerRequest = $.post(altTextAI.ajaxUrl, {
                action: 'alt_text_pro_bulk_list_images',
                nonce: altTextAI.nonce,
                page: page,
                search: $('#image-search').val() || '',
                filter: $('#image-filter').val() || 'missing',
                filters: window.AltTextProBulkTools ? window.AltTextProBulkTools.getFilters() : {}
            }).done(function (response) {
                if (!response || !response.success) {
                    $list.empty().append($('<p class="atp-muted">').text((response && response.data) || t('loadImagesFailed', 'Images could not be loaded.')));
                    return;
                }

                var data = response.data || {};
                self.pickerPage = data.page || 1;
                $list.empty();

                if (!data.images || !data.images.length) {
                    $list.append($('<p class="atp-muted">').text(t('noImagesFound', 'No images match.')));
                }

                $.each(data.images || [], function (index, image) {
                    var id = String(image.id);
                    var $row = $('<label class="atp-image-row">');
                    $('<input type="checkbox" name="selected_images[]">')
                        .val(id)
                        .prop('checked', !!self.selectedImages[id])
                        .appendTo($row);
                    $('<img class="atp-thumb" alt="">').attr('src', image.thumb || '').appendTo($row);
                    var $text = $('<span class="atp-image-name">').text(image.title || '');
                    $('<small class="atp-image-alt">')
                        .toggleClass('is-missing', !image.has_alt)
                        .text(image.has_alt ? image.alt : t('missingAlt', 'Missing alt text'))
                        .appendTo($text);
                    $text.appendTo($row);
                    $list.append($row);
                });

                var totalPages = data.total_pages || 1;
                $('#image-page-label').text(sprintf(t('pageOf', 'Page %1$d of %2$d'), self.pickerPage, totalPages));
                $('#image-page-prev').prop('disabled', self.pickerPage <= 1);
                $('#image-page-next').prop('disabled', self.pickerPage >= totalPages);
                $('#image-pagination').toggle(totalPages > 1);
                AltTextProAdmin.updateSelectionCount();
            }).fail(function (xhr, status) {
                if (status === 'abort') return;
                $list.empty().append($('<p class="atp-muted">').text(ajaxErrorMessage(xhr, t('loadImagesFailed', 'Images could not be loaded.'))));
            }).always(function () {
                self.pickerRequest = null;
            });
        },

        startProcessing: function () {
            if (this.isProcessing) return;

            var self = this;
            var processType = $('input[name="process_type"]:checked').val();
            var overwriteExisting = $('#overwrite_existing').is(':checked');
            var selectedImages = [];
            var batchSize = 1;

            if (processType === 'selected') {
                selectedImages = Object.keys(this.selectedImages);

                if (selectedImages.length === 0) {
                    alert(t('pleaseSelectImage', 'Please select at least one image.'));
                    return;
                }
            }

            debugLog('Alt Text Pro: Starting bulk process', { type: processType, overwrite: overwriteExisting });

            this.isProcessing = true;
            this.cancelRequested = false;
            this.pendingCancel = false;
            this.processId = null;
            this.finishedProcessId = null;
            this.cancelRequest = null;
            this.pendingBatchRequests = [];
            this.processingBatches = {};
            this.clearScheduledBatch();

            // UI setup
            $('#start-bulk-process').hide();
            $('#cancel-bulk-process').attr('style', 'display: inline-flex !important;').show();
            $('#progress-card').slideDown();
            $('#results-card').hide();
            $('#progress-status').text(t('initializing', 'Initializing...')).removeClass('success error').addClass('warning');
            $('#progress-fill').css('width', '0%');
            $('#progress-text').text('0%');
            $('#processed-count').text('0 / 0');
            $('#processed-stat-count, #successful-count, #error-count, #remaining-stat-count, #live-remaining-count').text('0');
            $('#process-progress-container, #bulk-current-task, .bulk-progress-stats, .bulk-stop-hint').show();
            $('#process-summary-container').hide();
            this.updateLiveTask(null, t('firstImageSoon', 'The first image will begin shortly.'), t('preparing', 'Preparing'));
            $('#progress-log').empty().append($('<div>').text(t('startingBulk', 'Starting bulk optimization...')));

            this.startRequest = $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_bulk_start',
                    process_type: processType,
                    overwrite_existing: overwriteExisting ? 1 : 0,
                    selected_images: selectedImages,
                    batch_size: batchSize,
                    filters: window.AltTextProBulkTools ? window.AltTextProBulkTools.getFilters() : {},
                    background: $('#bulk_background').is(':checked') ? 1 : 0,
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
                        $('#remaining-stat-count, #live-remaining-count').text(processableTotal);
                        self.updateLiveTask(1, t('waitingFirst', 'Waiting to begin the first image.'), t('queued', 'Queued'));
                        self.updateProcessLimitNote({
                            queue_total_images: queueTotal,
                            processable_images: processableTotal,
                            credits_remaining: creditsRemaining,
                            plan_allowance: response.data.plan_allowance,
                            plan_credits_used_at_start: response.data.plan_credits_used
                        });

                        $('#progress-log').append(
                            $('<div>').text(sprintf(t('initializedProcess', 'Run started: up to %d images can be processed with the available credits.'), processableTotal))
                        );
                        if (response.data.estimated_time) {
                            $('#progress-log').append(
                                $('<div>').text(sprintf(t('estimatedTimeLog', 'Estimated time: about %s.'), response.data.estimated_time))
                            );
                        }
                        self.setMode(response.data.mode);

                        if (response.data.queue_capped) {
                            $('#progress-log').append(
                                $('<div>').text(sprintf(t('queueCapped', 'This run includes the newest %d images. Start another run when it finishes to continue with older images.'), response.data.queue_cap || queueTotal))
                            );
                        }

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
                        var data = response.data;
                        self.resetUI();
                        $('#progress-card').show();
                        $('#process-progress-container, #bulk-current-task, .bulk-progress-stats, .bulk-stop-hint').hide();
                        self.showError(data && typeof data === 'object' ? data.message : (data || t('startFailed', 'Failed to start bulk process')), data && data.code);
                    }
                },
                error: function (xhr, status, error) {
                    if (status !== 'abort') {
                        console.error('Alt Text Pro: Bulk start error', error);
                        self.resetUI();
                        $('#progress-card').show();
                        $('#process-progress-container, #bulk-current-task, .bulk-progress-stats, .bulk-stop-hint').hide();
                        self.showError(ajaxErrorMessage(xhr, t('serverUnreachable', 'Failed to connect to server')));
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

            // Do not abort a billable request that has already reached WordPress.
            // Aborting only hides its response; PHP and the AI request continue,
            // which previously made the displayed result lag one credit behind.
            $('#cancel-bulk-process').prop('disabled', true);
            $('#progress-status').text(t('stoppingAfterCurrent', 'Stopping after current image...')).removeClass('success error').addClass('warning');
            this.updateLiveTask(null, t('finishingCurrent', 'Finishing the current image before stopping.'), t('stopping', 'Stopping'));

            if (!this.processId) {
                return;
            }

            this.sendCancelRequest();
        },

        sendCancelRequest: function () {
            var self = this;
            if (!this.processId) {
                this.resetUI();
                $('#progress-status').text(t('cancelled', 'Cancelled')).removeClass('warning success').addClass('error');
                return;
            }

            if (this.cancelRequest) return;

            $('#progress-status').text(t('stoppingAfterCurrent', 'Stopping after current image...')).removeClass('success error').addClass('warning');
            this.updateLiveTask(null, t('finishingCurrent', 'Finishing the current image before stopping.'), t('stopping', 'Stopping'));

            this.cancelRequest = $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_bulk_cancel',
                    process_id: this.processId,
                    nonce: altTextAI.nonce
                },
                success: function (response) {
                    if (response.success) {
                        var data = response.data || { status: 'cancelled' };
                        self.updateProgress(data);

                        // A running AI request cannot be recalled by aborting the
                        // browser request. Wait for it to return so any charged
                        // result is included in the final WordPress count.
                        if (data.status === 'cancelling' || self.pendingBatchRequests.length > 0) {
                            $('#progress-status').text(t('stoppingAfterCurrent', 'Stopping after current image...')).removeClass('success error').addClass('warning');
                            return;
                        }

                        self.finishProcess(data);
                    } else {
                        $('#progress-status').text(t('unableToStop', 'Unable to stop yet, retrying...')).removeClass('success error').addClass('warning');
                    }
                },
                error: function () {
                    $('#progress-status').text(t('unableToStop', 'Unable to stop yet, retrying...')).removeClass('success error').addClass('warning');
                },
                complete: function () {
                    self.cancelRequest = null;
                }
            });
        },

        startStatusPolling: function () {
            var self = this;
            if (this.statusInterval) {
                clearInterval(this.statusInterval);
            }
            this.pollStatus();
            // A background run moves at WP-Cron's pace; poll it less often.
            this.statusInterval = setInterval(function () {
                self.pollStatus();
            }, this.backgroundMode ? 4000 : 1000);
        },

        // Follow the run's mode: "background" (WP-Cron) or this tab.
        setMode: function (mode) {
            var background = mode === 'background';
            var changed = background !== this.backgroundMode;
            this.backgroundMode = background;

            $('#bulk-mode-panel').show();
            $('#bulk-to-background').toggle(!background);
            if (!$('#bulk-to-foreground').length) {
                $('<button type="button" class="button-secondary-custom atp-btn-sm" id="bulk-to-foreground">')
                    .append($('<span class="dashicons dashicons-controls-play" aria-hidden="true">'))
                    .append($('<span>').text(t('runInTab', 'Run in this tab instead')))
                    .appendTo('#bulk-mode-panel');
            }
            $('#bulk-to-foreground').toggle(background);
            $('#bulk-mode-note').text(background
                ? t('backgroundNote', 'Running in the background with WP-Cron. You can close this tab. WP-Cron runs when someone visits the site (or on your host\'s schedule), so progress can pause on a quiet site.')
                : t('foregroundNote', 'This tab is running the bulk job. Keep it open, or let it keep going in the background.'));

            if (background) {
                this.clearScheduledBatch();
                this.updateLiveTask(null, t('backgroundTask', 'Images are processed in the background a few at a time.'), t('backgroundState', 'Background'));
            }
            if (changed && this.statusInterval && (this.isProcessing || this.pendingCancel)) {
                this.startStatusPolling();
            }
        },

        pollStatus: function () {
            var self = this;
            if (!this.processId || (!this.isProcessing && !this.pendingCancel)) return;

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
                        self.updateProgress(response.data);

                        if (self.pendingCancel) {
                            var cancelStatus = response.data.status;
                            var cancelFinished = self.isTerminalStatus(cancelStatus);

                            if (cancelFinished && self.pendingBatchRequests.length === 0) {
                                self.finishProcess(response.data);
                            } else {
                                $('#progress-status').text(t('stoppingAfterCurrent', 'Stopping after current image...')).removeClass('success error').addClass('warning');
                                self.updateLiveTask(null, t('finishingCurrent', 'Finishing the current image before stopping.'), t('stopping', 'Stopping'));
                                if (cancelStatus === 'cancelling' && self.pendingBatchRequests.length === 0) {
                                    self.sendCancelRequest();
                                }
                            }
                            return;
                        }

                        // Stopped elsewhere (another tab or an administrator):
                        // follow the stop instead of waiting for a next image.
                        if (response.data.status === 'cancelling') {
                            self.isProcessing = false;
                            self.cancelRequested = true;
                            self.pendingCancel = true;
                            self.clearScheduledBatch();
                            $('#cancel-bulk-process').prop('disabled', true);
                            return;
                        }

                        if (self.isTerminalStatus(response.data.status)) {
                            self.finishProcess(response.data);
                            return;
                        }

                        if (self.backgroundMode) {
                            self.updateLiveTask(null, t('backgroundTask', 'Images are processed in the background a few at a time.'), t('backgroundState', 'Background'));
                            $('#progress-status').text(t('backgroundStatus', 'Running in the background')).removeClass('success error').addClass('warning');
                            return;
                        }

                        // Schedule the next billable request after the UI has rendered the latest count.
                        if (response.data.needs_next_batch && response.data.next_batch_offset !== null) {
                            self.scheduleNextBatch(response.data.next_batch_offset, response.data.retry_after_seconds);
                        }
                    } else if (self.pendingCancel && self.pendingBatchRequests.length === 0) {
                        // The stopped run's saved state is already gone.
                        self.finishProcess({ status: 'cancelled' });
                    }
                }
            });
        },

        scheduleNextBatch: function (offset, retryAfterSeconds) {
            var self = this;
            if (this.cancelRequested || this.pendingCancel || !this.isProcessing || !this.processId || this.backgroundMode) return;
            if (this.processingBatches[offset]) return;
            if (this.nextBatchTimer && this.scheduledBatchOffset === offset) return;

            var delayMs = this.batchDelayMs;
            if (retryAfterSeconds) {
                delayMs = Math.max(delayMs, parseInt(retryAfterSeconds, 10) * 1000);
                $('#progress-status').text(t('waitingRateLimit', 'Waiting for the service before retrying...'));
                this.updateLiveTask(offset + 1, t('waitingRateLimitTask', 'Waiting before retrying this image.'), t('waiting', 'Waiting'));
            } else {
                this.updateLiveTask(offset + 1, t('readyNext', 'Ready to start after the latest update.'), t('queued', 'Queued'));
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
            if (this.cancelRequested || this.pendingCancel || !this.isProcessing || !this.processId || this.backgroundMode) return;

            // Prevent duplicate requests for same offset
            if (this.processingBatches[offset]) return;
            this.processingBatches[offset] = true;

            debugLog('Alt Text Pro: Triggering batch at offset ' + offset);
            $('#progress-status').text(sprintf(t('processingImage', 'Processing image %d...'), parseInt(offset, 10) + 1)).removeClass('success error').addClass('warning');
            this.updateLiveTask(parseInt(offset, 10) + 1, t('analysing', 'Alt Text Pro AI is analysing this image.'), t('generatingState', 'Generating'));

            var batchReq = $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_bulk_process_batch',
                    process_id: this.processId,
                    batch_offset: offset,
                    nonce: altTextAI.nonce
                },
                timeout: 75000,
                success: function (response) {
                    // Remove from pending list
                    var idx = self.pendingBatchRequests.indexOf(batchReq);
                    if (idx > -1) self.pendingBatchRequests.splice(idx, 1);
                    delete self.processingBatches[offset];

                    if (response.success && response.data && response.data.batch_results) {
                        self.appendBatchResults(response.data.batch_results);
                    }

                    if (response.success && response.data) {
                        self.updateProgress(response.data);

                        if (self.pendingCancel) {
                            var cancelStatus = response.data.status;
                            if (self.isTerminalStatus(cancelStatus)) {
                                self.finishProcess(response.data);
                            } else {
                                $('#progress-status').text(t('stoppingAfterCurrent', 'Stopping after current image...')).removeClass('success error').addClass('warning');
                                self.updateLiveTask(null, t('finishingCurrent', 'Finishing the current image before stopping.'), t('stopping', 'Stopping'));
                                self.sendCancelRequest();
                            }
                            return;
                        }

                        if (self.isTerminalStatus(response.data.status)) {
                            self.finishProcess(response.data);
                            return;
                        }

                        if (response.data.needs_next_batch && response.data.next_batch_offset !== null) {
                            self.scheduleNextBatch(response.data.next_batch_offset, response.data.retry_after_seconds);
                        }
                    } else {
                        self.handleBatchRequestFailure(response && typeof response.data === 'string' ? response.data : t('bulkRequestFailed', 'Bulk request failed. Please try again.'));
                    }
                },
                error: function (xhr, textStatus) {
                    var idx = self.pendingBatchRequests.indexOf(batchReq);
                    if (idx > -1) self.pendingBatchRequests.splice(idx, 1);
                    delete self.processingBatches[offset];
                    if (self.pendingCancel) {
                        $('#progress-status').text(t('stoppingAfterCurrent', 'Stopping after current image...')).removeClass('success error').addClass('warning');
                        self.updateLiveTask(null, t('finishingCurrent', 'Finishing the current image before stopping.'), t('stopping', 'Stopping'));
                        self.sendCancelRequest();
                        return;
                    }

                    // A timeout or server-side 5xx/413 can happen after the
                    // image request has reached WordPress but before the
                    // browser receives JSON. Recover that one image through a
                    // guarded server-side skip so the queue can continue.
                    var recoverableFailure = textStatus === 'timeout' ||
                        (xhr && [413, 500, 502, 503, 504].indexOf(parseInt(xhr.status, 10)) !== -1);
                    if (recoverableFailure) {
                        self.skipFailedBatch(offset, xhr && parseInt(xhr.status, 10) === 413 ? 'too_large' : '', 0);
                        return;
                    }

                    var failureMessage = textStatus === 'timeout'
                        ? t('bulkRequestTimeout', 'Bulk request timed out. Please try again.')
                        : ajaxErrorMessage(xhr, t('bulkRequestFailed', 'Bulk request failed. Please try again.'));
                    self.handleBatchRequestFailure(failureMessage);
                },
                complete: function () {
                    // Remove from pending list
                    var idx = self.pendingBatchRequests.indexOf(batchReq);
                    if (idx > -1) self.pendingBatchRequests.splice(idx, 1);
                }
            });

            this.pendingBatchRequests.push(batchReq);
        },

        skipFailedBatch: function (offset, failureType, attempt) {
            var self = this;
            var retryAttempt = attempt || 0;
            var maxAttempts = 45;
            var failureMessage = failureType === 'too_large'
                ? t('imageTooLarge', 'Image too large to process.')
                : t('imageNotProcessed', 'Image could not be processed.');

            if (this.cancelRequested || this.pendingCancel || !this.isProcessing || !this.processId) return;
            if (this.processingBatches[offset]) return;

            this.processingBatches[offset] = true;
            $('#progress-status').text(t('skippingFailed', 'Skipping failed image...')).removeClass('success error').addClass('warning');
            this.updateLiveTask(parseInt(offset, 10) + 1, t('recordingFailed', 'Recording the failed image and continuing.'), t('skipping', 'Skipping'));

            var skipReq = $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_pro_bulk_skip_failed_image',
                    process_id: this.processId,
                    batch_offset: offset,
                    failure_type: failureType,
                    nonce: altTextAI.nonce
                },
                timeout: 15000
            }).done(function (response) {
                delete self.processingBatches[offset];

                if (response.success && response.data && response.data.busy) {
                    if (retryAttempt >= maxAttempts) {
                        self.handleBatchRequestFailure(failureMessage);
                        return;
                    }

                    setTimeout(function () {
                        self.skipFailedBatch(offset, failureType, retryAttempt + 1);
                    }, 2000);
                    return;
                }

                if (!response.success || !response.data) {
                    self.handleBatchRequestFailure(failureMessage);
                    return;
                }

                if (response.data.batch_results) {
                    self.appendBatchResults(response.data.batch_results);
                }
                self.updateProgress(response.data);

                if (self.isTerminalStatus(response.data.status)) {
                    self.finishProcess(response.data);
                    return;
                }

                if (response.data.needs_next_batch && response.data.next_batch_offset !== null) {
                    self.scheduleNextBatch(response.data.next_batch_offset, response.data.retry_after_seconds);
                    return;
                }

                self.pollStatus();
            }).fail(function () {
                delete self.processingBatches[offset];
                if (retryAttempt >= maxAttempts) {
                    self.handleBatchRequestFailure(failureMessage);
                    return;
                }

                setTimeout(function () {
                    self.skipFailedBatch(offset, failureType, retryAttempt + 1);
                }, 2000);
            }).always(function () {
                var idx = self.pendingBatchRequests.indexOf(skipReq);
                if (idx > -1) self.pendingBatchRequests.splice(idx, 1);
            });

            this.pendingBatchRequests.push(skipReq);
        },

        handleBatchRequestFailure: function (message) {
            var processed = parseInt($('#processed-stat-count').text(), 10) || 0;
            var successful = parseInt($('#successful-count').text(), 10) || 0;
            var errors = parseInt($('#error-count').text(), 10) || 0;
            var progressText = $('#processed-count').text();
            var totalMatch = progressText.match(/\/\s*(\d+)/);
            var total = totalMatch ? parseInt(totalMatch[1], 10) : 0;

            if (!total || total < processed) {
                total = Math.max(processed + 1, 1);
            }

            this.appendBatchResults([{
                filename: t('bulkProcessingLabel', 'Bulk processing'),
                status: 'error',
                error: message
            }]);
            this.finishProcess({
                status: 'error',
                total_images: total,
                processable_images: total,
                processed_count: processed,
                successful_count: successful,
                error_count: errors + 1,
                errors: [message]
            });
        },

        updateProgress: function (data) {
            if (data && data.mode && (data.mode === 'background') !== this.backgroundMode && (this.isProcessing || this.pendingCancel)) {
                this.setMode(data.mode);
            }
            var total = data.total_images || 0;
            var displayTotal = data.processable_images || total;
            var processed = data.processed_count !== undefined ? data.processed_count : (data.processed || 0);
            var percent = displayTotal > 0 ? Math.round((processed / displayTotal) * 100) : 100;
            percent = Math.min(percent, 100);

            $('#progress-fill').css('width', percent + '%');
            $('#progress-text').text(percent + '%');
            $('#processed-count').text(processed + ' / ' + displayTotal);
            var successful = data.successful_count !== undefined ? data.successful_count : (data.successful || 0);
            var errors = data.error_count !== undefined ? data.error_count : (data.errors ? data.errors.length : 0);
            var remaining = Math.max(0, displayTotal - processed);
            $('#processed-stat-count').text(processed);
            $('#successful-count').text(successful);
            $('#error-count').text(errors);
            $('#remaining-stat-count, #live-remaining-count').text(remaining);
            this.updateProcessLimitNote(data);

            if (data.retry_after_seconds) {
                $('#progress-status').text(t('waitingRateLimit', 'Waiting for the service before retrying...'));
                this.updateLiveTask(null, t('waitingRateLimitTask', 'Waiting before retrying this image.'), t('waiting', 'Waiting'));
                return;
            }
        },

        updateLiveTask: function (position, stage, state) {
            $('#active-image-position').text(position ? sprintf(t('imageN', 'Image %d'), position) : t('processingUpdate', 'Processing update'));
            $('#active-image-stage').text(stage || '');
            $('#active-image-state').text(state || t('working', 'Working'));
        },

        appendBatchResults: function (results) {
            if (!results || !results.length) return;

            var $log = $('#progress-log');
            var self = this;

            results.forEach(function (result) {
                var icon = 'dashicons-yes';
                var statusClass = 'success';
                var statusText = result.suggested ? t('statusSuggested', 'Saved for review') : t('statusSuccess', 'Success');

                if (result.status === 'error') {
                    icon = 'dashicons-no-alt';
                    statusClass = 'error';
                    statusText = t('statusFailed', 'Failed');
                } else if (result.status === 'retrying') {
                    icon = 'dashicons-clock';
                    statusClass = 'skipped';
                    statusText = t('statusRetrying', 'Waiting to retry');
                } else if (result.status === 'skipped') {
                    icon = 'dashicons-warning';
                    statusClass = 'skipped';
                    statusText = t('statusSkipped', 'Skipped');
                } else if (result.status === 'cancelled') {
                    icon = 'dashicons-controls-pause';
                    statusClass = 'skipped';
                    statusText = t('statusStoppedBefore', 'Stopped before generation');
                }

                var filename = result.filename || '';
                var $item = $('<div>').addClass('log-item ' + statusClass);
                $('<span>').addClass('dashicons ' + icon).attr('title', statusText).appendTo($item);
                $('<span>').addClass('log-filename').attr('title', filename).text(filename).appendTo($item);

                if ((result.status === 'error' || result.status === 'retrying') && result.error) {
                    $('<span>').addClass('log-error').text(result.error).appendTo($item);
                }

                $log.append($item);
            });

            // Auto-scroll to bottom
            $log.scrollTop($log[0].scrollHeight);
        },

        finishProcess: function (data) {
            // The status poll and the last batch can both report completion;
            // finish (and log the summary) once per run.
            if (this.finishedProcessId && this.finishedProcessId === this.processId) {
                return;
            }
            this.finishedProcessId = this.processId;

            // The library and credits changed: the next estimate starts fresh.
            if (window.AltTextProBulkTools) {
                window.AltTextProBulkTools.estimateCache = {};
                window.AltTextProBulkTools.scheduleEstimate();
            }

            this.isProcessing = false;
            this.cancelRequested = false;
            this.pendingCancel = false;
            this.pendingBatchRequests = [];
            this.processingBatches = {};
            this.clearScheduledBatch();
            if (this.statusInterval) {
                clearInterval(this.statusInterval);
                this.statusInterval = null;
            }

            $('#start-bulk-process').show();
            $('#cancel-bulk-process').prop('disabled', false).attr('style', 'display: none !important;').hide();
            $('#bulk-mode-panel').hide();
            this.backgroundMode = false;

            this.updateProgress(data);
            this.updateProcessLimitNote(data);

            var processed = data.processed_count !== undefined ? data.processed_count : (data.processed || 0);
            var successful = data.successful_count !== undefined ? data.successful_count : (data.successful || 0);
            var errors = data.error_count !== undefined ? data.error_count : (data.errors ? data.errors.length : 0);

            if (data.success || data.status === 'completed') {
                $('#progress-status').text(t('completedLabel', 'Completed')).removeClass('warning error').addClass('success');
                this.updateLiveTask(null, t('everyImageFinished', 'Every scheduled image has finished.'), t('completedLabel', 'Complete'));
                $('#progress-log').append($('<div class="atp-log-line is-success">').text(t('bulkCompleted', 'Bulk optimization completed!')));
            } else if (data.status === 'cancelled') {
                $('#progress-status').text(t('cancelled', 'Cancelled')).removeClass('warning success').addClass('error');

                $('#process-summary-container').show();
                $('#process-summary-text').text(t('processCancelled', 'Process Cancelled'));
                $('#process-summary-details').text(sprintf(t('cancelledSummary', 'Processed %1$d images (%2$d successful, %3$d errors) before stopping.'), processed, successful, errors));
                this.updateLiveTask(null, t('noMoreImages', 'No additional images will start. Any active image is included above.'), t('stopped', 'Stopped'));
                $('#progress-log').append($('<div class="atp-log-line is-error is-strong">').text(t('cancelledByUser', 'Bulk optimization cancelled by user.')));
            } else if (data.status === 'stopped_no_credits') {
                $('#progress-status').text(t('creditsExhausted', 'Credits Exhausted')).removeClass('warning success').addClass('error');
                $('#process-summary-container').show();
                $('#process-summary-text').text(t('creditsUsedUp', 'Credits Used Up'));
                $('#process-summary-details')
                    .text(data.stopped_reason || sprintf(t('creditsRanOutSummary', 'Processed %d images before available credits ran out.'), processed))
                    .append(' ')
                    .append(upgradeLink());
                this.updateLiveTask(null, t('noCreditsStopped', 'The run stopped because there are no credits remaining. Buy a credit pack or upgrade your plan at alt-text.pro.'), t('stopped', 'Stopped'));
                $('#progress-log').append($('<div class="atp-log-line is-error is-strong">').text(t('ranOutLog', 'Bulk optimization stopped because the account ran out of credits.')));
            } else if (data.status === 'stopped_error') {
                // Invalid key, suspended account or a service that keeps
                // failing: nothing else in the queue could succeed.
                var suspended = data.stopped_code === 'account_suspended';
                $('#progress-status').text(suspended ? t('accountSuspendedTitle', 'Account suspended') : t('runStoppedTitle', 'Run stopped')).removeClass('warning success').addClass('error');
                $('#process-summary-container').show();
                $('#process-summary-text').text(suspended ? t('accountSuspendedTitle', 'Account suspended') : t('runStoppedTitle', 'Run stopped'));
                $('#process-summary-details').text(data.stopped_reason || t('stoppedAccount', 'Bulk processing stopped because of an account or service problem.'));
                if (needsReconnect(data.stopped_code)) {
                    $('#process-summary-details').append(' ').append(settingsLink());
                }
                this.updateLiveTask(null, data.stopped_reason || t('stoppedAccount', 'Bulk processing stopped because of an account or service problem.'), t('stopped', 'Stopped'));
                $('#progress-log').append($('<div class="atp-log-line is-error is-strong">').text(data.stopped_reason || t('stoppedAccount', 'Bulk processing stopped because of an account or service problem.')));
                if (window.AltTextProAdmin && typeof window.AltTextProAdmin.showNotification === 'function') {
                    window.AltTextProAdmin.showNotification(data.stopped_reason || t('stoppedAccount', 'Bulk processing stopped because of an account or service problem.'), 'error');
                }
            } else {
                $('#progress-status').text(t('errorLabel', 'Error')).removeClass('warning success').addClass('error');
                this.updateLiveTask(null, t('endedEarly', 'The run ended before all scheduled images completed.'), t('needsAttentionState', 'Needs attention'));
                $('#progress-log').append($('<div class="atp-log-line is-error">').text(t('endedWithErrors', 'Process ended with errors or was interrupted.')));

                if (window.AltTextProAdmin && typeof window.AltTextProAdmin.showNotification === 'function') {
                    var attentionMessage = errors > 0
                        ? sprintf(errors === 1 ? t('oneImageAttention', '%d image needs attention. Review the activity list for details.') : t('manyImagesAttention', '%d images need attention. Review the activity list for details.'), errors)
                        : t('bulkAttention', 'Bulk processing needs attention. Review the activity list for details.');
                    window.AltTextProAdmin.showNotification(attentionMessage, 'warning');
                }
            }

            this.showResults(data, processed, successful, errors);
        },

        // Results card: totals for the run and the images that failed, so
        // they can be found and retried after the activity log scrolls away.
        showResults: function (data, processed, successful, errorCount) {
            var $summary = $('#results-summary').empty();
            var $errors = $('#results-errors').empty();

            $('<p>').text(sprintf(t('resultsSummary', '%1$d images processed: %2$d got alt text, %3$d failed.'), processed, successful, errorCount)).appendTo($summary);

            var failed = Array.isArray(data.errors) ? data.errors : [];
            if (failed.length) {
                var shown = failed.slice(0, 50);
                $('<p>').append($('<strong>').text(t('resultsFailedHeading', 'Images that failed'))).appendTo($errors);
                var $list = $('<ul class="atp-results-failed">');
                shown.forEach(function (entry) {
                    var id = entry && entry.image_id ? parseInt(entry.image_id, 10) : 0;
                    var name = (entry && entry.filename) || (id ? sprintf(t('imageIdLabel', 'Image #%d'), id) : t('imageNotProcessed', 'Image could not be processed.'));
                    var $item = $('<li>');
                    if (id && window.altTextAI && altTextAI.adminUrl) {
                        $('<a>', { href: altTextAI.adminUrl + 'post.php?post=' + id + '&action=edit', text: name }).appendTo($item);
                    } else {
                        $item.text(name);
                    }
                    if (entry && entry.error) {
                        $item.append(document.createTextNode(': ' + String(entry.error)));
                    }
                    $list.append($item);
                });
                $errors.append($list);
                if (failed.length > shown.length) {
                    $('<p class="description">').text(sprintf(t('resultsMoreFailed', 'And %d more.'), failed.length - shown.length)).appendTo($errors);
                }
                $('<p class="description">').text(t('resultsRetryHint', 'Run the bulk process again to retry these images.')).appendTo($errors);
            }

            $('#results-card').show();
        },

        resetUI: function () {
            $('#bulk-mode-panel').hide();
            this.backgroundMode = false;
            $('#start-bulk-process').show();
            $('#cancel-bulk-process').prop('disabled', false).attr('style', 'display: none !important;').hide();
            $('#progress-card').hide();
            $('#process-progress-container, #bulk-current-task, .bulk-progress-stats, .bulk-stop-hint').show();
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

        showError: function (msg, code) {
            var $line = $('<div>').addClass('atp-log-line is-error').text(sprintf(t('errorPrefix', 'Error: %s'), String(msg || '')));
            if (code === 'no_credits') {
                $line.append(' ').append(upgradeLink());
            } else if (needsReconnect(code)) {
                $line.append(' ').append(settingsLink());
            }
            $('#progress-log').append($line);
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
            var note;
            if (Number.isFinite(planAllowance) && Number.isFinite(planCreditsUsed)) {
                note = sprintf(t('limitNoteUsed', 'This run can process up to %1$d images with available plan credits (%2$d used of %3$d).'), processableTotal, planCreditsUsed, planAllowance);
            } else if (Number.isFinite(creditsRemaining)) {
                note = sprintf(t('limitNoteCredits', 'This run can process up to %1$d images with available plan credits (%2$d credits at start).'), processableTotal, creditsRemaining);
            } else {
                note = sprintf(t('limitNote', 'This run can process up to %d images with available plan credits.'), processableTotal);
            }

            $('#process-limit-note').empty().text(note).append(' ').append(upgradeLink()).show();
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
