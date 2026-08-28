from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
from datetime import datetime


app = FastAPI(
    title="Adaptive RAG AI Hallucination Detector",
    version="2.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# MODELS
# =========================================================

class AnalyzeRequest(BaseModel):
    answer: str
    platform: str = "Unknown"


class Source:
    def __init__(
        self,
        title,
        url,
        snippet,
        source_type="web"
    ):
        self.title = title
        self.url = url
        self.snippet = snippet
        self.source_type = source_type


# =========================================================
# TEXT CLEANING
# =========================================================

def clean_text(text: str):

    text = re.sub(r"\s+", " ", text)

    return text.strip()


# =========================================================
# CLAIM EXTRACTION
# =========================================================

def extract_claims(answer: str) -> List[str]:

    sentences = re.split(
        r"(?<=[.!?])\s+",
        answer
    )

    claims = []

    for sentence in sentences:

        sentence = clean_text(sentence)

        if len(sentence) < 30:
            continue

        if sentence.endswith("?"):
            continue

        claims.append(sentence)

    return claims[:15]


# =========================================================
# CLAIM COMPLEXITY
# =========================================================

def determine_complexity(claim):

    words = claim.split()

    complexity_score = 0

    if len(words) > 25:
        complexity_score += 2

    complex_terms = [
        "why",
        "impact",
        "effect",
        "compare",
        "relationship",
        "historical",
        "economic",
        "scientific",
        "according",
        "research",
        "study"
    ]

    lower = claim.lower()

    for term in complex_terms:

        if term in lower:
            complexity_score += 1

    if complexity_score >= 3:
        return "complex"

    return "simple"


# =========================================================
# WIKIPEDIA
# =========================================================

def search_wikipedia(query):

    url = "https://en.wikipedia.org/w/api.php"

    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "format": "json",
        "utf8": 1,
        "srlimit": 5
    }

    try:

        response = requests.get(
            url,
            params=params,
            timeout=8,
            headers={
                "User-Agent":
                "AdaptiveRAG-HallucinationDetector/2.0"
            }
        )

        data = response.json()

        sources = []

        for item in data.get(
            "query",
            {}
        ).get(
            "search",
            []
        ):

            title = item["title"]

            page_url = (
                "https://en.wikipedia.org/wiki/"
                +
                quote(
                    title.replace(
                        " ",
                        "_"
                    )
                )
            )

            snippet = BeautifulSoup(
                item.get(
                    "snippet",
                    ""
                ),
                "html.parser"
            ).get_text(" ")

            sources.append(
                Source(
                    title="Wikipedia - " + title,
                    url=page_url,
                    snippet=snippet,
                    source_type="retrieved"
                )
            )

        return sources

    except Exception:

        return []


# =========================================================
# WEB SEARCH
# =========================================================

def search_web(query):

    sources = []

    try:

        url = (
            "https://html.duckduckgo.com/html/"
        )

        response = requests.post(
            url,
            data={
                "q": query
            },
            headers={
                "User-Agent":
                "Mozilla/5.0"
            },
            timeout=8
        )

        soup = BeautifulSoup(
            response.text,
            "html.parser"
        )

        results = soup.select(
            ".result"
        )

        for result in results[:6]:

            link = result.select_one(
                ".result__a"
            )

            if not link:
                continue

            title = link.get_text(
                " ",
                strip=True
            )

            href = link.get(
                "href"
            )

            snippet_element = (
                result.select_one(
                    ".result__snippet"
                )
            )

            snippet = ""

            if snippet_element:

                snippet = (
                    snippet_element.get_text(
                        " ",
                        strip=True
                    )
                )

            if href:

                sources.append(
                    Source(
                        title=title,
                        url=href,
                        snippet=snippet,
                        source_type="retrieved"
                    )
                )

    except Exception:

        pass

    return sources


# =========================================================
# ADAPTIVE RETRIEVAL
# =========================================================

