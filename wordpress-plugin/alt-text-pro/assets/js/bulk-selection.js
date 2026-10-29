/**
 * Alt Text Pro: Bulk page opened from the Media Library bulk action
 * "Generate alt text (Alt Text Pro)".
 *
 * Switches the page to "Process selected images" with the images chosen in
 * the Media Library already selected, and says what was left out. The run
 * itself starts only when the user clicks Start.
 */

(function ($) {
    'use strict';

    var data = window.altTextProBulkSelection;
    if (!data) {
        return;
    }

    $(function () {
        var ids = $.isArray(data.ids) ? data.ids : [];
        var $choices = $('.atp-choice-list').first();

        if (data.message && $choices.length) {
            $('<div class="atp-info-box" role="status">')
                .toggleClass('is-error', ids.length === 0)
                .append('<span class="dashicons dashicons-images-alt2" aria-hidden="true"></span>')
                .append($('<span>').text(String(data.message)))
                .insertBefore($choices);
        }

        var processor = window.bulkProcessor;
        if (!ids.length || !processor || !processor.selectedImages) {
            return;
        }

        // Same keys the picker uses (the checkbox values).
        $.each(ids, function (index, id) {
            var key = parseInt(id, 10);
            if (key > 0) {
                processor.selectedImages[String(key)] = true;
            }
        });

        // Shows the picker and the selected count, and enables Start.
        $('input[name="process_type"][value="selected"]').prop('checked', true).trigger('change');
    });
})(jQuery);
