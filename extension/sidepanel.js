// =========================================================
// ELEMENTS
// =========================================================

const platformElement =
    document.getElementById(
        "platform"
    );

const responseElement =
    document.getElementById(
        "response"
    );

const statusElement =
    document.getElementById(
        "status"
    );

const analyzeButton =
    document.getElementById(
        "analyzeBtn"
    );

const scoreElement =
    document.getElementById(
        "score"
    );

const scoreFill =
    document.getElementById(
        "scoreFill"
    );

const scoreLabel =
    document.getElementById(
        "scoreLabel"
    );

const claimsElement =
    document.getElementById(
        "claims"
    );

const sourcesElement =
    document.getElementById(
        "sources"
    );

const historyElement =
    document.getElementById(
        "history"
    );

const clearHistoryButton =
    document.getElementById(
        "clearHistory"
    );


// =========================================================
// CURRENT DATA
// =========================================================

let currentAnswer = "";

let currentPlatform = "";

let currentWebsite = "";

let currentURL = "";


// =========================================================
// LOAD DATA
// =========================================================

async function loadData() {

    const data =
        await chrome.storage.local.get([

            "latestAnswer",

            "latestResult",

            "platform",

            "sourceWebsite",

            "sourceURL",

            "analysisHistory"

        ]);


    if (data.latestAnswer) {

        showResponse(

            data.latestAnswer,

            data.platform,

            data.sourceWebsite,

            data.sourceURL

        );

    }


    if (data.latestResult) {

        renderResult(
            data.latestResult
        );

    }


    renderHistory(
        data.analysisHistory || []
    );

}


// =========================================================
// SHOW RESPONSE
// =========================================================

function showResponse(

    answer,

    aiPlatform,

    website = "",

    url = ""

) {

    currentAnswer =
        answer || "";


    currentPlatform =
        aiPlatform || "AI";


    currentWebsite =
        website || "";


    currentURL =
        url || "";


    // -----------------------------
    // PLATFORM NAME
    // -----------------------------

    platformElement.textContent =
        currentPlatform;


    // -----------------------------
    // RESPONSE
    // -----------------------------

    responseElement.textContent =
        currentAnswer;


    // -----------------------------
    // STATUS
    // -----------------------------

    statusElement.classList.add(
        "active"
    );

}


// =========================================================
// ANALYZE BUTTON
// =========================================================

analyzeButton.addEventListener(
    "click",
    async () => {

        if (
            !currentAnswer ||
            currentAnswer.length < 10
        ) {

            return;

        }


        analyzeButton.disabled =
            true;


        analyzeButton.textContent =
            "Analyzing...";


        // Reset old result

        scoreElement.textContent =
            "--";


        scoreLabel.textContent =
            "Analyzing";


        scoreFill.style.width =
            "0%";


        chrome.runtime.sendMessage({

            type:
                "MANUAL_ANALYZE",

            answer:
                currentAnswer,

            platform:
                currentPlatform,

            website:
                currentWebsite,

            url:
                currentURL

        });


        // Button will be restored
        // when analysis completes.

    }
);


// =========================================================
// ANALYSIS STARTED
// =========================================================

function analysisStarted() {

    analyzeButton.disabled =
        true;


    analyzeButton.textContent =
        "Analyzing...";


    scoreLabel.textContent =
        "Analyzing";

}


// =========================================================
// ANALYSIS COMPLETE
// =========================================================

function analysisComplete(
    result
) {

    analyzeButton.disabled =
        false;


    analyzeButton.textContent =
        "✦ Analyze Response";


    renderResult(
        result
    );


    loadHistory();

}


// =========================================================
// ANALYSIS ERROR
// =========================================================

function analysisError(
    error
) {

    analyzeButton.disabled =
        false;


    analyzeButton.textContent =
        "✦ Analyze Response";


    scoreElement.textContent =
        "--";


    scoreLabel.textContent =
        "Backend Error";


    claimsElement.innerHTML = `

        <div class="empty">

            ${escapeHTML(
                error || "Analysis failed."
            )}

        </div>

    `;

}


// =========================================================
// RENDER RESULT
// =========================================================

function renderResult(
    result
) {

    if (!result) {
        return;
    }


    // -------------------------------------------------
    // RELIABILITY
    // -------------------------------------------------

    let reliability =
        result.reliability;


    if (
        reliability === undefined
    ) {

        reliability =
            result.score;

    }


    if (
        reliability === undefined
    ) {

        reliability = 0;

    }


    reliability =
        Number(
            reliability
        );


    reliability =
        Math.max(
            0,
            Math.min(
                100,
                reliability
            )
        );


    scoreElement.textContent =
        reliability + "%";


    scoreFill.style.width =
        reliability + "%";


    if (
        reliability >= 80
    ) {

        scoreLabel.textContent =
            "HIGHLY RELIABLE";

    }

    else if (
        reliability >= 60
    ) {

        scoreLabel.textContent =
            "MODERATE";

    }

    else {

        scoreLabel.textContent =
            "LOW RELIABILITY";

    }


    // -------------------------------------------------
    // CLAIMS
    // -------------------------------------------------

    const claimData =
        result.claims ||
        result.claim_analysis ||
        [];


    renderClaims(
        claimData
    );


    // -------------------------------------------------
    // SOURCES
    // -------------------------------------------------

    const sourceData =
        result.sources ||
        result.verification_sources ||
        [];


    renderSources(
        sourceData
    );

}


// =========================================================
// RENDER CLAIMS
// =========================================================

