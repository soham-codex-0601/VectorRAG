let lastDetectedAnswer = "";

let analysisTimer = null;


// =========================================================
// CLEAN TEXT
// =========================================================

function cleanText(text) {

    if (!text) {
        return "";
    }

    return text
        .replace(/\s+/g, " ")
        .trim();

}


// =========================================================
// PLATFORM DETECTION
// =========================================================

function getPlatform() {

    const host =
        window.location.hostname.toLowerCase();


    if (
        host.includes("chatgpt") ||
        host.includes("openai")
    ) {
        return "ChatGPT";
    }


    if (
        host.includes("gemini")
    ) {
        return "Gemini";
    }


    if (
        host.includes("claude")
    ) {
        return "Claude";
    }


    if (
        host.includes("copilot")
    ) {
        return "Copilot";
    }


    return "AI";

}


// =========================================================
// CHATGPT
// =========================================================

function readChatGPT() {

    const elements =
        document.querySelectorAll(
            '[data-message-author-role="assistant"]'
        );


    if (!elements.length) {
        return "";
    }


    const lastElement =
        elements[
            elements.length - 1
        ];


    return cleanText(
        lastElement.innerText
    );

}


// =========================================================
// GEMINI
// =========================================================

function readGemini() {

    const selectors = [

        ".model-response-text",

        "message-content",

        ".markdown-main-panel",

        ".response-content",

        "[data-message-content]"

    ];


    for (
        const selector of selectors
    ) {

        const elements =
            document.querySelectorAll(
                selector
            );


        if (!elements.length) {
            continue;
        }


        const lastElement =
            elements[
                elements.length - 1
            ];


        const text =
            cleanText(
                lastElement.innerText
            );


        if (text.length >= 50) {
            return text;
        }

    }


    return "";

}


// =========================================================
// CLAUDE
// =========================================================

function readClaude() {

    const selectors = [

        '[data-is-streaming]',

        ".font-claude-message",

        '[class*="prose"]',

        '[class*="message-content"]'

    ];


    for (
        const selector of selectors
    ) {

        const elements =
            document.querySelectorAll(
                selector
            );


        if (!elements.length) {
            continue;
        }


        const lastElement =
            elements[
                elements.length - 1
            ];


        const text =
            cleanText(
                lastElement.innerText
            );


        if (text.length >= 50) {
            return text;
        }

    }


    return "";

}


// =========================================================
// COPILOT
// =========================================================

function readCopilot() {

    const selectors = [

        '[data-content="ai-message"]',

        '[class*="response"]',

        '[class*="message"]',

        '[class*="prose"]',

        '[class*="markdown"]'

    ];


    for (
        const selector of selectors
    ) {

        const elements =
            document.querySelectorAll(
                selector
            );


        if (!elements.length) {
            continue;
        }


        const lastElement =
            elements[
                elements.length - 1
            ];


        const text =
            cleanText(
                lastElement.innerText
            );


        if (text.length >= 50) {
            return text;
        }

    }


    return "";

}


// =========================================================
// GENERIC AI
// =========================================================

function readGenericAI() {

    const selectors = [

        '[data-message-author-role="assistant"]',

        ".model-response-text",

        ".markdown",

        ".prose",

        ".response-content",

        '[class*="assistant"]',

        '[class*="response"]'

    ];


    for (
        const selector of selectors
    ) {

        const elements =
            document.querySelectorAll(
                selector
            );


        if (!elements.length) {
            continue;
        }


        const lastElement =
            elements[
                elements.length - 1
            ];


        const text =
            cleanText(
                lastElement.innerText
            );


        if (text.length >= 50) {
            return text;
        }

    }


    return "";

}


// =========================================================
// READ RESPONSE
// =========================================================

function readCurrentAIResponse(
    platform
) {

    switch (platform) {

        case "ChatGPT":

            return readChatGPT();


        case "Gemini":

            return readGemini();


        case "Claude":

            return readClaude();


        case "Copilot":

            return readCopilot();


        default:

            return readGenericAI();

    }

}


// =========================================================
// DETECT AI RESPONSE
// =========================================================

async function detectAIResponse() {

    try {

        const platform =
            getPlatform();


        const answer =
            readCurrentAIResponse(
                platform
            );


        if (
            !answer ||
            answer.length < 50
        ) {
            return;
        }


        if (
            answer ===
            lastDetectedAnswer
        ) {
            return;
        }


        lastDetectedAnswer =
            answer;


        const website =
            window.location.hostname;


        const url =
            window.location.href;


        // -------------------------------------------------
        // SAVE CURRENT RESPONSE
        // -------------------------------------------------

        await chrome.storage.local.set({

            latestAnswer:
                answer,

            platform:
                platform,

            sourceWebsite:
                website,

            sourceURL:
                url,

            detectedAt:
                new Date().toISOString()

        });


        // -------------------------------------------------
        // SEND TO BACKGROUND
        // -------------------------------------------------

        chrome.runtime.sendMessage({

            type:
                "AI_RESPONSE_DETECTED",

            answer:
                answer,

            platform:
                platform,

            website:
                website,

            url:
                url,

            timestamp:
                new Date().toISOString()

        }).catch(
            () => {}
        );


        // -------------------------------------------------
        // AUTO ANALYSIS
        // -------------------------------------------------

        const data =
            await chrome.storage.local.get([
                "settings"
            ]);


        const settings =
            data.settings || {};


        if (
            settings.autoAnalyze === true
        ) {

            clearTimeout(
                analysisTimer
            );


            analysisTimer =
                setTimeout(
                    () => {

                        chrome.runtime.sendMessage({

                            type:
                                "AUTO_ANALYZE",

                            answer:
                                answer,

                            platform:
                                platform,

                            website:
                                website,

                            url:
                                url

                        }).catch(
                            () => {}
                        );

                    },
                    1500
                );

        }

    }
    catch (error) {

        console.error(
            "Adaptive RAG detection error:",
            error
        );

    }

}


// =========================================================
// MUTATION OBSERVER
// =========================================================

const observer =
    new MutationObserver(
        () => {

            clearTimeout(
                window.__ragTimer
            );


            window.__ragTimer =
                setTimeout(
                    detectAIResponse,
                    800
                );

        }
    );


// =========================================================
// START OBSERVER
// =========================================================

function startObserver() {

    if (!document.body) {

        setTimeout(
            startObserver,
            500
        );

        return;

    }


    observer.observe(
        document.body,
        {

            childList: true,

            subtree: true

        }
    );


    setTimeout(
        detectAIResponse,
        1500
    );

}


startObserver();