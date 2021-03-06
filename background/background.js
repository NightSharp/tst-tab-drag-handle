/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from '/common/common.js';

const TST_ID = 'treestyletab@piro.sakura.ne.jp';

// pointer-events is not transitionable, so we use animation.
const ANIMATION = `
  @keyframes delay-pointer-events {
      0%   { pointer-events: none; }
      99%  { pointer-events: none; }
      100% { pointer-events: auto; }
  }
`;

function getStyle() {
  const base = `moz-extension://${location.host}`;
  const showDelay = Math.max(0, configs.showDelay);
  const hideDelay = Math.max(0, configs.hideDelay);
  return `
    ::part(%EXTRA_CONTENTS_PART% container) {
      bottom: 0;
      direction: ltr;
      left: 0;
      line-height: 1;
      overflow: hidden;
      position: absolute;
      text-align: left;
      z-index: 2000;
      --handle-size: ${configs.size}px;
      --handle-icon-size: calc(${configs.size}px / 1.5);
    }

    ::part(%EXTRA_CONTENTS_PART% handles) {
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--collapse-animation) ${hideDelay}ms;
    }

    .extra-items-container.front:hover::part(%EXTRA_CONTENTS_PART% handles) {
      animation: delay-pointer-events calc(var(--collapse-duration) + ${showDelay}ms) linear;
      opacity: 1;
      pointer-events: auto;
      transition: opacity var(--collapse-animation) ${showDelay}ms;
    }

    tab-item.dragging .extra-items-container.front:hover::part(%EXTRA_CONTENTS_PART% handles) {
      opacity: 0;
      transition: opacity var(--collapse-animation);
    }

    ::part(%EXTRA_CONTENTS_PART% handle) {
      background: var(--tab-like-surface, var(--bg-color));
      border: 1px solid var(--tab-border);
      display: table-cell;
      height: var(--handle-icon-size);
      min-height: var(--handle-icon-size);
      min-width: var(--handle-icon-size);
      opacity: 0.75;
      text-align: center;
      transition: border-color var(--collapse-animation),
                  opacity var(--collapse-animation);
      vertical-align: middle;
      width: var(--handle-icon-size);
    }

    ::part(%EXTRA_CONTENTS_PART% handle following) {
      margin-left: -1px;
    }

    ::part(%EXTRA_CONTENTS_PART% handle-image) {
      -moz-context-properties: fill;
      background: var(--tab-text);
      display: inline-block;
      height: var(--handle-icon-size);
      line-height: 1;
      margin: calc((var(--handle-size) - var(--handle-icon-size)) / 2);
      max-height: var(--handle-icon-size);
      max-width: var(--handle-icon-size);
      width: var(--handle-icon-size);
    }

    ::part(%EXTRA_CONTENTS_PART% handle-image detach-tree) {
      mask: url("${base}/resources/detach-tree.svg") no-repeat center / 100%;
    }

    ::part(%EXTRA_CONTENTS_PART% handle-image bookmark-tree) {
      mask: url("${base}/resources/bookmark-tree.svg") no-repeat center / 100%;
    }

    ::part(%EXTRA_CONTENTS_PART% handle-image detach-solo) {
      mask: url("${base}/resources/detach-solo.svg") no-repeat center / 100%;
    }

    ::part(%EXTRA_CONTENTS_PART% handle-image bookmark-solo) {
      mask: url("${base}/resources/bookmark-solo.svg") no-repeat center / 100%;
    }

    tab-item:not([data-child-ids]) ::part(%EXTRA_CONTENTS_PART% handle detach-tree),
    tab-item:not([data-child-ids]) ::part(%EXTRA_CONTENTS_PART% handle bookmark-tree) {
      display: none;
    }

    ::part(%EXTRA_CONTENTS_PART% handle):hover {
      border-color: var(--tab-text);
      opacity: 1;
    }
  `;
}

async function registerToTST() {
  try {
    await browser.runtime.sendMessage(TST_ID, {
      type: 'register-self' ,
      name: browser.i18n.getMessage('extensionName'),
      //icons: browser.runtime.getManifest().icons,
      listeningTypes: [
        'sidebar-show'
      ],
      style: getStyle()
    });
    tryReset();
  }
  catch(_error) {
    // TST is not available
  }
}
configs.$loaded.then(registerToTST);