function renderClaims(
    data
) {

    if (!Array.isArray(data)) {

        data = [];

    }


    document.getElementById(
        "claimCount"
    ).textContent =
        data.length;


    claimsElement.innerHTML = "";


    if (!data.length) {

        claimsElement.innerHTML = `

            <div class="empty">

                No claim analysis available.

            </div>

        `;

        return;

    }


    data.forEach(
        (claim, index) => {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "claim";


            const status =
                String(
                    claim.status ||
                    claim.verdict ||
                    "UNCERTAIN"
                ).toUpperCase();


            let cssClass =
                "uncertain";


            let icon =
                "!";


            if (
                status.includes(
                    "SUPPORT"
                ) ||
                status.includes(
                    "TRUE"
                ) ||
                status.includes(
                    "VERIFIED"
                )
            ) {

                cssClass =
                    "supported";

                icon =
                    "✓";

            }

            else if (
                status.includes(
                    "HALLUC"
                ) ||
                status.includes(
                    "FALSE"
                ) ||
                status.includes(
                    "CONTRADICT"
                )
            ) {

                cssClass =
                    "hallucination";

                icon =
                    "✕";

            }


            const claimText =
                claim.claim ||
                claim.text ||
                claim.statement ||
                "Claim";


            const confidence =
                claim.confidence ??
                claim.score ??
                "--";


            element.innerHTML = `

                <div class="claim-top">

                    <div
                        class="
                            claim-status
                            ${cssClass}
                        "
                    >

                        ${icon}

                        Claim ${index + 1}

                    </div>


                    <div class="claim-score">

                        ${confidence}%

                    </div>

                </div>


                <div class="claim-text">

                    ${escapeHTML(
                        claimText
                    )}

                </div>

            `;


            claimsElement.appendChild(
                element
            );

        }
    );

}


// =========================================================
// RENDER SOURCES
// =========================================================

function renderSources(
    data
) {

    if (!Array.isArray(data)) {

        data = [];

    }


    document.getElementById(
        "sourceCount"
    ).textContent =
        data.length;


    sourcesElement.innerHTML = "";


    if (!data.length) {

        sourcesElement.innerHTML = `

            <div class="empty">

                No verification sources found.

            </div>

        `;

        return;

    }


    data.forEach(
        source => {

            const url =
                source.url ||
                source.link ||
                source.source_url ||
                "#";


            const title =
                source.title ||
                source.name ||
                source.source ||
                url;


            const element =
                document.createElement(
                    "a"
                );


            element.className =
                "source";


            element.href =
                url;


            element.target =
                "_blank";


            element.rel =
                "noopener noreferrer";


            element.innerHTML = `

                <div class="source-title">

                    ${escapeHTML(
                        title
                    )}

                </div>


                <div class="source-url">

                    ${escapeHTML(
                        url
                    )}

                </div>

            `;


            sourcesElement.appendChild(
                element
            );

        }
    );

}


// =========================================================
// HISTORY
// =========================================================

async function loadHistory() {

    const data =
        await chrome.storage.local.get([
            "analysisHistory"
        ]);


    renderHistory(
        data.analysisHistory || []
    );

}


function renderHistory(
    data
) {

    historyElement.innerHTML = "";


    if (!data.length) {

        historyElement.innerHTML = `

            <div class="empty">

                No previous analyses.

            </div>

        `;

        return;

    }


    data
        .slice(0, 10)
        .forEach(
            item => {

                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "history-item";


                const reliability =
                    item.result?.reliability ??
                    item.result?.score ??
                    "--";


                const answer =
                    item.answer || "";


                element.innerHTML = `

                    <div
                        class="history-icon"
                    >

                        ◈

                    </div>


                    <div
                        class="history-info"
                    >

                        <div
                            class="history-platform"
                        >

                            ${escapeHTML(
                                item.platform ||
                                "AI"
                            )}

                        </div>


                        <div
                            class="history-answer"
                        >

                            ${escapeHTML(
                                answer
                            )}

                        </div>

                    </div>


                    <div
                        class="history-score"
                    >

                        ${reliability}%

                    </div>

                `;


                historyElement.appendChild(
                    element
                );

            }
        );

}


// =========================================================
// CLEAR HISTORY
// =========================================================

clearHistoryButton.addEventListener(
    "click",
    () => {

        chrome.runtime.sendMessage({

            type:
                "CLEAR_HISTORY"

        });

    }
);


// =========================================================
// BACKGROUND MESSAGES
// =========================================================

chrome.runtime.onMessage.addListener(
    message => {


        // -------------------------------------------------
        // NEW AI RESPONSE
        // -------------------------------------------------

        if (
            message.type ===
            "NEW_AI_RESPONSE"
        ) {

            showResponse(

                message.answer,

                message.platform,

                message.website,

                message.url

            );

        }


        // -------------------------------------------------
        // ANALYSIS STARTED
        // -------------------------------------------------

        else if (
            message.type ===
            "ANALYSIS_STARTED"
        ) {

            analysisStarted();

        }


        // -------------------------------------------------
        // ANALYSIS COMPLETE
        // -------------------------------------------------

        else if (
            message.type ===
            "ANALYSIS_COMPLETE"
        ) {

            analysisComplete(
                message.result
            );

        }


        // -------------------------------------------------
        // ERROR
        // -------------------------------------------------

        else if (
            message.type ===
            "ANALYSIS_ERROR"
        ) {

            analysisError(
                message.error
            );

        }


        // -------------------------------------------------
        // HISTORY CLEARED
        // -------------------------------------------------

        else if (
            message.type ===
            "HISTORY_CLEARED"
        ) {

            loadHistory();

        }

    }
);


// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHTML(
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            text || ""
        );


    return div.innerHTML;

}


// =========================================================
// INITIAL LOAD
// =========================================================

loadData();