def retrieve_sources(
    claim,
    complexity
):

    sources = []

    # ---------------------------------
    # SIMPLE CLAIM
    # ---------------------------------

    if complexity == "simple":

        sources.extend(
            search_wikipedia(
                claim
            )
        )

        if len(sources) < 3:

            sources.extend(
                search_web(
                    claim
                )
            )

    # ---------------------------------
    # COMPLEX CLAIM
    # ---------------------------------

    else:

        sources.extend(
            search_web(
                claim
            )
        )

        sources.extend(
            search_wikipedia(
                claim
            )
        )

    # Remove duplicates

    unique = {}

    for source in sources:

        if source.url not in unique:

            unique[
                source.url
            ] = source

    return list(
        unique.values()
    )[:8]


# =========================================================
# SIMILARITY
# =========================================================

def calculate_similarity(
    claim,
    evidence
):

    if not evidence:

        return 0.0

    try:

        vectorizer = (
            TfidfVectorizer(
                stop_words="english"
            )
        )

        matrix = vectorizer.fit_transform(
            [
                claim,
                evidence
            ]
        )

        score = cosine_similarity(
            matrix[0:1],
            matrix[1:2]
        )[0][0]

        return float(score)

    except Exception:

        return 0.0


# =========================================================
# VERIFY CLAIM
# =========================================================

def verify_claim(claim):

    complexity = (
        determine_complexity(
            claim
        )
    )

    sources = retrieve_sources(
        claim,
        complexity
    )

    ranked = []

    for source in sources:

        score = calculate_similarity(
            claim,
            source.snippet
        )

        ranked.append(
            (
                score,
                source
            )
        )

    ranked.sort(
        key=lambda x: x[0],
        reverse=True
    )

    best_score = 0

    if ranked:

        best_score = ranked[0][0]

    # ---------------------------------
    # CLASSIFICATION
    # ---------------------------------

    if best_score >= 0.55:

        status = "SUPPORTED"

    elif best_score >= 0.30:

        status = "UNCERTAIN"

    else:

        status = "POTENTIAL HALLUCINATION"

    return {

        "claim": claim,

        "status": status,

        "confidence": round(
            best_score * 100,
            2
        ),

        "complexity": complexity,

        "sources": [

            {
                "title":
                    source.title,

                "url":
                    source.url,

                "snippet":
                    source.snippet,

                "source_type":
                    source.source_type
            }

            for _, source in ranked[:5]
        ]
    }


# =========================================================
# MAIN ANALYSIS
# =========================================================

@app.post("/analyze")
def analyze_response(
    request: AnalyzeRequest
):

    answer = clean_text(
        request.answer
    )

    claims = extract_claims(
        answer
    )

    results = []

    for claim in claims:

        results.append(
            verify_claim(
                claim
            )
        )

    if not results:

        return {

            "status":
                "NO_CLAIMS",

            "reliability":
                0,

            "claims": [],

            "platform":
                request.platform,

            "timestamp":
                datetime.utcnow().isoformat()
        }

    supported = sum(
        1
        for r in results
        if r["status"]
        == "SUPPORTED"
    )

    uncertain = sum(
        1
        for r in results
        if r["status"]
        == "UNCERTAIN"
    )

    hallucinations = sum(
        1
        for r in results
        if r["status"]
        == "POTENTIAL HALLUCINATION"
    )

    total = len(results)

    reliability = (
        (
            supported
            +
            uncertain * 0.5
        )
        /
        total
    ) * 100

    # ---------------------------------
    # UNIQUE SOURCES
    # ---------------------------------

    source_map = {}

    for result in results:

        for source in result["sources"]:

            if source["url"] not in source_map:

                source_map[
                    source["url"]
                ] = source

    all_sources = list(
        source_map.values()
    )

    return {

        "status":
            "ANALYZED",

        "platform":
            request.platform,

        "timestamp":
            datetime.utcnow().isoformat(),

        "reliability":
            round(
                reliability,
                2
            ),

        "total_claims":
            total,

        "supported_claims":
            supported,

        "uncertain_claims":
            uncertain,

        "hallucination_claims":
            hallucinations,

        "sources_found":
            len(all_sources),

        "claims":
            results,

        "sources":
            all_sources[:10]
    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/")
def root():

    return {

        "project":
            "Adaptive RAG AI Hallucination Detector",

        "version":
            "2.0",

        "status":
            "running"
    }