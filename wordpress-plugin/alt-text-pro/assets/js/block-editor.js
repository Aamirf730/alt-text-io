/**
 * Alt Text Pro: "Generate alt text" for the image block.
 *
 * Adds an Alt Text Pro panel to the core/image block sidebar. The button
 * generates alt text for the block's Media Library image, fills the block's
 * alternative text, and saves it to the Media Library when the image has
 * none there (or "Overwrite existing" is on). Plain JavaScript: the plugin
 * has no build step.
 */

(function (wp, config) {
    'use strict';

    if (!wp || !config || !wp.hooks || !wp.compose || !wp.element || !wp.components) {
        return;
    }

    var blockEditor = wp.blockEditor || wp.editor;
    if (!blockEditor || !blockEditor.InspectorControls) {
        return;
    }

    var el = wp.element.createElement;
    var Fragment = wp.element.Fragment;
    var useState = wp.element.useState;
    var useRef = wp.element.useRef;
    var useEffect = wp.element.useEffect;
    var InspectorControls = blockEditor.InspectorControls;
    var PanelBody = wp.components.PanelBody;
    var Button = wp.components.Button;
    var Notice = wp.components.Notice;
    var flags = config.flags || {};

    function str(key, fallback) {
        var strings = config.strings || {};
        return typeof strings[key] === 'string' && strings[key] !== '' ? strings[key] : fallback;
    }

    function link(href, text) {
        return el('a', { href: href, target: '_blank', rel: 'noopener noreferrer' }, text);
    }

    // Post being edited, for context. The site editor edits templates,
    // whose IDs are not numbers.
    function currentPostId() {
        try {
            var editor = wp.data && wp.data.select('core/editor');
            var id = editor && editor.getCurrentPostId ? parseInt(editor.getCurrentPostId(), 10) : 0;
            return id > 0 ? id : 0;
        } catch (error) {
            return 0;
        }
    }

    // Attachment ID the block shows right now.
    function blockAttachmentId(clientId, fallback) {
        try {
            var store = wp.data && wp.data.select('core/block-editor');
            var attributes = store && store.getBlockAttributes ? store.getBlockAttributes(clientId) : null;
            return attributes ? (parseInt(attributes.id, 10) || 0) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function post(params) {
        var body = new window.URLSearchParams();
        Object.keys(params).forEach(function (key) {
            body.append(key, params[key]);
        });

        return window.fetch(config.ajaxUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: body.toString()
        }).then(function (response) {
            return response.json().catch(function () {
                return null;
            });
        });
    }

    // Link shown after an error: buy credits, or reconnect in Settings.
    function errorAction(code) {
        if (code === 'no_credits' && config.pricingUrl) {
            return link(config.pricingUrl, str('buyCredits', 'Buy credits or upgrade'));
        }
        if (code === 'invalid_api_key' || code === 'account_not_found') {
            return config.settingsUrl
                ? link(config.settingsUrl, str('openSettings', 'Open Settings to reconnect'))
                : str('askAdmin', 'Ask a site administrator to reconnect Alt Text Pro in its Settings.');
        }
        return null;
    }

    function GeneratePanel(props) {
        var statusState = useState(null);
        var status = statusState[0];
        var setStatus = statusState[1];
        var mounted = useRef(true);
        var attachmentId = parseInt(props.attributes.id, 10) || 0;

        useEffect(function () {
            mounted.current = true;
            return function () {
                mounted.current = false;
            };
        }, []);

        function update(next) {
            if (mounted.current) {
                setStatus(next);
            }
        }

        function generate() {
            var requestedId = attachmentId;
            update({ id: requestedId, busy: true });

            post({
                action: 'alt_text_pro_quick_generate',
                nonce: config.nonce,
                attachment_id: requestedId,
                post_id: currentPostId(),
                source: 'block'
            }).then(function (json) {
                if (!json || !json.success) {
                    var data = json && json.data;
                    update({
                        id: requestedId,
                        type: 'error',
                        message: (data && typeof data === 'object' ? data.message : data) || str('error', 'Alt text could not be generated. Please try again.'),
                        code: data && typeof data === 'object' ? data.code : ''
                    });
                    return;
                }

                var result = json.data || {};

                // The block shows a different image now: do not give it this
                // image's description. Deselecting the block is fine.
                if (blockAttachmentId(props.clientId, requestedId) !== requestedId) {
                    update({ id: requestedId, type: 'error', message: str('imageChanged', 'The image in this block changed while generating, so the alt text was not added.') });
                    return;
                }

                props.setAttributes({ alt: String(result.alt_text || '') });
                update({
                    id: requestedId,
                    type: 'success',
                    message: result.saved
                        ? str('savedBoth', 'Alt text added to this block and saved to the Media Library. Save the post to keep it in the block.')
                        : str('savedBlock', 'Alt text added to this block. The Media Library kept its existing alt text. Save the post to keep it.'),
                    credits: result.credits_remaining
                });
            }).catch(function () {
                update({ id: requestedId, type: 'error', message: str('error', 'Alt text could not be generated. Please try again.') });
            });
        }

        var children = [];

        if (!flags.connected) {
            children.push(el('p', { key: 'connect' },
                config.settingsUrl ? str('notConnected', 'Connect your Alt Text Pro account to generate alt text.') : str('notConnectedNoAdmin', 'Alt Text Pro is not connected yet. Ask a site administrator to connect it.'),
                config.settingsUrl ? ' ' : null,
                config.settingsUrl ? link(config.settingsUrl, str('connect', 'Open Alt Text Pro settings')) : null
            ));
        } else if (!attachmentId) {
            children.push(el('p', { key: 'no-attachment' }, str('noAttachment', 'Alt Text Pro can generate alt text for images from the Media Library.')));
        } else {
            // Status of an earlier image in this block is not shown.
            var current = status && status.id === attachmentId ? status : null;
            var busy = !!(current && current.busy);

            children.push(el(Button, {
                key: 'generate',
                variant: 'secondary',
                isBusy: busy,
                disabled: busy,
                onClick: generate
            }, busy ? str('generating', 'Generating...') : str('generate', 'Generate alt text')));

            children.push(el('p', { key: 'help', className: 'components-base-control__help', style: { marginTop: '8px' } },
                flags.overwrite
                    ? str('helpOverwrite', 'Uses 1 credit. Fills this block\'s alternative text and replaces the image\'s alt text in the Media Library.')
                    : str('helpKeep', 'Uses 1 credit. Fills this block\'s alternative text. The Media Library alt text is filled only when it is empty.')
            ));

            if (current && current.type) {
                var action = current.type === 'error' ? errorAction(current.code) : null;
                var credits = current.type === 'success' && current.credits !== undefined && current.credits !== null
                    ? str('creditsLeft', 'Credits left: %d').replace('%d', String(parseInt(current.credits, 10) || 0))
                    : '';

                children.push(el(Notice, { key: 'notice', status: current.type, isDismissible: false },
                    el('p', null, current.message, action ? ' ' : null, action),
                    credits ? el('p', null, credits) : null
                ));
            }
        }

        return el(PanelBody, { title: str('panelTitle', 'Alt Text Pro'), initialOpen: true }, children);
    }

    var withGenerateButton = wp.compose.createHigherOrderComponent(function (BlockEdit) {
        return function (props) {
            if (props.name !== 'core/image' || !props.isSelected) {
                return el(BlockEdit, props);
            }

            return el(Fragment, null,
                el(BlockEdit, props),
                el(InspectorControls, null, el(GeneratePanel, props))
            );
        };
    }, 'withAltTextProGenerateButton');

    wp.hooks.addFilter('editor.BlockEdit', 'alt-text-pro/image-generate-button', withGenerateButton);
})(window.wp, window.altTextProBlockEditor);
