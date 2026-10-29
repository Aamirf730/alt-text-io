/**
 * Alt Text Pro: remember that the low-credit notice was dismissed.
 *
 * WordPress adds the close button to .notice.is-dismissible and hides the
 * notice; this only tells the server, so the notice stays hidden until the
 * credit level changes (for example from low to none).
 */
(function ($) {
    'use strict';

    $(document).on('click', '.alt-text-pro-credit-notice .notice-dismiss', function () {
        var $notice = $(this).closest('.alt-text-pro-credit-notice');
        var url = window.ajaxurl;

        if (!url || !$notice.length) {
            return;
        }

        $.post(url, {
            action: 'alt_text_pro_dismiss_credit_notice',
            nonce: $notice.attr('data-nonce'),
            level: $notice.attr('data-level')
        });
    });
})(jQuery);