configs.$addObserver(key => {
  switch (key) {
    case 'size':
    case 'showDelay':
    case 'hideDelay':
      registerToTST();
      return;
    case 'handleDetachTree':
    case 'handleBookmarkTree':
    case 'handleDetachSolo':
    case 'handleBookmarkSolo':
      tryReset();
      return;
  }
});

browser.runtime.onMessageExternal.addListener((message, sender) => {
  switch (sender.id) {
    case TST_ID:
      switch (message.type) {
        case 'ready':
          registerToTST();
          break;

        case 'sidebar-show':
          browser.tabs.query({ windowId: message.windowId }).then(tabs => {
            for (const tab of tabs) {
              insertHandle(tab.id);
            }
          });
          break;
      }
      break;
  }
});

browser.tabs.onCreated.addListener(tab => {
  insertHandle(tab.id);
});

function tryReset() {
  if (tryReset.reserved)
    clearTimeout(tryReset.reserved);
  tryReset.reserved = setTimeout(() => {
    tryReset.reserved = null;
    browser.tabs.query({}).then(tabs => {
      for (const tab of tabs) {
        insertHandle(tab.id);
      }
    });
  }, 100);
}
tryReset.reserved = null;

function insertHandle(tabId) {
  const handleDetachTree = configs.handleDetachTree ? `
    <span id="handle-detach-tree"
         part="handle detach-tree"
         draggable="true"
         data-drag-data='{
           "type": "tab",
           "data": {
             "id":          ${tabId},
             "asTree":      true,
             "allowDetach": true,
             "allowLink":   false
           }
         }'
         title="${sanitizeForHTML(browser.i18n.getMessage('tooltip_detach_tree'))}"
      ><span part="handle-image detach-tree"></span></span>
  `.trim() : '';
  const handleBookmarkTree = configs.handleBookmarkTree ? `
    <span id="handle-bookmark-tree"
         part="handle bookmark-tree following"
         draggable="true"
         data-drag-data='{
           "type": "tab",
           "data": {
             "id":          ${tabId},
             "asTree":      true,
             "allowDetach": false,
             "allowLink":   true
           }
         }'
         title="${sanitizeForHTML(browser.i18n.getMessage('tooltip_bookmark_tree'))}"
      ><span part="handle-image bookmark-tree"></span></span>
  `.trim() : '';
  const handleDetachSolo = configs.handleDetachSolo ? `
    <span id="handle-detach-solo"
         part="handle detach-solo following"
         draggable="true"
         data-drag-data='{
           "type": "tab",
           "data": {
             "id":          ${tabId},
             "asTree":      false,
             "allowDetach": true,
             "allowLink":   false
           }
         }'
         title="${sanitizeForHTML(browser.i18n.getMessage('tooltip_detach_solo'))}"
      ><span part="handle-image detach-solo"></span></span>
  `.trim() : '';
  const handleBookmarkSolo = configs.handleBookmarkSolo ? `
    <span id="handle-bookmark-solo"
         part="handle bookmark-solo following"
         draggable="true"
         data-drag-data='{
           "type": "tab",
           "data": {
             "id":          ${tabId},
             "asTree":      false,
             "allowDetach": false,
             "allowLink":   true
           }
         }'
         title="${sanitizeForHTML(browser.i18n.getMessage('tooltip_bookmark_solo'))}"
      ><span part="handle-image bookmark-solo"></span></span>
  `.trim() : '';
  browser.runtime.sendMessage(TST_ID, {
    type:      'set-extra-tab-contents',
    id:        tabId,
    style:     ANIMATION, // Gecko doesn't apply animation defined in the owner document to shadow DOM elements...
    contents: [
      '<span id="handlers" part="handles">',
      handleDetachTree,
      handleBookmarkTree,
      handleDetachSolo,
      handleBookmarkSolo,
      '</span>'
    ].join('')
  });
}

function sanitizeForHTML(string) {
  return string.replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
