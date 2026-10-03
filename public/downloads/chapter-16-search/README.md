# Chapter 16: movie search

Eight fictional movie summaries, real lexical retrieval, Python 3.10+ standard library only. Extract all four files together. No network calls, installed packages, trained models, or credentials.

```powershell
py search.py
py search.py --query "space rescue" --method tfidf
py search.py --mode all --limit under120 --k 5
py search.py --k1 0 --b 0
py -m unittest -v test_search.py
```

Use `python` or `python3` if appropriate. JSON goes to stdout; the input is never edited. An invalid file or setting exits 2 with a JSON error; malformed command-line syntax uses argparse's usage error. `--input path/to/movies.json` overrides the file beside the script. Queries have a 200-character limit; K is 1-10, k1 is 0-3, b is 0-1. Empty queries produce no results.

## Read the code in this order

1. `tokenize`: lowercase and extract `[a-z0-9]+` from summaries and queries. Keep stop words. No stemming, synonyms, fuzzy matching, or language-aware processing.
2. `build_index`: each term maps to movie IDs and zero-based positions. Title/runtime are metadata, not indexed text. Average length and document frequency use the full catalog.
3. `search`: deduplicate query terms; union postings for OR or intersect for AND. Unknown query words have no postings, so AND with an unknown term has no candidates. Quotes are ignored punctuation, not phrase syntax.
4. Filter known runtimes below 120 when requested, then rank, then truncate to K. Unknown runtime cannot satisfy the filter. BM25 statistics do not change with filtering.
5. `ranking_metrics`: compare with independent authored labels only for recognized preset intents. Query matching ignores case, punctuation, term order, and duplicates. Label edits do not affect rankings.

## Exact score conventions

- overlap: one point for each distinct matched query term.
- tfidf: sum `(1 + ln(tf)) * ln(N/df)` over present query terms. This is an unnormalized log-TF sum, not cosine TF-IDF. Common-to-all terms have IDF 0; matching zero-score documents remain candidates.
- bm25: sum `ln(1 + (N-df+0.5)/(df+0.5)) * tf*(k1+1)/(tf+k1*(1-b+b*length/avgdl))`. Missing terms contribute 0 even at k1=0. Default k1=1.2, b=0.75.
- Sort descending score, then ascending movie ID for exact ties. Scores are not probabilities or comparable between ranking methods.

Default BM25: M008 2.1862975962, M004 1.7438594112, M005 0.8758504964. N=8, 94 total tokens, average length=11.75, df(space)=3, df(rescue)=4. All calculations use unrounded numbers.

## Evaluation contract

`movies.json` defines three authored intents. The relevant ID lists are exhaustive within this tiny catalog; other IDs are explicitly judged nonrelevant. Runtime filtering also restricts the relevant eligible set. Precision@K divides by requested K, counting empty slots as zero. Recall@K divides by relevant eligible count, or returns null when that count is zero. Reciprocal rank@K is 1/(rank of first relevant result in top K), or 0 if none. It is a single-query, truncated value, not mean reciprocal rank. Arbitrary unjudged queries return `evaluation: null`.

The workbook is a transparent teaching baseline. It does not implement phrase search, cosine normalization, learned embeddings, reranking, AP, NDCG, persistent indexing, or large-scale search optimizations. Judgments are teaching assumptions, not user-study results. Changing source summaries also changes collection statistics; restore the supplied snapshot for handbook numbers.

References: [Stanford IR book](https://nlp.stanford.edu/IR-book/), [Lucene BM25 IDF reference](https://lucene.apache.org/core/9_9_1/core/org/apache/lucene/search/similarities/BM25Similarity.html).
