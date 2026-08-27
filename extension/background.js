// =========================================================
// ADAPTIVE RAG - BACKGROUND
// =========================================================


// =========================================================
// DEFAULT SETTINGS
// =========================================================

const DEFAULT_SETTINGS = {

    autoAnalyze: true,

    textSize: 14,

    uiScale: 100,

    confidenceThreshold: 70,

    maxSources: 6

};


// =========================================================
// INSTALL
// =========================================================

chrome.runtime.onInstalled.addListener(
    async () => {

        try {

            const data =
                await chrome.storage.local.get([
                    "settings",
                    "analysisHistory"
                ]);


            if (!data.settings) {

                await chrome.storage.local.set({

                    settings:
                        DEFAULT_SETTINGS

                });

            }


            if (!data.analysisHistory) {

                await chrome.storage.local.set({

                    analysisHistory: []

                });

            }


            console.log(
                "Adaptive RAG installed."
            );

        }
        catch (error) {

            console.error(
                "Install error:",
                error
            );

        }

    }
);


// =========================================================
// SIDE PANEL
// =========================================================

chrome.sidePanel
    .setPanelBehavior({

        openPanelOnActionClick: true

    })
    .catch(
        console.error
    );


// =========================================================
// MESSAGE HANDLER
// =========================================================

chrome.runtime.onMessage.addListener(

    async (
        message,
        sender,
        sendResponse
    ) => {


        // -------------------------------------------------
        // AI RESPONSE DETECTED
        // -------------------------------------------------

        if (
            message.type ===
            "AI_RESPONSE_DETECTED"
        ) {

            await handleAIResponse(
                message
            );

        }


        // -------------------------------------------------
        // AUTO ANALYZE
        // -------------------------------------------------

        else if (
            message.type ===
            "AUTO_ANALYZE"
        ) {

            await analyzeResponse(

                message.answer,

                message.platform,

                message.website,

                message.url

            );

        }


        // -------------------------------------------------
        // MANUAL ANALYZE
        // -------------------------------------------------

        else if (
            message.type ===
            "MANUAL_ANALYZE"
        ) {

            await analyzeResponse(

                message.answer,

                message.platform,

                message.website,

                message.url

            );

        }


        // -------------------------------------------------
        // GET LATEST DATA
        // -------------------------------------------------

        else if (
            message.type ===
            "GET_LATEST_DATA"
        ) {

            const data =
                await chrome.storage.local.get([

                    "latestAnswer",

                    "latestResult",

                    "platform",

                    "sourceWebsite",

                    "sourceURL",

                    "analysisHistory"

                ]);


            sendResponse({

                success: true,

                data: data

            });

        }


        // -------------------------------------------------
        // CLEAR HISTORY
        // -------------------------------------------------

        else if (
            message.type ===
            "CLEAR_HISTORY"
        ) {

            await chrome.storage.local.set({

                analysisHistory: []

            });


            chrome.runtime.sendMessage({

                type:
                    "HISTORY_CLEARED"

            }).catch(
                () => {}
            );

        }

    }

);


// =========================================================
// HANDLE AI RESPONSE
// =========================================================

async function handleAIResponse(
    message
) {

    try {

        const answer =
            message.answer || "";


        const platform =
            message.platform || "AI";


        const website =
            message.website || "";


        const url =
            message.url || "";


        // -------------------------------------------------
        // SAVE
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
        // UPDATE SIDEPANEL
        // -------------------------------------------------

        chrome.runtime.sendMessage({

            type:
                "NEW_AI_RESPONSE",

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


    }
    catch (error) {

        console.error(
            "Response handling error:",
            error
        );

    }

}


// =========================================================
// ANALYZE RESPONSE
// =========================================================

async function analyzeResponse(

    answer,

    platform,

    website = "",

    url = ""

) {

    try {

        if (
            !answer ||
            answer.trim().length < 10
        ) {

            return;

        }


        // -------------------------------------------------
        // ANALYSIS STARTED
        // -------------------------------------------------

        chrome.runtime.sendMessage({

            type:
                "ANALYSIS_STARTED",

            platform:
                platform

        }).catch(
            () => {}
        );


        // -------------------------------------------------
        // BACKEND
        // -------------------------------------------------

        const response =
            await fetch(

                "http://127.0.0.1:8000/analyze",

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            answer:
                                answer,

                            platform:
                                platform,

                            website:
                                website,

                            url:
                                url

                        })

                }

            );


        if (!response.ok) {

            throw new Error(

                `Backend returned ${response.status}`

            );

        }


        const result =
            await response.json();


        // -------------------------------------------------
        // SAVE LATEST RESULT
        // -------------------------------------------------

        await chrome.storage.local.set({

            latestResult:
                result

        });


        // -------------------------------------------------
        // HISTORY
        // -------------------------------------------------

        const data =
            await chrome.storage.local.get([
                "analysisHistory"
            ]);


        const history =
            data.analysisHistory || [];


        const historyEntry = {

            id:
                "analysis_" +
                Date.now(),

            timestamp:
                new Date().toISOString(),

            platform:
                platform,

            website:
                website,

            url:
                url,

            answer:
                answer,

            result:
                result

        };


        history.unshift(
            historyEntry
        );


        await chrome.storage.local.set({

            analysisHistory:
                history.slice(
                    0,
                    50
                )

        });


        // -------------------------------------------------
        // SEND RESULT
        // -------------------------------------------------

        chrome.runtime.sendMessage({

            type:
                "ANALYSIS_COMPLETE",

            result:
                result,

            platform:
                platform

        }).catch(
            () => {}
        );

    }
    catch (error) {

        console.error(
            "Analysis failed:",
            error
        );


        chrome.runtime.sendMessage({

            type:
                "ANALYSIS_ERROR",

            error:
                error.message

        }).catch(
            () => {}
        );

    }

}