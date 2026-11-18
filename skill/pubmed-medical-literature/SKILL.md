---
name: pubmed-medical-literature
description: Use when the user invokes $pubmed-medical-literature, mentions PubMed Medical Literature, or requests supported PubMed Medical Literature data or operations.
---

# PubMed Medical Literature

## Overview

Use this skill for requests within the verified PubMed Medical Literature capability boundary. Select a live callable tool from the catalog below and report provider evidence without inventing unsupported facts.

## Core Rules

- Use the bound `pubmed-medical-literature` MCP only when its live callable tools are available in the current runtime.
- Select the narrowest live callable operation that directly answers the request and follow its current interface.
- Preserve exact tool names, returned identifiers, status values, timestamps, units, and scope.
- Do not invent provider facts, records, prices, dates, permissions, or operation results.
- Do not recreate this connector with shell commands, direct HTTP requests, or hand-written protocol calls.
- Keep credentials, private content, and authorization material out of prompts, logs, and final answers.
- Require explicit confirmation before any external write, send, purchase, order, deletion, publication, merge, or permission change.

## Tools

- `pubmed_convert_ids`: Convert between article identifiers (DOI, PMID, PMCID).
- `pubmed_europepmc_fetch`: Fetch complete Europe PMC records — including the full, untruncated abstract — for records addressed by source plus epmcId.
- `pubmed_europepmc_search`: Search Europe PMC, a broad open-access biomedical corpus.
- `pubmed_fetch_articles`: Fetch full article metadata by PubMed IDs.
- `pubmed_fetch_fulltext`: Fetch full-text articles from PubMed Central with structured sections and references.
- `pubmed_find_related`: Find articles related to a source article — similar content (similar), articles citing this one (cited_by), or articles this one cites (references).
- `pubmed_format_citations`: Get formatted citations for PubMed articles in one or more formats (apa, mla, bibtex, ris, vancouver).
- `pubmed_lookup_citation`: Look up PubMed IDs from partial bibliographic citations.
- `pubmed_lookup_mesh`: Search and explore the MeSH (Medical Subject Headings) controlled vocabulary.
- `pubmed_search_articles`: Search PubMed with full query syntax, filters, and date ranges.
- `pubmed_spell_check`: Spell-check a query and get NCBI's suggested correction.
- Choose the narrowest live callable tool that directly satisfies the user's intent; use returned identifiers to chain follow-up operations only when necessary.

## Workflow

1. Identify the requested entity, identifier, scope, time range, filters, operation, and output format.
2. Classify the request as lookup, search, analysis, creation, update, export, deletion, sending, purchase, permission change, or another provider operation.
3. Resolve ambiguous identifiers with a live lookup when available; never guess a code, ID, path, coordinate, record, order, or account.
4. Pass only currently supported arguments and preserve provider pagination, status, units, timestamps, and returned identifiers.
5. Inspect the outer tool error and provider status before reading result fields; do not treat an empty or partial response as complete success.

## Query Guidance

- Ask only for missing inputs required to select or safely execute the operation.
- Keep unrelated entities, time windows, accounts, and writes separate.
- State filters, result limits, sort order, output format, and data time when available.
- Preserve the user's requested scope and label any normalization or model interpretation.

## Failure Handling

- If no live PubMed Medical Literature callable tool is available, report that the connector is unavailable in the current runtime.
- For authorization, quota, timeout, invalid-argument, permission, provider, or missing-tool errors, report the failed operation without exposing secrets.
- Retry at most once only after a safe correction such as narrowing scope, supplying a known identifier, reducing page size, or removing an unsupported optional field.
- For empty or partial results, report the exact query scope and provider status; never fill missing fields from memory.
- Do not silently substitute another provider when this connector was specifically requested.

## Result Contract

- Separate returned provider facts from model interpretation and derived calculations.
- Preserve identifiers, URLs, paths, dates, timestamps, units, filters, page scope, totals, status, and provider caveats when returned.
- Do not describe one page, sample, or preview as complete unless the provider confirms completeness.
