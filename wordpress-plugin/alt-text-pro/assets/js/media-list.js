/**
 * Alt Text Pro: Media Library list view.
 *
 * The "Generate alt text" row action generates in place and shows the
 * result under the image title, without leaving the page. Images without
 * alt text (or every image with "Overwrite existing" on) are saved right
 * away; otherwise the new text is offered with "Replace alt text".
 */

(function ($) {
    'use strict';

    var config = window.altTextProMediaList || {};
    var helpers = window.AltTextProI18n || {};

    function str(key, fallback) {
        var strings = config.strings || {};
        return typeof strings[key] === 'string' && strings[key] !== '' ? strings[key] : fallback;
    }

    function translate(key, fallback) {
        return typeof helpers.t === 'function' ? helpers.t(key, fallback) : fallback;
    }

    // Result area under the row's title, created on first use.
    function resultBox($link) {
        var $cell = $link.closest('td');
        var $box = $cell.children('.atp-row-result');
        if (!$box.length) {
            $box = $('<div class="atp-ui atp-row-result" role="status" aria-live="polite">').appendTo($cell);
        }
        return $box;
    }

    function show($box, type, $content) {
        $box.attr('class', 'atp-ui atp-row-result is-' + type).empty().append($content);
    }

    function setBusy($link, busy) {
        $link.toggleClass('is-busy', busy).attr('aria-disabled', busy ? 'true' : 'false');
    }

    function quoted(label, text) {
        return $('<p>').append($('<strong>').text(label)).append(' ').append($('<q>').text(text));
    }

    function creditsLine(data) {
        if (data.credits_remaining === undefined || data.credits_remaining === null) {
            return $();
        }
        return $('<p class="atp-row-result-meta">').text(
            translate('creditsLeft', 'Credits left: %d').replace('%d', String(parseInt(data.credits_remaining, 10) || 0))
        );
    }

    // Error text, with the buy-credits link or the link to Settings when the
    // key was rejected.
    function errorContent(message, code) {
        var $p = $('<p>').text(message || str('error', 'Alt text could not be generated. Please try again.'));
        if (code === 'no_credits' && typeof helpers.upgradeLink === 'function') {
            $p.append(' ').append(helpers.upgradeLink());
        } else if (typeof helpers.needsReconnect === 'function' && helpers.needsReconnect(code) && typeof helpers.settingsLink === 'function') {
            $p.append(' ').append(helpers.settingsLink());
        }
        return $p;
    }

    function responseError(response) {
        var data = response && response.data;
        return {
            message: data && typeof data === 'object' ? data.message : data,
            code: data && typeof data === 'object' ? data.code : ''
        };
    }

    function xhrError(xhr, fallback) {
        var json = xhr && xhr.responseJSON;
        return {
            message: typeof helpers.ajaxErrorMessage === 'function' ? helpers.ajaxErrorMessage(xhr, fallback) : fallback,
            code: json && json.data && typeof json.data === 'object' ? json.data.code : ''
        };
    }

    // The image kept its alt text: show both texts and let the user choose.
    function showDraft($box, attachmentId, data) {
        var altText = String(data.alt_text || '');
        var $replace = $('<button type="button" class="button button-small">').text(str('replace', 'Replace alt text'));
        var $keep = $('<button type="button" class="button-link">').text(str('keep', 'Keep current alt text'));
        var $content = $('<div>')
            .append($('<p>').text(str('draftNotSaved', 'This image already has alt text, so the new text was not saved. The credit has been used.')))
            .append(quoted(str('newText', 'New:'), altText))
            .append(quoted(str('currentText', 'Current:'), String(data.existing_alt || '')))
            .append($('<p class="atp-row-result-actions">').append($replace, ' ', $keep))
            .append(creditsLine(data));

        show($box, 'draft', $content);

        $keep.on('click', function () {
            $box.remove();
        });

        $replace.on('click', function () {
            $replace.add($keep).prop('disabled', true);
            $content.children('.atp-row-result-error').remove();

            $.post(config.ajaxUrl, {
                action: 'alt_text_pro_apply_alt_text',
                nonce: config.nonce,
                attachment_id: attachmentId,
                alt_text: altText
            }).done(function (response) {
                if (response && response.success) {
                    show($box, 'success', quoted(str('saved', 'Alt text saved:'), (response.data && response.data.alt_text) || altText));
                    return;
                }
                var error = responseError(response);
                $replace.add($keep).prop('disabled', false);
                $content.append(errorContent(error.message || str('saveError', 'The alt text could not be saved. Please try again.'), error.code).addClass('atp-row-result-error'));
            }).fail(function (xhr) {
                var error = xhrError(xhr, str('saveError', 'The alt text could not be saved. Please try again.'));
                $replace.add($keep).prop('disabled', false);
                $content.append(errorContent(error.message, error.code).addClass('atp-row-result-error'));
            });
        });
    }

    $(document).on('click', '.atp-row-generate', function (e) {
        e.preventDefault();

        var $link = $(this);
        var attachmentId = parseInt($link.data('attachment-id'), 10);
        if (!attachmentId || $link.hasClass('is-busy')) {
            return;
        }

        var $box = resultBox($link);
        setBusy($link, true);
        show($box, 'loading', $('<p>')
            .append('<span class="spinner is-active" aria-hidden="true"></span>')
            .append($('<span>').text(str('generating', 'Generating alt text (uses 1 credit)...'))));

        $.post(config.ajaxUrl, {
            action: 'alt_text_pro_quick_generate',
            nonce: config.nonce,
            attachment_id: attachmentId,
            source: 'list'
        }).done(function (response) {
            if (!response || !response.success) {
                var error = responseError(response);
                show($box, 'error', errorContent(error.message, error.code));
                return;
            }

            var data = response.data || {};
            if (data.saved) {
                show($box, 'success', $('<div>')
                    .append(quoted(str('saved', 'Alt text saved:'), String(data.alt_text || '')))
                    .append(creditsLine(data)));
                $link.text(str('regenerate', 'Regenerate alt text'));
                return;
            }

            showDraft($box, attachmentId, data);
        }).fail(function (xhr) {
            var error = xhrError(xhr, str('error', 'Alt text could not be generated. Please try again.'));
            show($box, 'error', errorContent(error.message, error.code));
        }).always(function () {
            setBusy($link, false);
        });
    });
})(jQuery);
