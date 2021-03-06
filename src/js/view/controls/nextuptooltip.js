import nextUpTemplate from 'view/controls/templates/nextup';

define([
    'utils/dom',
    'utils/ui',
    'utils/helpers',
], function(dom, UI, utils) {

    return class NextUpTooltip {
        constructor(_model, _api, playerElement) {
            this._model = _model;
            this._api = _api;
            this._playerElement = playerElement;
            this.nextUpText = _model.get('localization').nextUp;
            this.nextUpClose = _model.get('localization').nextUpClose;
            this.state = 'tooltip';
            this.enabled = false;
            this.reset();
        }

        setup(context) {
            this.container = context.createElement('div');
            this.container.className = 'jw-nextup-container jw-reset';
            const element = utils.createElement(nextUpTemplate());
            this.addContent(element);

            this.closeButton = this.content.querySelector('.jw-nextup-close');
            this.closeButton.setAttribute('aria-label', this.nextUpClose);
            this.tooltip = this.content.querySelector('.jw-nextup-tooltip');

            const model = this._model;
            // Next Up is hidden until we get a valid NextUp item from the nextUp event
            this.enabled = false;

            // Events
            model.on('change:nextUp', this.onNextUp, this);

            // Listen for duration changes to determine the offset from the end for when next up should be shown
            model.change('duration', this.onDuration, this);
            // Listen for position changes so we can show the tooltip when the offset has been crossed
            model.change('position', this.onElapsed, this);

            model.change('streamType', this.onStreamType, this);
            model.change('mediaModel', this.onMediaModel, this);

            // Close button
            new UI(this.closeButton, { directSelect: true })
                .on('click tap', function() {
                    this.nextUpSticky = false;
                    this.toggle(false);
                }, this);
            // Tooltip
            new UI(this.tooltip)
                .on('click tap', this.click, this);
        }

        loadThumbnail(url) {
            this.nextUpImage = new Image();
            this.nextUpImage.onload = (function() {
                this.nextUpImage.onload = null;
            }).bind(this);
            this.nextUpImage.src = url;

            return {
                backgroundImage: 'url("' + url + '")'
            };
        }

        click() {
            this.reset();
            this._api.next();
        }

        toggle(show) {
            if (!this.enabled) {
                return;
            }
            dom.toggleClass(this.container, 'jw-nextup-sticky', !!this.nextUpSticky);
            dom.toggleClass(this.container, 'jw-nextup-container-visible', show);
            dom.toggleClass(this._playerElement, 'jw-flag-nextup', show);
        }

        setNextUpItem(nextUpItem) {
            // Give the previous item time to complete its animation
            setTimeout(() => {
                // Set thumbnail
                this.thumbnail = this.content.querySelector('.jw-nextup-thumbnail');
                dom.toggleClass(this.thumbnail, 'jw-nextup-thumbnail-visible', !!nextUpItem.image);
                if (nextUpItem.image) {
                    const thumbnailStyle = this.loadThumbnail(nextUpItem.image);
                    utils.style(this.thumbnail, thumbnailStyle);
                }

                // Set header
                this.header = this.content.querySelector('.jw-nextup-header');
                this.header.innerText = this.nextUpText;

                // Set title
                this.title = this.content.querySelector('.jw-nextup-title');
                const title = nextUpItem.title;
                this.title.innerText = title ? utils.createElement(title).textContent : '';
            }, 500);
        }

        onNextUp(model, nextUp) {
            this.reset();
            if (!nextUp) {
                return;
            }

            this.enabled = !!(nextUp.title || nextUp.image);

            if (this.enabled) {
                if (!nextUp.showNextUp) {
                    // The related plugin will countdown the nextUp item
                    this.nextUpSticky = false;
                    this.toggle(false);
                }
                this.setNextUpItem(nextUp);
            }
        }

        onDuration(model, duration) {
            if (!duration) {
                return;
            }

            // Use nextupoffset if set or default to 10 seconds from the end of playback
            let offset = utils.seconds(model.get('nextupoffset') || -10);
            if (offset < 0) {
                // Determine offset from the end. Duration may change.
                offset += duration;
            }

            this.offset = offset;
        }

        onMediaModel(model, mediaModel) {
            mediaModel.change('state', function(stateChangeMediaModel, state) {
                if (state === 'complete') {
                    this.toggle(false);
                }
            }, this);
        }

        onElapsed(model, val) {
            const nextUpSticky = this.nextUpSticky;
            if (!this.enabled || nextUpSticky === false) {
                return;
            }
            // Show nextup during VOD streams if:
            // - in playlist mode but not playing an ad
            // - autoplaying in related mode and autoplaytimer is set to 0
            const showUntilEnd = val >= this.offset;
            if (showUntilEnd && nextUpSticky === undefined) { // show if nextUpSticky is unset
                this.nextUpSticky = showUntilEnd;
                this.toggle(showUntilEnd);
            } else if (!showUntilEnd && nextUpSticky === false) { // reset if there was a backward seek
                this.reset();
            }
        }

        onStreamType(model, streamType) {
            if (streamType !== 'VOD') {
                this.nextUpSticky = false;
                this.toggle(false);
            }
        }

        element() {
            return this.container;
        }

        addContent(elem) {
            if (this.content) {
                this.removeContent();
            }
            this.content = elem;
            this.container.appendChild(elem);
        }

        removeContent() {
            if (this.content) {
                this.container.removeChild(this.content);
                this.content = null;
            }
        }

        reset() {
            this.nextUpSticky = undefined;
            this.toggle(false);
        }
    };
});
