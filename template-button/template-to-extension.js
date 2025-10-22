// ==============================
// Convert Overleaf Template to Extension Template
// ==============================

(() => {
    function debounce(fn, delay) {
        let timer = null;
        return function (...args) {
          clearTimeout(timer);
          timer = setTimeout(() => fn(...args), delay);
        };
      }

    function waitForToolbarAndInsertIcon(projectId, isSavingEnabled) {
        const tryInsert = () => {
          const container = document.querySelector(
            "#panel-source-editor > div > div > div.cm-scroller > div.review-mode-switcher-container"
          );
          const toolbar = document.querySelector(
            "#ol-cm-toolbar-wrapper > div.ol-cm-toolbar.toolbar-editor > div.ol-cm-toolbar-button-group.ol-cm-toolbar-end"
          );
          if (toolbar && container) {
            createSaveIcon(projectId, isSavingEnabled);
            displaceReview(container, toolbar);
            return true;
          }
          return false;
        };
      
        const init = () => {
          if (tryInsert()) return;
      
          const observer = new MutationObserver(() => {
            if (tryInsert()) {
              observer.disconnect();
              console.log(`[Inserted] Save icon for project ${projectId}`);
            }
          });
      
          observer.observe(document.body, { childList: true, subtree: true });
        };
      
        // Ensure document.body is ready
        if (document.body) {
          init();
        } else {
          // Defer until DOM is ready
          window.addEventListener("DOMContentLoaded", init);
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

        const observer = new MutationObserver(
            debounce(() => {
              dropdown.querySelector("button").style.cssText = OGBUTTON.style.cssText;
              updateContainer(dropdown);
            }, 300)
          );

        observer.observe(button, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
})();