// ==============================
// Convert Overleaf Template to Extension Template
// ==============================

(() => {
    function waitForToolbarAndInsertIcon(projectId, isSavingEnabled) {
        const tryInsert = () => {
            const container = document.querySelector(
            "#panel-source-editor > div > div > div.cm-scroller > div.review-mode-switcher-container"
            );
            const toolbar = document.querySelector(
            "#ol-cm-toolbar-wrapper > div > div.ol-cm-toolbar-button-group.ol-cm-toolbar-end"
            );
            if (toolbar && container) {
            createSaveIcon(projectId, isSavingEnabled);
            displaceReview(container, toolbar);
            return true;
            }
            return false;
        };

        if (!tryInsert()) {
            let lastRun = 0;
            const MIN_INTERVAL = 5000; // 5s

            const observer = new MutationObserver(() => {
                const now = Date.now();
                if (now - lastRun < MIN_INTERVAL) return; // skip
                lastRun = now;
                if (tryInsert()) observer.disconnect();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    function displaceReview(container, toolbar) {
        const clonedContainer = container.cloneNode(true);
        clonedContainer.id = "CLONE";
        const gap = document.createElement('div');
        gap.style.width = '16px';
        gap.style.display = 'inline-block';
        gap.style.flexShrink = '0';
        
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexShrink = '0';
        div.width = "auto"
        div.id = 'DISPLACED';
        div.appendChild(gap);
        div.appendChild(clonedContainer);
        toolbar.appendChild(div);

        let dropdown = container.querySelector("div > div");
        const OGBUTTON = dropdown.querySelector("button")?.cloneNode(true);
        const button = updateContainer(dropdown);

        let lastRun = 0;
        const MIN_INTERVAL = 5000; // 5s

        const observer = new MutationObserver(() => {
            const now = Date.now();
            if (now - lastRun < MIN_INTERVAL) return; // skip
            lastRun = now;
            dropdown.querySelector("button").style.cssText = OGBUTTON.style.cssText;
            updateContainer(dropdown);
        });

        observer.observe(button, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
})();