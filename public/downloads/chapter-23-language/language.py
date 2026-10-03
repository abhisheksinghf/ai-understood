"""A small byte-pair tokenizer and a count-based bigram language model."""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import re

DATA = json.loads(Path(__file__).with_name("data.json").read_text(encoding="utf-8"))


def valid_text(text):
    if not isinstance(text, str) or len(text) > 200 or any(0xD800 <= ord(c) <= 0xDFFF for c in text):
        raise ValueError("Use at most 200 Unicode code points, with no isolated surrogates.")


def replace_pair(sequence, a, b, token_id):
    result, i = [], 0
    while i < len(sequence):
        if i+1 < len(sequence) and sequence[i] == a and sequence[i+1] == b:
            result.append(token_id)
            i += 2
        else:
            result.append(sequence[i])
            i += 1
    return result


def piece(raw):
    try:
        return bytes(raw).decode("utf-8").replace(" ", "␠").replace("\n", "↵").replace("\t", "⇥").replace("\r", "␍")
    except UnicodeDecodeError:
        return "hex " + " ".join(f"{b:02X}" for b in raw)


def train_bpe(budget=16):
    if type(budget) is not int or not 0 <= budget <= 24:
        raise ValueError("Merge budget must be an integer from 0 to 24.")
    vocabulary, merges = [[i] for i in range(256)], []
    sequences = [list(text.encode("utf-8")) for text in DATA["corpus"]]
    for step in range(budget):
        counts = Counter((s[i],s[i+1]) for s in sequences for i in range(len(s)-1))
        if not counts:
            break
        pair, count = min(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        if count < 2:
            break
        left, right = pair
        token_id = len(vocabulary)
        vocabulary.append(vocabulary[left] + vocabulary[right])
        merges.append(dict(rank=step+1,left=left,right=right,id=token_id,count=count,piece=piece(vocabulary[token_id])))
        sequences = [replace_pair(s,left,right,token_id) for s in sequences]
    return dict(vocabulary=vocabulary,merges=merges)


def tokenize(text="this movie is fun.", budget=16):
    valid_text(text)
    model = train_bpe(budget)
    raw = list(text.encode("utf-8"))
    ids = raw
    for merge in model["merges"]:
        ids = replace_pair(ids,merge["left"],merge["right"],merge["id"])
    decoded = bytes(b for token_id in ids for b in model["vocabulary"][token_id]).decode("utf-8")
    return dict(text=text,budget=budget,codepoints=len(text),byte_count=len(raw),
                vocab_size=len(model["vocabulary"]),merges=model["merges"],ids=ids,
                tokens=[dict(id=i,piece=piece(model["vocabulary"][i]),bytes=model["vocabulary"][i]) for i in ids],
                decoded=decoded,roundtrip=decoded == text)


def words(text):
    valid_text(text)
    return re.findall(r"[a-z]+|[^\s]", text.lower())


def fit_bigram():
    rows = [words(text) for text in DATA["corpus"]]
    vocabulary = ["<eos>","<unk>"] + sorted(set(token for row in rows for token in row))
    counts = {token:[0]*len(vocabulary) for token in ["<bos>"]+vocabulary}
    for row in rows:
        previous = "<bos>"
        for token in row+["<eos>"]:
            counts[previous][vocabulary.index(token)] += 1
            previous = token
    return dict(vocabulary=vocabulary,counts=counts)


MODEL = fit_bigram()


def distribution(context="<bos>", alpha=1):
    if type(alpha) not in (int,float) or alpha not in (0,1) or not isinstance(context,str):
        raise ValueError("Invalid probability configuration.")
    key = context if context in MODEL["counts"] else "<unk>"
    counts = MODEL["counts"][key]
    total = sum(counts)
    denominator = total + alpha*len(MODEL["vocabulary"])
    return dict(context=key,total=total,denominator=denominator,
                rows=[dict(id=i,token=token,count=counts[i],probability=(counts[i]+alpha)/denominator if denominator else 0)
                      for i,token in enumerate(MODEL["vocabulary"])])


def decoding(rows, temperature=1, topk=0):
    if type(temperature) not in (int,float) or temperature not in (.5,1,2) or type(topk) is not int or topk not in (0,3):
        raise ValueError("Invalid decoding configuration.")
    ranked = sorted([dict(r,logit=math.log(r["probability"])/temperature) for r in rows if r["probability"] > 0], key=lambda r: (-r["logit"],r["id"]))
    kept = ranked[:topk] if topk else ranked
    highest = kept[0]["logit"] if kept else 0
    weights = {r["id"]:math.exp(r["logit"]-highest) for r in kept}
    total = sum(weights.values())
    return [dict(r,sampling_probability=weights[r["id"]]/total if r["id"] in weights else 0) for r in rows]


def generate(prefix="this movie is", alpha=1, temperature=1, topk=0, method="sample", seed=42, limit=10):
    if method not in ("sample","greedy") or type(seed) is not int or not 0 <= seed <= 4294967295 or type(limit) is not int or not 1 <= limit <= 20:
        raise ValueError("Invalid generation configuration.")
    input_tokens = words(prefix)
    mapped = [t if t in MODEL["vocabulary"] else "<unk>" for t in input_tokens]
    context = mapped[-1] if mapped else "<bos>"
    state, stop, steps, generated = seed, "Token limit", [], []
    for i in range(limit):
        d = distribution(context,alpha)
        rows = decoding(d["rows"],temperature,topk)
        nonzero = [r for r in rows if r["sampling_probability"] > 0]
        if not nonzero:
            stop = "No observed continuation"
            break
        draw = None
        if method == "greedy":
            selected = min(rows,key=lambda r: (-r["sampling_probability"],r["id"]))
        else:
            state = (1664525*state+1013904223) % 4294967296
            draw = state/4294967296
            cumulative, selected = 0, nonzero[-1]
            for r in rows:
                cumulative += r["sampling_probability"]
                if draw < cumulative:
                    selected = r
                    break
        steps.append(dict(position=i+1,context=context,token=selected["token"],base_probability=selected["probability"],sampling_probability=selected["sampling_probability"],draw=draw))
        generated.append(selected["token"])
        context = selected["token"]
        if context == "<eos>":
            stop = "End token"
            break
    return dict(prefix=prefix,alpha=alpha,temperature=temperature,topk=topk,method=method,seed=seed,limit=limit,
                input_tokens=input_tokens,mapped_tokens=mapped,generated_tokens=generated,steps=steps,stop=stop,
                text=" ".join(mapped+[t for t in generated if t != "<eos>"]).replace(" .","."))


def score(text="this movie is fun .", alpha=1):
    original = words(text)
    mapped = [t if t in MODEL["vocabulary"] else "<unk>" for t in original]
    context, steps = "<bos>", []
    for i,token in enumerate(mapped+["<eos>"]):
        d = distribution(context,alpha)
        probability = next(r["probability"] for r in d["rows"] if r["token"] == token)
        steps.append(dict(position=i+1,context=context,token=token,probability=probability,nll=-math.log(probability) if probability > 0 else None))
        context = token
    zero_probabilities = sum(s["probability"] == 0 for s in steps)
    mean_nll = None if zero_probabilities else sum(s["nll"] for s in steps)/len(steps)
    return dict(text=text,alpha=alpha,original=original,mapped=mapped,unknowns=[t for i,t in enumerate(original) if mapped[i] == "<unk>"],
                steps=steps,target_count=len(steps),zero_probabilities=zero_probabilities,mean_nll=mean_nll,
                perplexity=math.exp(mean_nll) if mean_nll is not None else None)


def explore(prefix="this movie is", alpha=1, temperature=1, topk=0, method="sample", score_case="familiar"):
    if score_case not in DATA["scores"]:
        raise ValueError("Unknown scoring case.")
    tokens = words(prefix)
    d = distribution(tokens[-1] if tokens else "<bos>",alpha)
    return dict(prefix=prefix,alpha=alpha,temperature=temperature,topk=topk,method=method,score_case=score_case,
                vocabulary=MODEL["vocabulary"],context=d["context"],total=d["total"],denominator=d["denominator"],
                rows=decoding(d["rows"],temperature,topk),generation=generate(prefix,alpha,temperature,topk,method),
                scoring=score(DATA["scores"][score_case],alpha))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command",required=True)
    t = commands.add_parser("tokenize")
    t.add_argument("--text",default="this movie is fun.")
    t.add_argument("--merges",type=int,choices=range(25),default=16)
    m = commands.add_parser("model")
    m.add_argument("--prefix",default="this movie is")
    m.add_argument("--alpha",type=int,choices=(0,1),default=1)
    m.add_argument("--temperature",type=float,choices=(.5,1,2),default=1)
    m.add_argument("--top-k",type=int,choices=(0,3),default=0)
    m.add_argument("--method",choices=("sample","greedy"),default="sample")
    m.add_argument("--score-case",choices=DATA["scores"],default="familiar")
    args = parser.parse_args()
    try:
        result = tokenize(args.text,args.merges) if args.command == "tokenize" else explore(args.prefix,args.alpha,args.temperature,args.top_k,args.method,args.score_case)
    except ValueError as error:
        parser.error(str(error))
    # ASCII escapes keep the JSON CLI portable across Windows code pages.
    print(json.dumps(result,ensure_ascii=True,allow_nan=False,indent=2))


if __name__ == "__main__":
    main()
