console.log("Fetchextra content script loaded");

function initializeListener() {
    console.log("Listener initiated");
    if (window.location.hash === "#/scheduling/scheduled-visits") {
        chrome.runtime.onMessage.addListener((message) => {
            console.log(`Message received: ${message}`);

            if (document.evaluate(`//span[text()="New Filters"]`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue) {
                document.evaluate(`//a[text()="${message[0].toString()}"]`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.parentElement.parentElement.querySelector(".datatable-column___facility").firstChild.innerText = message[1];
                document.evaluate(`//a[text()="${message[0].toString()}"]`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.innerText = message[2];
            } else {
                document.evaluate(`//a[text()="${message[0].toString()}"]`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.parentElement.parentElement.children[3].firstElementChild.innerText = message[1];
                document.evaluate(`//a[text()="${message[0].toString()}"]`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.parentElement.parentElement.children[3].firstElementChild.style.overflow = "visible";
                document.evaluate(`//a[text()="${message[0].toString()}"]`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.innerText = message[2];
            }

            return Promise.resolve();
        });
    }

    if (window.location.hash.startsWith("#/employees/")) {
        chrome.runtime.onMessage.addListener((message) => {
            console.log(`Employee message received: ${message}`);

            function waitForElement(xpath, callback, maxAttempts = 20, interval = 500) {
                let attempts = 0;
                const timer = setInterval(() => {
                    const node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (node) {
                        clearInterval(timer);
                        callback(node);
                    } else if (++attempts >= maxAttempts) {
                        clearInterval(timer);
                        console.warn("Element not found for message update.");
                    }
                }, interval);
            }

            const targetXPath = `//*[@id="content"]/div[1]/div/div/section/div[1]/div/div/div[3]/ul/li[3]/span`;

            waitForElement(targetXPath, (node) => {
                console.log("element now exists. adding ", message)
                node.innerText = message;
            });

            return Promise.resolve();
        });
    }
};
 
 window.addEventListener("load", initializeListener);

 window.addEventListener("hashchange", initializeListener);