(function () {
  if (document.getElementById("overleaf-local-save-icon")) return;

  // Create the icon container
  const iconContainer = document.createElement("div");
  iconContainer.id = "overleaf-local-save-icon";
  iconContainer.style.position = "absolute";
  iconContainer.style.top = "25px";
  iconContainer.style.right = "10px";
  iconContainer.style.zIndex = "9999";
  iconContainer.style.cursor = "pointer";

  // Create the image element for the icon
  const saveIcon = document.createElement("img");
  saveIcon.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAAXNSR0IArs4c6QAACaZJREFUWIWdWHtQE3ce/+2SBAgQcAglQlawCCJUKlVbj2IFH4OjCHigBFDwDSnTUzveXVFv8A6wgO2dgNBqHZEIjo+pnRFG0NY3iHpqD8RkrgIJhmcwCCSAkmR/90fIZnezWeh9JzPZ/X1fn+/j99gfAiEEtgQBQKYfo41MTk7K5XK5/IVSqVSr1QMD/Vrt0NiYfnx8fGJ8wgRxBAAul+vq6urszBcIBCJvb2+RSIxhAe8HhIWFYRiGIAjCDGgmAM0MCOVy+fXrDffu3WttbTEYDAiC2Neza8dkMgmFwt2793Bm5hexZY2NjdXUVJ8/X9Pe3o6iKAAQQISCBtizZhMVAA4ODpGRy3ft2o1ACFnitzJIj0ajUSaTHT/+z+HhYdZomNUZ3EC4ffuOI0f+jqLoDEtmpf7+PqlU+uTJvy3J+B1eZ83yWLxkqV6nb2t7PjY2Roxv3ZpeUHDUbJAdEOFh6qGzsyMlRdLX18cqTCEOh/PRR4ujo6MXL16iUMirqqo6O9oBghAKcXHxJSWlDg4O5vffkaGRkZHY2PVdXarp8QPA4XAjIyPWr9+wevUaCGFl5Zma6nNDb97QNCIiPpXJZDyeozUAVtOUoI8eLaChgbRuRwAAICQkZPNmSdyGDUIvr86OzmPHiq9cufL27YStgwULQk6d+oGMhlYythbo7+9ftuxjHDcBgNBxAAAAcHJy2rAhLiM9Y2FYGIIgCoWioqK8rq7WZDIxBuvn53f58o8ikYjGJWeICY3Fb21dLY7jJDmrsEAg2LZte0bGNi+hF0CAQqE4XvKv6w0NhDyNEADEYuz8+Qsikci8WEDEao7Dmhor49nTJ7agBQLBzp27duzY6e7uDgBQqVTffvtNXd1VkwmnqZMpKGi+THbOx8eHAEgW4thLDU22v3+AzOBwuGlb0vbt3e/p6Wnu97Ky0rNnKycnJ6m5oMYHwbp164qPfeMuEFhlILDJECvp9fqystLnz1stRmF4ePjXXxeFhoaau6+urvbIkVyNRsNiBELo6yvOyfkqLi6BuppDACjvdqa9Jdn37t79Kuev3d3d5mEez3Hfvn1ZWVIOxxqJWq2++cvPjU1NLS3/GRgYwHEcRVGzAZPJ5ObmFh4enpi4KTY21snJcdpN2+7WYTAYiooKT5/+Acdxs5K/v39ZWcWHH4YBAIaH31RXVw8Pj3h6zsIwv5AFC/z8/QEAQ0NDavWr16+1BoOBx+P5+fmJxWI+n8/onnmvYczQ8PCwVJrZ1NRkSTiIiooqP1EucHcHADQ0NBw+fEijsXYVhFAo9IqIiFi7du2qVav5fD7TQjbd5mLNEJX6+vq2bt3y22//JaxIJKkFBUe5XK7BYMzP/0dl5Rl75iCEHh4eycmSPbv3vOf9Hvs2x7ie0QFpNJqkpD+qVCrCQXp6Rl5ePoqiOt1oVlbm/fv37cQLyWsm35mfmSXNzs7m8Xg0QfYsUQDp9fqkpES5/MWUEoTxCRtLSkpRFB0aGkpLS3nx4oV9UwzOgucvKK+oCAwMZNciK1sB4TgulWbV118jBBYtCr906bKTk9Po6KhEsrmtrW1Gdqm4XF1dv/vu5IoVK+gSEGFqaRIgmazq0OGDU1IQuAncGhpuYBhmMBgyMtIbG+/jOB4cHLxs2R9CQkJEotk8Hs9gMGg0A3K54uHDB3K5nH5ctBCXyz116vSqVatmFgyEEIc9PT1BQfMwzNf8E2M+1dXnIIQQwtzc3ICAuQcP5rx8+RLHcThFxAOEEOI4rlQqDx8+FBAwlzBiMeWLYb5BQfOePXsGZ0DA/Jed/TnZSkzMGqPRCCG8c+dOWlqqWq2eiS0IYVdXV0qKBMN8qLB8MMz3k0+WjoyMTGsBBQAoFIra2qvknO3f/yXq4PDu3TutVnvuXLVYLCbVmY3mzJlTU3NeKs2e6oQpcQQA0NvbW1CQT+kYeleBqVl24MCXly5dIuYtJsbu3r3H5XLNmwC54xhrzsgoKio8caKM1lUIgvxy82bgvCAWdVSv11+7do2IAwFg/fpYLpcLALCiAZDtRMCUtwN//kt09Eo6dggryiuownS7aGNjo06vI+tERUUxemUhgk04Q1G0sLCIy+XRJBsa6nWjoyRheizogwdNCEDIw4sWLWJ3b4egBdnUg4+PT2JiIk1IP6Zvbm4mCdtkqK2tzVoQCEQikYuLi6XDgPXBHgQrIURfEkOJSUmWwwIhhDx9+oSlH9HubjXZppubAJCPijbLKRUCFZeN8AehH7i4uNDct7e3sxhE9Xo9uZxGo5F5brMkyj5kPp8vFAppg1rtaybZKQeoyYRbIkPMX8o4TqoTJC8ldrExtqd5njs6OtJEqeduUnrNgFxc+GT5iYmJ9vZ2q3umkhGdSx1hSJTJZBqlzCkAECCwnvAt9yokQr29iU81aI7pxo3r0y/JNgdBRtJqtYODgzSF2bN9KELUQNCQkBAa2IsXL05OTs7sZofRppVu3bpJ3UMAgCA0NJQlCDQy8jPrGQ0BAACVSnnhwgVbUUj5YyYyE0JQVXXWlhW5/DOmICxNvXJltIuLK9kQgiDFxYU9PT00DYTyx0zkJfunn65YznSQ6MX5wcHzg4JYVFF3d/eEhI005ujoqFSaOT4+zuaclZSdHbm5f7NsrtYg0tMzSFskEy4IYXd398qVUW/fvqXxoqOjv//+lLOzM2C4oGG7wOvp6d6cnKx+1UXWggDMwbDbt+7yHHl0BWCVQQEAYrH4iy/+RNskIAC3b9+WSJLV5s9WesGYVgMIAACPHz9OSIhXv+oyV4q8meTl5RNo7JgAqNm5VPr50iUf03gAgF9/fbY2Zs3JkycnJiYsOO2SRqPJOZiTnLxpYGCAsEF4TU/PsD2Q2DgkHfIHBwc3bkzoetXF2LWeQs+kxE0xMTELF4bRFl+dTvfo0cPa2tr6+mu2dTfXJTJy+dmzVTwe/TTCgMsMyKzW09OTmipRKpVka+RKQwgdHZ38/f08PYWOjrzxsfG+/r7e3l6j0YggdmdgRMSnZ85UUr7wSVhp7/TLhiGtNjMr8+GjZtZtngGrPWfJkpT8vHxLUv+vb3uj0VhefqK0tMRgMFjt237XTUfu7h55efnx8fGkk/X0l9p2r4WVSmVxcWF9fb0Jx1mRQNtrUB6Pt2XL1r17983ymDWzW3X7gGhqKpVKJqu6evVqf38fsaDZW4twHJ879/2kpKTU1DQvLy9W9DajJED4tNBxHG9tbW1uftDS0tLR0TE4qNHpdDiOczhcgUAwe7Zo3rzAsLCwyMjlgYGB9j6omdHZDP4PIfn2USPDPCEAAAAASUVORK5CYII=";
  saveIcon.alt = "Save Locally";
  saveIcon.style.width = "20px";
  saveIcon.style.height = "20px";
  saveIcon.style.transition = "transform 0.3s ease, opacity 0.3s ease";

  // Create the tooltip element
  const tooltip = document.createElement("div");
  tooltip.textContent = "Save Locally?";
  tooltip.style.position = "absolute";
  tooltip.style.top = "30px"; // Adjust position
  tooltip.style.right = "40px"; // Keep it near the icon
  tooltip.style.backgroundColor = "#222";
  tooltip.style.color = "#fff";
  tooltip.style.fontSize = "12px";
  tooltip.style.padding = "6px 12px";
  tooltip.style.borderRadius = "8px";
  tooltip.style.visibility = "hidden";
  tooltip.style.opacity = "0";
  tooltip.style.transition = "opacity 0.3s ease";

  // Add the tooltip to the icon container
  iconContainer.appendChild(tooltip);

  // Event listeners for showing and hiding the tooltip
  saveIcon.addEventListener("mouseenter", () => {
    tooltip.style.visibility = "visible";
    tooltip.style.opacity = "1";
    saveIcon.style.transform = "scale(1.1)"; // Slightly enlarge the icon
  });

  saveIcon.addEventListener("mouseleave", () => {
    tooltip.style.visibility = "hidden";
    tooltip.style.opacity = "0";
    saveIcon.style.transform = "scale(1)"; // Reset the icon size
  });

  // Add the icon to the page
  iconContainer.appendChild(saveIcon);
  document.body.appendChild(iconContainer);

  // Function to extract the project ID from the URL
  function getProjectIdFromUrl(url) {
    const match = url && url.match(/https:\/\/www\.overleaf\.com\/project\/([\w-]+)/);
    return match ? match[1] : null;
  }

  // Handling project-specific state
  const projectId = getProjectIdFromUrl(window.location.href);
  const projectName = "Unnamed";

  if (projectId && projectName) {
    chrome.storage.local.get(["projectStates"], (data) => {
      const projectStates = data.projectStates || {};
      const isSavingEnabled = projectStates[projectId] ? projectStates[projectId].state : false;

      if (isSavingEnabled) {
        saveIcon.style.opacity = "1";
      } else {
        saveIcon.style.opacity = "0.5";
      }
    });

    saveIcon.addEventListener("click", () => {
      chrome.storage.local.get(["projectStates"], (data) => {
        const projectStates = data.projectStates || {};
        const isSavingEnabled = projectStates[projectId] ? projectStates[projectId].state : false;
        const newState = !isSavingEnabled;
        
        projectStates[projectId] = { name: projectName, state: newState };

        chrome.storage.local.set({ projectStates }, () => {
          saveIcon.style.opacity = newState ? "1" : "0.5";
        });
      });
    });
  } else {
    console.error("Project ID or Project Name not found.");
  }
})();
