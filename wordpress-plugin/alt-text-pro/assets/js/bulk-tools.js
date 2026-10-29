/**
 * Alt Text Pro: Bulk page tools and the Review page.
 *
 * - Run estimate before Start: credits, time, images whose alt text would be
 *   replaced, and a confirmation when credits run short or alt text is
 *   replaced.
 * - Filters (uploaded date, attached-to post type, category).
 * - "Keep going in the background" (WP-Cron) for new, running and paused runs.
 * - Recent runs: failed and skipped images, and "Undo this run".
 * - Review page: approve (optionally edited), reject, approve all.
 *
 * Loaded after admin.js, which owns the run itself (window.bulkProcessor).
 */
(function ($) {
    'use strict';

    var config = window.altTextProBulkTools || {};

    // Make these strings available to admin.js's t() as well.
    if (window.altTextAI) {
        window.altTextAI.strings = $.extend({}, config.strings || {}, window.altTextAI.strings || {});
    }

    var i18n = window.AltTextProI18n || {};
    var t = i18n.t || function (key, fallback) { return fallback; };
    var sprintf = i18n.sprintf || function (template) { return String(template); };
    var ajaxErrorMessage = i18n.ajaxErrorMessage || function (xhr, fallback) { return fallback; };

    function formatNumber(value) {
        var number = parseInt(value, 10) || 0;
        try {
            return number.toLocaleString();
        } catch (e) {
            return String(number);
        }
    }

    function notify(message, type) {
        if (window.AltTextProAdmin && typeof window.AltTextProAdmin.showNotification === 'function') {
            window.AltTextProAdmin.showNotification(message, type || 'success');
        } else {
            window.alert(message);
        }
    }

    function post(data) {
        return $.post(window.altTextAI.ajaxUrl, $.extend({ nonce: window.altTextAI.nonce }, data));
    }

    // ------------------------------------------------------------------
    // Bulk page
    // ------------------------------------------------------------------
    var Tools = {
        estimateCache: {},
        estimateTimer: null,
        lastRendered: '',

        getFilters: function () {
            var filters = {};
            $('.atp-bulk-filter').each(function () {
                var value = $(this).val();
                if (value) {
                    filters[$(this).data('filter')] = value;
                }
            });
            return filters;
        },

        requestData: function () {
            var type = $('input[name="process_type"]:checked').val() || 'missing';
            var data = {
                action: 'alt_text_pro_bulk_estimate',
                process_type: type,
                overwrite_existing: $('#overwrite_existing').is(':checked') ? 1 : 0,
                filters: this.getFilters()
            };
            if (type === 'selected') {
                data.selected_images = window.bulkProcessor ? Object.keys(window.bulkProcessor.selectedImages || {}) : [];
            }
            return data;
        },

        cacheKey: function (data) {
            return JSON.stringify([data.process_type, data.overwrite_existing, data.filters, (data.selected_images || []).slice().sort()]);
        },

        // Estimate for the current choices. The preview is cached per
        // choice set; Start asks for a fresh one (fresh = true), so library
        // and credit changes since the last run are always confirmed.
        fetchEstimate: function (fresh) {
            var data = this.requestData();
            var key = this.cacheKey(data);
            var self = this;

            if (data.process_type === 'selected' && !data.selected_images.length) {
                return $.Deferred().resolve(null, key).promise();
            }
            if (fresh) {
                this.estimateCache = {};
                data.fresh = 1;
            } else if (this.estimateCache[key]) {
                return $.Deferred().resolve(this.estimateCache[key], key).promise();
            }

            return post(data).then(function (response) {
                if (!response || !response.success) {
                    return $.Deferred().reject().promise();
                }
                self.estimateCache[key] = response.data;
                return $.Deferred().resolve(response.data, key).promise();
            });
        },

        scheduleEstimate: function () {
            var self = this;
            clearTimeout(this.estimateTimer);
            this.estimateTimer = setTimeout(function () {
                self.fetchEstimate().done(function (estimate, key) {
                    // Ignore an answer for choices that changed meanwhile.
                    if (key === self.cacheKey(self.requestData())) {
                        self.render(estimate);
                    }
                });
            }, 300);
        },

        render: function (estimate) {
            var $box = $('#bulk-estimate');
            var $text = $('#bulk-estimate-text');
            var filtersActive = Object.keys(this.getFilters()).length;

            $('#bulk-filters-active').text(filtersActive ? sprintf(t('filtersActive', '(%d active)'), filtersActive) : '');

            if (!estimate) {
                if ($('input[name="process_type"]:checked').val() === 'selected') {
                    $text.text(t('estimateSelectFirst', 'Select images to see what the run will cost.'));
                    $box.show();
                } else {
                    $box.hide();
                }
                return;
            }

            if (estimate.counts) {
                $('#bulk-count-missing').text('(' + sprintf(t('imagesCount', '%s images'), formatNumber(estimate.counts.missing)) + ')');
                $('#bulk-count-all').text('(' + sprintf(t('imagesCount', '%s images'), formatNumber(estimate.counts.all)) + ')');
            }

            var parts = [];
            if (!estimate.images) {
                parts.push(t('estimateNone', 'No images match these choices, so this run would use no credits.'));
            } else if (estimate.credit_limit !== null && estimate.credit_limit !== undefined && estimate.will_process < estimate.images) {
                parts.push(sprintf(
                    t('estimateShort', '%1$s images match, but you have credits for %2$s. The run will stop after %2$s images (about %3$s) and use about %2$s credits.'),
                    formatNumber(estimate.images),
                    formatNumber(estimate.will_process),
                    estimate.estimated_time
                ));
            } else {
                parts.push(sprintf(
                    t('estimateFull', 'This run will use about %1$s credits (1 per image) and take about %2$s.'),
                    formatNumber(estimate.will_process),
                    estimate.estimated_time
                ));
            }

            if (estimate.with_alt > 0) {
                parts.push(estimate.review_mode
                    ? sprintf(t('estimateReplaceReview', '%s of these images already have alt text; new suggestions replace it only when you approve them.'), formatNumber(estimate.with_alt))
                    : sprintf(t('estimateReplace', '%s of these images already have alt text, which will be replaced (you can undo the run).'), formatNumber(estimate.with_alt)));
            }
            if (estimate.queue_capped) {
                parts.push(t('estimateCapped', 'One run takes the newest 20,000 images; start another run afterwards for older ones.'));
            }
            if (estimate.review_mode && estimate.images) {
                parts.push(t('estimateReview', 'The new alt text waits on the Review page until you approve it.'));
            }

            $text.text(parts.join(' '));
            $box.toggleClass('is-error', estimate.credit_limit !== null && estimate.credit_limit !== undefined && estimate.will_process < estimate.images).show();
        },

        // Confirm before replacing existing alt text or starting a run that
        // the available credits cannot finish.
        confirmRun: function (estimate) {
            if (!estimate) {
                return true;
            }

            var messages = [];
            if (estimate.with_alt > 0 && !estimate.review_mode) {
                messages.push(sprintf(
                    t('confirmReplace', '%s images in this run already have alt text, and the run will replace it. The old alt text is saved, so you can undo the run from Recent runs.'),
                    formatNumber(estimate.with_alt)
                ));
            }
            if (estimate.credit_limit !== null && estimate.credit_limit !== undefined && estimate.images > estimate.will_process) {
                messages.push(sprintf(
                    t('confirmShort', 'You have credits for %1$s of the %2$s images, so the run will stop after %1$s images.'),
                    formatNumber(estimate.will_process),
                    formatNumber(estimate.images)
                ));
            }

            if (!messages.length) {
                return true;
            }

            return window.confirm(messages.join('\n\n') + '\n\n' + t('confirmStart', 'Start the run?'));
        },

        setMode: function (processId, mode) {
            return post({ action: 'alt_text_pro_bulk_set_mode', process_id: processId, mode: mode });
        },

        bindBulkPage: function () {
            var self = this;
            var bp = window.bulkProcessor;
            if (!$('#bulk-process-form').length || !bp) {
                return;
            }

            // Estimate on every change of the run's choices.
            $(document).on('change', 'input[name="process_type"], #overwrite_existing, .atp-bulk-filter', function () {
                self.scheduleEstimate();
            });
            $(document).on('change', '#image-list input[type="checkbox"]', function () {
                self.scheduleEstimate();
            });
            $(document).on('click', '#select-all-images, #deselect-all-images', function () {
                self.scheduleEstimate();
            });
            // The "Selected" list follows the filters.
            $(document).on('change', '.atp-bulk-filter', function () {
                if (bp.pickerLoaded && typeof bp.loadImagePage === 'function') {
                    bp.loadImagePage(1);
                }
            });

            // Check the estimate (and confirm) before the run starts.
            var originalStart = bp.startProcessing;
            bp.startProcessing = function () {
                var processor = this;
                if (processor.isProcessing || self.confirming) {
                    return;
                }
                if ($('input[name="process_type"]:checked').val() === 'selected' && !Object.keys(processor.selectedImages || {}).length) {
                    originalStart.call(processor);
                    return;
                }

                self.confirming = true;
                $('#start-bulk-process').prop('disabled', true);
                self.fetchEstimate(true).always(function () {
                    self.confirming = false;
                    $('#start-bulk-process').prop('disabled', false);
                }).done(function (estimate) {
                    self.render(estimate);
                    if (self.confirmRun(estimate)) {
                        originalStart.call(processor);
                    }
                }).fail(function () {
                    // The estimate is a convenience; the run checks credits itself.
                    originalStart.call(processor);
                });
            };

            // Running in this tab: hand the run over to WP-Cron.
            $(document).on('click', '#bulk-to-background, #bulk-to-foreground', function () {
                var $button = $(this);
                var mode = $button.attr('id') === 'bulk-to-background' ? 'background' : 'foreground';
                if (!bp.processId) {
                    return;
                }
                $button.prop('disabled', true);
                self.setMode(bp.processId, mode).done(function (response) {
                    if (response && response.success) {
                        bp.setMode(mode);
                        notify(mode === 'background'
                            ? t('movedToBackground', 'The run keeps going in the background. You can close this tab; you will get an email when it finishes if completion emails are on.')
                            : t('movedToTab', 'The run continues in this tab. Keep it open.'));
                    } else {
                        notify((response && response.data) || t('error', 'Something went wrong.'), 'error');
                    }
                }).fail(function (xhr) {
                    notify(ajaxErrorMessage(xhr, t('error', 'Something went wrong.')), 'error');
                }).always(function () {
                    $button.prop('disabled', false);
                });
            });

            // Background run found on page load (for example stalled because
            // WP-Cron is not running): continue it in this tab.
            $(document).on('click', '#resume-bulk-foreground', function () {
                var run = window.altTextAI && window.altTextAI.bulk;
                var $button = $(this);
                if (!run || !run.process_id) {
                    return;
                }
                $button.prop('disabled', true);
                self.setMode(run.process_id, 'foreground').done(function (response) {
                    if (response && response.success) {
                        run.mode = 'foreground';
                        bp.resumeProcessing();
                    } else {
                        $button.prop('disabled', false);
                        notify((response && response.data) || t('error', 'Something went wrong.'), 'error');
                    }
                }).fail(function (xhr) {
                    $button.prop('disabled', false);
                    notify(ajaxErrorMessage(xhr, t('error', 'Something went wrong.')), 'error');
                });
            });

            // Paused run found on page load: continue it in the background.
            $(document).on('click', '#resume-bulk-background', function () {
                var run = window.altTextAI && window.altTextAI.bulk;
                var $button = $(this);
                if (!run || !run.process_id) {
                    return;
                }
                $button.prop('disabled', true);
                self.setMode(run.process_id, 'background').done(function (response) {
                    if (response && response.success) {
                        run.mode = 'background';
                        bp.resumeProcessing();
                    } else {
                        $button.prop('disabled', false);
                        notify((response && response.data) || t('error', 'Something went wrong.'), 'error');
                    }
                }).fail(function (xhr) {
                    $button.prop('disabled', false);
                    notify(ajaxErrorMessage(xhr, t('error', 'Something went wrong.')), 'error');
                });
            });

            this.bindRecentRuns();
            this.scheduleEstimate();
        },

        bindRecentRuns: function () {
            // Failed and skipped images of a finished run.
            $(document).on('click', '.atp-run-items-toggle', function () {
                var $button = $(this);
                var $run = $button.closest('.atp-recent-run');
                var $items = $run.find('.atp-run-items');
                var expanded = $button.attr('aria-expanded') === 'true';

                if (expanded) {
                    $items.prop('hidden', true);
                    $button.attr('aria-expanded', 'false');
                    return;
                }
                $button.attr('aria-expanded', 'true');
                $items.prop('hidden', false);
                if ($items.data('loaded')) {
                    return;
                }

                $items.empty().append($('<p class="atp-muted">').text(t('loadingImages', 'Loading images...')));
                post({ action: 'alt_text_pro_bulk_run_items', run_ref: $run.data('run-ref') }).done(function (response) {
                    $items.empty();
                    if (!response || !response.success) {
                        $items.append($('<p class="atp-muted">').text((response && response.data) || t('loadImagesFailed', 'Images could not be loaded.')));
                        return;
                    }
                    var list = response.data.items || [];
                    if (!list.length) {
                        $items.append($('<p class="atp-muted">').text(t('runItemsNone', 'No failed or skipped images were recorded for this run.')));
                        return;
                    }
                    var $list = $('<ul class="atp-results-failed">');
                    list.forEach(function (item) {
                        var $li = $('<li>');
                        $('<span>').addClass('atp-badge atp-outcome is-' + (item.outcome === 'failed' ? 'failed' : 'skipped'))
                            .text(item.outcome === 'failed' ? t('statusFailed', 'Failed') : t('statusSkipped', 'Skipped'))
                            .appendTo($li);
                        $li.append(' ');
                        if (item.edit_url) {
                            $('<a>', { href: item.edit_url, text: item.title }).appendTo($li);
                        } else {
                            $li.append(document.createTextNode(item.title));
                        }
                        if (item.reason) {
                            $li.append(document.createTextNode(': ' + item.reason));
                        }
                        $list.append($li);
                    });
                    $items.append($list);
                    if (list.length >= (response.data.limit || 200)) {
                        $items.append($('<p class="description">').text(sprintf(t('runItemsLimit', 'The first %d are listed. Logs and the CSV export have all of them.'), response.data.limit || 200)));
                    }
                    $items.data('loaded', true);
                }).fail(function (xhr) {
                    $items.empty().append($('<p class="atp-muted">').text(ajaxErrorMessage(xhr, t('loadImagesFailed', 'Images could not be loaded.'))));
                });
            });

            // Undo a finished run, a chunk at a time.
            $(document).on('click', '.atp-run-undo', function () {
                var $button = $(this);
                var $run = $button.closest('.atp-recent-run');
                var $status = $run.find('.atp-run-undo-status');
                var totals = { restored: 0, changed: 0, not_allowed: 0, withdrawn: 0 };

                if (!window.confirm(sprintf(
                    t('undoConfirm', 'Undo this run? Up to %s images get back the alt text they had before it. Images whose alt text was changed since keep the newer text. No credits are used. Only alt text is undone: titles, captions and descriptions filled from it (Settings > Image title, caption and description) stay as they are.'),
                    formatNumber($button.data('count'))
                ))) {
                    return;
                }

                $button.prop('disabled', true);
                $status.text(t('undoing', 'Undoing the run...'));

                function step(afterId) {
                    post({ action: 'alt_text_pro_bulk_undo_run', run_ref: $run.data('run-ref'), after_id: afterId }).done(function (response) {
                        if (!response || !response.success) {
                            $button.prop('disabled', false);
                            $status.text((response && response.data) || t('error', 'Something went wrong.'));
                            return;
                        }
                        var data = response.data;
                        Object.keys(totals).forEach(function (key) {
                            totals[key] += parseInt(data[key], 10) || 0;
                        });
                        if (!data.done) {
                            $status.text(sprintf(t('undoProgress', 'Undoing the run... %s images restored so far.'), formatNumber(totals.restored)));
                            step(data.after_id);
                            return;
                        }

                        var summary = sprintf(
                            t('undoDone', 'Done. %1$s images got their previous alt text back. %2$s kept their alt text because it was changed after the run. Only alt text is undone: titles, captions and descriptions filled from it (Settings > Image title, caption and description) stay as they are.'),
                            formatNumber(totals.restored),
                            formatNumber(totals.changed)
                        );
                        if (totals.withdrawn) {
                            summary += ' ' + sprintf(t('undoWithdrawn', '%s suggestions waiting for review were withdrawn.'), formatNumber(totals.withdrawn));
                        }
                        if (totals.not_allowed) {
                            summary += ' ' + sprintf(t('undoNotAllowed', '%s images were skipped because you cannot edit them.'), formatNumber(totals.not_allowed));
                        }
                        $status.text(summary);
                        $button.remove();
                    }).fail(function (xhr) {
                        $button.prop('disabled', false);
                        $status.text(ajaxErrorMessage(xhr, t('error', 'Something went wrong.')));
                    });
                }

                step(0);
            });
        }
    };

    // ------------------------------------------------------------------
    // Review page
    // ------------------------------------------------------------------
    var Review = {
        updateRemaining: function (remaining) {
            $('#atp-review-status').text(sprintf(
                remaining === 1 ? t('reviewRemainingOne', '%s suggestion is waiting for review.') : t('reviewRemaining', '%s suggestions are waiting for review.'),
                formatNumber(remaining)
            ));
            if (!remaining) {
                $('#atp-review-approve-all').remove();
            }
        },

        removeRow: function ($row) {
            $row.fadeOut(200, function () {
                $row.remove();
                if (!$('.atp-review-row').length) {
                    window.location.reload();
                }
            });
        },

        bind: function () {
            var self = this;
            if (!$('.alt-text-pro-review').length) {
                return;
            }

            $(document).on('click', '.atp-review-approve, .atp-review-reject', function () {
                var $button = $(this);
                var $row = $button.closest('.atp-review-row');
                var approve = $button.hasClass('atp-review-approve');
                var data = {
                    action: approve ? 'alt_text_pro_review_approve' : 'alt_text_pro_review_reject',
                    attachment_id: $row.data('attachment-id')
                };
                if (approve) {
                    var text = $.trim($row.find('.atp-review-text').val());
                    if (!text) {
                        notify(t('reviewEmpty', 'Alt text cannot be empty. Reject the suggestion instead.'), 'error');
                        return;
                    }
                    data.alt_text = text;
                }

                $row.find('button').prop('disabled', true);
                post(data).done(function (response) {
                    if (response && response.success) {
                        self.updateRemaining(parseInt(response.data.remaining, 10) || 0);
                        self.removeRow($row);
                    } else {
                        $row.find('button').prop('disabled', false);
                        notify((response && response.data) || t('error', 'Something went wrong.'), 'error');
                    }
                }).fail(function (xhr) {
                    $row.find('button').prop('disabled', false);
                    notify(ajaxErrorMessage(xhr, t('error', 'Something went wrong.')), 'error');
                });
            });

            $(document).on('click', '#atp-review-approve-all', function () {
                var $button = $(this);
                var question = sprintf(
                    t('approveAllConfirm', 'Approve all %1$s suggestions as written? %2$s of them replace alt text the image already has. Edits you typed but did not approve are ignored.'),
                    formatNumber($button.data('total')),
                    formatNumber($button.data('replacing'))
                );
                if (!window.confirm(question)) {
                    return;
                }

                var approvedTotal = 0;
                $button.prop('disabled', true);
                $('.atp-review-row button').prop('disabled', true);

                function step() {
                    post({ action: 'alt_text_pro_review_approve_all' }).done(function (response) {
                        if (!response || !response.success) {
                            notify((response && response.data) || t('error', 'Something went wrong.'), 'error');
                            window.location.reload();
                            return;
                        }
                        var approved = parseInt(response.data.approved, 10) || 0;
                        var remaining = parseInt(response.data.remaining, 10) || 0;
                        approvedTotal += approved;
                        self.updateRemaining(remaining);
                        // Stop when done, or when the rest cannot be approved by this user.
                        if (remaining > 0 && approved > 0) {
                            step();
                            return;
                        }
                        notify(sprintf(t('approveAllDone', '%s suggestions approved.'), formatNumber(approvedTotal)));
                        setTimeout(function () { window.location.reload(); }, 800);
                    }).fail(function (xhr) {
                        notify(ajaxErrorMessage(xhr, t('error', 'Something went wrong.')), 'error');
                        window.location.reload();
                    });
                }

                step();
            });
        }
    };

    window.AltTextProBulkTools = Tools;

    $(function () {
        Tools.bindBulkPage();
        Review.bind();
    });
})(jQuery);
